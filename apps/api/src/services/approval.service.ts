import { prisma } from "../lib/prisma.js";
import {
  approvalStore,
  formatDbApproval,
  type ApprovalActionType,
  type ApprovalRequest,
  type ApprovalStatus,
} from "../data/approvals.js";
import type { SafeUserProfile } from "./auth.service.js";
import { emailService } from "../integrations/email/email.service.js";

const ALLOWLISTED_ACTIONS: Set<ApprovalActionType> = new Set([
  "SEND_INVOICE_REMINDER",
  "REFUND_PAYMENT",
  "CANCEL_ORDER",
]);

export interface ApprovalDecisionResult {
  success: boolean;
  approval: ApprovalRequest;
  message: string;
  executionResult?: any;
}

export class ApprovalService {
  /**
   * Retrieves all approvals from PostgreSQL with optional status filtering.
   */
  public async listApprovals(status?: ApprovalStatus): Promise<ApprovalRequest[]> {
    return approvalStore.getAll(status);
  }

  /**
   * Retrieves a single approval request by ID from PostgreSQL.
   */
  public async getApproval(id: string): Promise<ApprovalRequest | undefined> {
    return approvalStore.getById(id);
  }

  /**
   * Approves a pending request atomically using database transactions.
   * Derives actor identity strictly from verified server-side user session.
   * Prevents concurrent duplicate decisions and executes verified action in safe simulated mode.
   */
  public async approveApproval(
    id: string,
    user: SafeUserProfile,
  ): Promise<ApprovalDecisionResult> {
    const formattedId = id.toUpperCase();
    const existing = await prisma.approvalRequest.findUnique({
      where: { id: formattedId },
    });

    if (!existing) {
      throw new Error(`Approval request with ID "${id}" was not found.`);
    }

    if (existing.status !== "PENDING") {
      throw new Error(
        `Approval request "${id}" has already been decided (${existing.status}) and cannot be approved again.`,
      );
    }

    // Self-approval protection: proposal creator cannot authorize their own action proposal
    const requestedById = (existing.arguments as any)?.requestedBy?.id;
    if (requestedById && requestedById === user.id) {
      throw new Error(
        "Self-approval prohibited: creator cannot authorize their own action proposal."
      );
    }

    // Backend Action Allowlist validation
    if (!ALLOWLISTED_ACTIONS.has(existing.actionType as ApprovalActionType)) {
      throw new Error(
        `Action type "${existing.actionType}" is not permitted by backend security policy.`,
      );
    }

    // Canonical authenticated actor identity
    const actorIdentity = `${user.name} (${user.email})`;

    // 1. ATOMIC CONCURRENCY LOCK:
    // Transition status to "APPROVED" only if status is currently "PENDING".
    // If a concurrent click occurs, updateCount.count === 0 and the duplicate request throws immediately!
    await prisma.$transaction(async (tx) => {
      const updateCount = await tx.approvalRequest.updateMany({
        where: {
          id: formattedId,
          status: "PENDING",
        },
        data: {
          status: "APPROVED",
          decidedAt: new Date(),
          decidedBy: actorIdentity,
          executionStatus: "NOT_EXECUTED",
        },
      });

      if (updateCount.count === 0) {
        throw new Error(
          `Approval request "${id}" has already been decided (${existing.status}) and cannot be approved again.`,
        );
      }
    });

    // 2. DISPATCH EXTERNAL INTEGRATION
    let executionStatus: "SUCCESS" | "FAILED" = "SUCCESS";
    let executionResult: any = null;
    const args = (existing.arguments as Record<string, any>) || {};

    switch (existing.actionType) {
      case "SEND_INVOICE_REMINDER": {
        // Consequential DeliveryOps Follow-up Dispatch
        if (existing.toolName === "prepare-client-followup") {
          let emailRes: any;
          try {
            emailRes = await emailService.sendClientFollowup({
              approvalId: formattedId,
              to: args.recipientEmail || args.recipient || args.to || "client@cynbit.com",
              subject: args.subject || `Delivery Status Follow-up: ${existing.customer}`,
              message: args.message || args.body || "Project delivery status follow-up.",
              customer: existing.customer,
              project: args.projectName || args.project,
            });
          } catch (dispatchErr: any) {
            emailRes = {
              success: false,
              simulated: false,
              provider: emailService.getProviderName(),
              idempotencyKey: `bizops-apr-${formattedId.toLowerCase()}`,
              timestamp: new Date().toISOString(),
              error: {
                code: "PROVIDER_ERROR",
                message: dispatchErr?.message || "Failed to dispatch client follow-up email.",
              },
            };
          }

          executionStatus = emailRes.success ? "SUCCESS" : "FAILED";
          executionResult = {
            action: "SEND_CLIENT_FOLLOWUP",
            simulated: emailRes.simulated,
            mode: emailRes.simulated
              ? "DEMO_SIMULATION"
              : emailRes.success
              ? "PRODUCTION_INTEGRATION"
              : "FAILED",
            provider: emailRes.provider,
            messageId: emailRes.messageId,
            idempotencyKey: emailRes.idempotencyKey,
            executedAt: emailRes.timestamp,
            customer: existing.customer,
            project: args.projectName || args.project,
            subject: args.subject,
            recipient: args.recipientEmail || args.recipient || args.to,
            error: emailRes.error,
            message: emailRes.success
              ? emailRes.simulated
                ? `Simulated client follow-up email successfully prepared and recorded for ${existing.customer}.`
                : `Client follow-up email successfully dispatched via ${emailRes.provider} for ${existing.customer}.`
              : `Client follow-up delivery failed via ${emailRes.provider}: ${emailRes.error?.message}`,
          };
          break;
        }

        const targetInvoices = args.invoices || [
          {
            invoiceNumber: existing.relatedInvoiceId || "INV-UNKNOWN",
            clientName: existing.customer,
            clientCompany: existing.customer,
            amount: existing.amount || "₹0",
            dueDate: "Past Due",
          },
        ];

        let emailRes: any;
        try {
          emailRes = await emailService.sendInvoiceReminder({
            invoices: targetInvoices,
            approvalId: formattedId,
            customer: existing.customer,
            recipientEmail: args.recipientEmail || args.recipient || undefined,
          });
        } catch (dispatchErr: any) {
          emailRes = {
            success: false,
            simulated: false,
            provider: emailService.getProviderName(),
            idempotencyKey: `bizops-apr-${formattedId.toLowerCase()}`,
            timestamp: new Date().toISOString(),
            error: {
              code: "PROVIDER_ERROR",
              message: dispatchErr?.message || "Failed to dispatch email due to provider error.",
            },
          };
        }

        executionStatus = emailRes.success ? "SUCCESS" : "FAILED";
        executionResult = {
          action: "SEND_INVOICE_REMINDER",
          simulated: emailRes.simulated,
          mode: emailRes.simulated
            ? "DEMO_SIMULATION"
            : emailRes.success
            ? "PRODUCTION_INTEGRATION"
            : "FAILED",
          provider: emailRes.provider,
          messageId: emailRes.messageId,
          idempotencyKey: emailRes.idempotencyKey,
          executedAt: emailRes.timestamp,
          targetInvoices,
          customer: existing.customer,
          amount: existing.amount,
          error: emailRes.error,
          message: emailRes.success
            ? emailRes.simulated
              ? `Simulated overdue payment reminder successfully prepared and recorded for ${existing.customer}.`
              : `Overdue payment reminder successfully dispatched via ${emailRes.provider} for ${existing.customer}.`
            : `Email delivery failed via ${emailRes.provider}: ${emailRes.error?.message}`,
        };
        break;
      }

      case "REFUND_PAYMENT": {
        executionResult = {
          action: "REFUND_PAYMENT",
          simulated: true,
          mode: "DEMO_SIMULATION",
          executedAt: new Date().toISOString(),
          paymentId: args.paymentId || "PAY-UNKNOWN",
          amount: existing.amount || "₹25,000",
          customer: existing.customer,
          message: `Simulated refund of ${existing.amount} for payment ${args.paymentId || ""} processed.`,
        };
        break;
      }

      case "CANCEL_ORDER": {
        executionResult = {
          action: "CANCEL_ORDER",
          simulated: true,
          mode: "DEMO_SIMULATION",
          executedAt: new Date().toISOString(),
          orderId: args.orderId || "ORD-UNKNOWN",
          customer: existing.customer,
          message: `Simulated cancellation for order ${args.orderId || ""} recorded.`,
        };
        break;
      }

      default: {
        throw new Error(`Unsupported action type: ${existing.actionType}`);
      }
    }

    // 3. PERSIST EXECUTION RESULT & AUDIT EVENT
    const updated = await prisma.$transaction(async (tx) => {
      await tx.approvalRequest.update({
        where: { id: formattedId },
        data: {
          executionStatus,
          executionResult,
        },
      });

      await tx.auditEvent.create({
        data: {
          approvalRequestId: formattedId,
          eventType:
            executionStatus === "SUCCESS"
              ? "DECISION_APPROVED"
              : "DECISION_APPROVED_EXECUTION_FAILED",
          actor: actorIdentity,
          payload: {
            action: existing.actionType,
            decidedByUserId: user.id,
            decidedByEmail: user.email,
            decidedByRole: user.role,
            executionStatus,
            executionResult,
          },
        },
      });

      return tx.approvalRequest.findUniqueOrThrow({
        where: { id: formattedId },
      });
    });

    const formatted = formatDbApproval(updated);

    const message =
      executionStatus === "SUCCESS"
        ? executionResult.simulated
          ? `Approval request ${id} approved by ${actorIdentity}. Action successfully executed in simulation mode.`
          : `Approval request ${id} approved by ${actorIdentity}. Action successfully executed via ${executionResult.provider}.`
        : `Approval request ${id} approved by ${actorIdentity}, but external execution failed: ${executionResult.error?.message}`;

    return {
      success: true,
      approval: formatted,
      message,
      executionResult,
    };
  }

