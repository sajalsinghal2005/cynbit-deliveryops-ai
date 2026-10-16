import { z } from "zod";
import type { ToolDefinition } from "./tool.types.js";
import { emailService } from "../integrations/email/email.service.js";

export const sendEmailToolInputSchema = z.object({
  template: z.string().default("overdue_invoice_reminder"),
  invoices: z.array(
    z.object({
      invoiceNumber: z.string(),
      clientName: z.string(),
      clientCompany: z.string(),
      amount: z.string(),
      dueDate: z.string(),
    })
  ).min(1, "At least one invoice must be specified for reminder emails."),
});

export const sendEmailToolOutputSchema = z.object({
  action: z.string(),
  simulated: z.boolean(),
  mode: z.string(),
  provider: z.string().optional(),
  messageId: z.string().optional(),
  executedAt: z.string(),
  targetInvoices: z.array(z.any()),
  customer: z.string(),
  amount: z.string(),
  message: z.string(),
});

export type SendEmailToolInput = z.infer<typeof sendEmailToolInputSchema>;
export type SendEmailToolOutput = z.infer<typeof sendEmailToolOutputSchema>;

/**
 * Consequential tool for preparing and dispatching invoice reminders.
 * Strictly requires human authorization before real or simulated execution.
 */
export const sendEmailTool: ToolDefinition<SendEmailToolInput, SendEmailToolOutput> = {
  id: "send-email",
  name: "Send Overdue Reminder",
  description:
    "Consequential: dispatch overdue reminder emails (strictly requires human authorization before execution).",
  category: "Finance",
  operationType: "CONSEQUENTIAL",
  risk: "MEDIUM",
  requiresApproval: true,
  schema: sendEmailToolInputSchema,
  outputSchema: sendEmailToolOutputSchema,
  execute: async (params, _context) => {
    const first = params.invoices[0];
    const customer =
      params.invoices.length === 1
        ? `${first.clientName} (${first.clientCompany})`
        : `${params.invoices.length} Clients`;

    const approvalId = _context?.requestId || `tool-exec-${Date.now()}`;
    const result = await emailService.sendInvoiceReminder({
      invoices: params.invoices,
      approvalId,
      customer,
    });

    return {
      action: "SEND_INVOICE_REMINDER",
      simulated: result.simulated,
      mode: result.simulated ? "DEMO_SIMULATION" : "PRODUCTION_INTEGRATION",
      provider: result.provider,
      messageId: result.messageId,
      executedAt: result.timestamp,
      targetInvoices: params.invoices,
      customer,
      amount: first.amount,
      message: result.success
        ? `Overdue payment reminder successfully dispatched via ${result.provider} for ${customer}.`
        : `Email dispatch failed via ${result.provider}: ${result.error?.message}`,
    };
  },
};
