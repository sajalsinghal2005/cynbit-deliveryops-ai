import crypto from "node:crypto";
import type {
  EmailProvider,
  EmailMessage,
  EmailSendResult,
  EmailErrorCode,
} from "../email.types.js";

export interface ResendAdapterOptions {
  apiKey: string;
  fromAddress?: string;
  timeoutMs?: number;
  apiBaseUrl?: string;
}

/**
 * Production Resend Transactional Email Adapter
 * Implements resilient dispatch with native Idempotency-Key propagation,
 * abort signal timeout handling, and sanitized error mapping.
 */
export class ResendEmailAdapter implements EmailProvider {
  public readonly name = "resend";
  private apiKey: string;
  private fromAddress: string;
  private timeoutMs: number;
  private apiBaseUrl: string;

  constructor(options: ResendAdapterOptions) {
    if (!options.apiKey || options.apiKey.trim().length === 0) {
      throw new Error("ResendEmailAdapter requires a valid API key.");
    }
    this.apiKey = options.apiKey.trim();
    this.fromAddress = options.fromAddress || "BizOps AI <billing@bizops.ai>";
    this.timeoutMs = options.timeoutMs || 5000;
    this.apiBaseUrl = options.apiBaseUrl || "https://api.resend.com";
  }

  public async send(message: EmailMessage): Promise<EmailSendResult> {
    const rawTo = Array.isArray(message.to) ? message.to : [message.to];
    const recipients = rawTo.map((t) => (typeof t === "string" ? t : t.email));
    const recipient = recipients[0] || "unknown@client.com";

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (message.idempotencyKey) {
      headers["Idempotency-Key"] = message.idempotencyKey;
    }

    const payload = {
      from: message.from || this.fromAddress,
      to: recipients,
      subject: message.subject,
      text: message.text,
      html: message.html,
    };

    try {
      const response = await fetch(`${this.apiBaseUrl}/emails`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        return this.mapHttpError(response.status, await response.text(), recipient, message);
      }

      const data = (await response.json()) as { id?: string };
      return {
        success: true,
        messageId: data.id || `resend_${Date.now()}`,
        provider: this.name,
        simulated: false,
        timestamp: new Date().toISOString(),
        idempotencyKey: message.idempotencyKey,
        recipient,
        subject: message.subject,
      };
    } catch (err: any) {
      return this.mapNetworkError(err, recipient, message);
    }
  }

  private mapHttpError(
    status: number,
    rawBody: string,
    recipient: string,
    message: EmailMessage
  ): EmailSendResult {
    let code: EmailErrorCode = "UNKNOWN_ERROR";
    let safeMessage = "An unexpected error occurred while communicating with the email provider.";

    if (status === 401) {
      code = "AUTH_FAILED";
      safeMessage = "Provider authentication failed. Please verify API key configuration.";
    } else if (status === 403) {
      if (rawBody.includes("validation_error") || rawBody.includes("testing emails")) {
        code = "INVALID_REQUEST";
        safeMessage = "Provider rejected recipient: Free tier only allows verified domains or account test recipients.";
      } else {
        code = "AUTH_FAILED";
        safeMessage = "Provider authentication failed. Please verify API key configuration.";
      }
    } else if (status === 429) {
      code = "RATE_LIMITED";
      safeMessage = "Provider dispatch rate limit exceeded. Action was throttled.";
    } else if (status === 400 || status === 422) {
      code = "INVALID_REQUEST";
      safeMessage = "Email dispatch payload was rejected by provider as malformed.";
    } else if (status >= 500) {
      code = "PROVIDER_UNAVAILABLE";
      safeMessage = "External email provider returned a server error (service temporarily unavailable).";
    }

    return {
      success: false,
      provider: this.name,
      simulated: false,
      timestamp: new Date().toISOString(),
      idempotencyKey: message.idempotencyKey,
      recipient,
      subject: message.subject,
      error: {
        code,
        message: safeMessage,
        statusCode: status,
      },
    };
  }

  private mapNetworkError(
    err: any,
    recipient: string,
    message: EmailMessage
  ): EmailSendResult {
    const isTimeout =
      err?.name === "TimeoutError" ||
      err?.name === "AbortError" ||
      err?.code === 23;

    const code: EmailErrorCode = isTimeout ? "TIMEOUT" : "PROVIDER_UNAVAILABLE";
    const safeMessage = isTimeout
      ? `Email dispatch timed out after ${this.timeoutMs}ms.`
      : "Failed to establish network connection with external email provider.";

    return {
      success: false,
      provider: this.name,
      simulated: false,
      timestamp: new Date().toISOString(),
      idempotencyKey: message.idempotencyKey,
      recipient,
      subject: message.subject,
      error: {
        code,
        message: safeMessage,
      },
    };
  }

  public verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    if (!payload || !signature || !secret) return false;

    try {
      // Standard HMAC-SHA256 signature verification
      const expected = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

      const cleanSig = signature.startsWith("sha256=")
        ? signature.slice(7)
        : signature;

      if (cleanSig.length !== expected.length) return false;

      return crypto.timingSafeEqual(
        Buffer.from(cleanSig, "utf-8"),
        Buffer.from(expected, "utf-8")
      );
    } catch {
      return false;
    }
  }
}