  /**
   * Rejects a pending request atomically in a database transaction.
   * Derives actor identity strictly from verified server-side user session.
   * Never executes any tool action.
   */
  public async rejectApproval(
    id: string,
    user: SafeUserProfile,
    reason?: string,
  ): Promise<ApprovalDecisionResult> {
    const formattedId = id.toUpperCase();
    const existing = await prisma.approvalRequest.findUnique({
      where: { id: formattedId },
    });

    if (!existing) {
      throw new Error(`Approval request with ID "${id}" was not found.`);
    }

    if (existing.status !== "PENDING") {
      throw new Error(
        `Approval request "${id}" has already been decided (${existing.status}) and cannot be rejected again.`,
      );
    }

    const actorIdentity = `${user.name} (${user.email})`;

    const rejectionPayload = {
      rejectionReason: reason || "Rejected by authorized reviewer.",
      decidedByUserId: user.id,
      decidedByEmail: user.email,
      decidedByRole: user.role,
      timestamp: new Date().toISOString(),
    };

    // Atomic update guarded by status: "PENDING"
    const updated = await prisma.$transaction(async (tx) => {
      const updateCount = await tx.approvalRequest.updateMany({
        where: {
          id: formattedId,
          status: "PENDING",
        },
        data: {
          status: "REJECTED",
          decidedAt: new Date(),
          decidedBy: actorIdentity,
          executionStatus: "NOT_EXECUTED",
          executionResult: rejectionPayload,
        },
      });

      if (updateCount.count === 0) {
        throw new Error(
          `Approval request "${id}" has already been decided (${existing.status}) and cannot be rejected again.`,
        );
      }

      await tx.auditEvent.create({
        data: {
          approvalRequestId: formattedId,
          eventType: "DECISION_REJECTED",
          actor: actorIdentity,
          payload: rejectionPayload,
        },
      });

      return tx.approvalRequest.findUniqueOrThrow({
        where: { id: formattedId },
      });
    });

    const formatted = formatDbApproval(updated);

    return {
      success: true,
      approval: formatted,
      message: `Approval request ${id} rejected by ${actorIdentity}. Proposed action was cancelled.`,
    };
  }
}

export const approvalService = new ApprovalService();
