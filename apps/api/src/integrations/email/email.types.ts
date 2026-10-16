/**
 * External Email Integration Type Definitions
 * Establishes provider-agnostic abstractions, normalized result contracts,
 * and robust failure modes for transactional email dispatch.
 */

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface InvoiceReminderItem {
  invoiceNumber: string;
  clientName: string;
  clientCompany: string;
  amount: string;
  dueDate: string;
  recipientEmail?: string;
}

export interface EmailMessage {
  to: string | string[] | EmailRecipient[];
  from?: string;
  subject: string;
  text?: string;
  html?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

export type EmailErrorCode =
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "AUTH_FAILED"
  | "INVALID_REQUEST"
  | "PROVIDER_UNAVAILABLE"
  | "CONFIG_ERROR"
  | "UNKNOWN_ERROR";

export interface EmailErrorDetails {
  code: EmailErrorCode;
  message: string;
  statusCode?: number;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  provider: string; // e.g. "resend" | "simulation" | "mock"
  simulated: boolean;
  timestamp: string;
  idempotencyKey?: string;
  recipient?: string;
  subject?: string;
  error?: EmailErrorDetails;
}

export interface EmailWebhookEvent {
  id: string;
  type:
    | "email.sent"
    | "email.delivered"
    | "email.bounced"
    | "email.complained"
    | "email.opened"
    | "email.clicked";
  createdAt: string;
  data: {
    emailId: string;
    to: string[];
    from: string;
    subject: string;
    status?: string;
  };
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
  verifyWebhookSignature?(
    payload: string,
    signature: string,
    secret: string
  ): boolean;
}
