import crypto from "node:crypto";
import type {
  EmailProvider,
  EmailMessage,
  EmailSendResult,
} from "../email.types.js";

/**
 * Simulated Email Provider Adapter
 * Used in local development, testing, and environments without external credentials.
 * Preserves the exact interface and response contracts of real transactional adapters
 * without making outbound network requests.
 */
export class SimulationEmailAdapter implements EmailProvider {
  public readonly name = "simulation";

  public async send(message: EmailMessage): Promise<EmailSendResult> {
    const rawTo = Array.isArray(message.to) ? message.to[0] : message.to;
    const recipient = typeof rawTo === "string" ? rawTo : rawTo.email;
    const simulatedMessageId = `sim_msg_${crypto.randomUUID().slice(0, 12)}`;

    return {
      success: true,
      messageId: simulatedMessageId,
      provider: this.name,
      simulated: true,
      timestamp: new Date().toISOString(),
      idempotencyKey: message.idempotencyKey,
      recipient,
      subject: message.subject,
    };
  }

  public verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
    return crypto.timingSafeEqual(
      Buffer.from(signature, "utf-8"),
      Buffer.from(expected, "utf-8")
    );
  }
}
