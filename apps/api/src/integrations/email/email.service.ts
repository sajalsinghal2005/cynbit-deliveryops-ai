import { config } from "../../config/env.js";
import type {
  EmailProvider,
  EmailMessage,
  EmailSendResult,
  InvoiceReminderItem,
} from "./email.types.js";
import { SimulationEmailAdapter } from "./adapters/simulation.adapter.js";
import { ResendEmailAdapter } from "./adapters/resend.adapter.js";

export interface SendReminderOptions {
  invoices: InvoiceReminderItem[];
  approvalId: string;
  customer: string;
  recipientEmail?: string;
}

export interface SendClientFollowupOptions {
  approvalId: string;
  to: string;
  subject: string;
  message: string;
  customer: string;
  project?: string;
}

/**
 * Enterprise Email Integration Service
 * Manages provider adapters, templating, and transactional dispatch with persistent idempotency.
 */
export class EmailService {
  private provider: EmailProvider;

  constructor() {
    this.provider = this.createDefaultProvider();
  }

  private createDefaultProvider(): EmailProvider {
    if (config.EMAIL_PROVIDER === "resend" && config.RESEND_API_KEY) {
      return new ResendEmailAdapter({
        apiKey: config.RESEND_API_KEY,
        fromAddress: config.EMAIL_FROM,
        timeoutMs: config.EMAIL_TIMEOUT_MS,
      });
    }

    // Default to safe simulation mode
    return new SimulationEmailAdapter();
  }

  /**
   * Sets the active email provider adapter.
   * Useful in integration test suites to simulate external provider failures.
   */
  public setProvider(provider: EmailProvider): void {
    this.provider = provider;
  }

  /**
   * Resets provider adapter to configuration default.
   */
  public resetProvider(): void {
    this.provider = this.createDefaultProvider();
  }

  /**
   * Returns current active provider name.
   */
  public getProviderName(): string {
    return this.provider.name;
  }

  /**
   * Dispatches an overdue invoice payment reminder email with deterministic idempotency.
   */
  public async sendInvoiceReminder(options: SendReminderOptions): Promise<EmailSendResult> {
    const { invoices, approvalId, customer, recipientEmail } = options;
    const targetRecipient =
      recipientEmail || config.TEST_EMAIL_RECIPIENT || "finance@client.com";
    const idempotencyKey = `bizops-apr-${approvalId.toLowerCase()}`;

    const invoiceListText = invoices
      .map(
        (inv) =>
          `• Invoice ${inv.invoiceNumber}: ${inv.amount} (Due: ${inv.dueDate})`
      )
      .join("\n");

    const subject =
      invoices.length === 1
        ? `Payment Reminder: Invoice ${invoices[0].invoiceNumber} for ${customer}`
        : `Payment Reminder: Outstanding Invoices for ${customer}`;

    const text = `Dear Accounts Payable,

This is a courteous reminder that the following invoice(s) for ${customer} remain unsettled:

${invoiceListText}

Please arrange settlement or provide an updated remittance advice at your earliest convenience.

Best regards,
Finance Operations Team
BizOps AI`;

    const message: EmailMessage = {
      to: targetRecipient,
      from: config.EMAIL_FROM,
      subject,
      text,
      idempotencyKey,
      metadata: {
        approvalId,
        invoiceCount: invoices.length,
        customer,
      },
    };

    return this.provider.send(message);
  }

  /**
   * Dispatches an approved client follow-up notice regarding delivery status, risks, or blockers
   * with deterministic idempotency.
   */
  public async sendClientFollowup(options: SendClientFollowupOptions): Promise<EmailSendResult> {
    const { approvalId, to, subject, message: textContent, customer, project } = options;
    const targetRecipient =
      config.NODE_ENV !== "production" && config.TEST_EMAIL_RECIPIENT
        ? config.TEST_EMAIL_RECIPIENT
        : to || config.TEST_EMAIL_RECIPIENT || "client@cynbit.com";
    const idempotencyKey = `bizops-apr-${approvalId.toLowerCase()}`;

    const message: EmailMessage = {
      to: targetRecipient,
      from: config.EMAIL_FROM,
      subject,
      text: textContent,
      idempotencyKey,
      metadata: {
        approvalId,
        customer,
        project,
        actionType: "SEND_CLIENT_FOLLOWUP",
      },
    };

    return this.provider.send(message);
  }

  /**
   * General-purpose message sender.
   */
  public async send(message: EmailMessage): Promise<EmailSendResult> {
    return this.provider.send(message);
  }

  /**
   * Verifies an incoming webhook signature using configured webhook secret.
   */
  public verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!config.EMAIL_WEBHOOK_SECRET) {
      // In development/test with no secret configured, reject unauthenticated calls
      return false;
    }

    if (this.provider.verifyWebhookSignature) {
      return this.provider.verifyWebhookSignature(
        payload,
        signature,
        config.EMAIL_WEBHOOK_SECRET
      );
    }

    return false;
  }
}

export const emailService = new EmailService();
