import { z } from "zod";
import { prisma } from "../lib/prisma.js";

export const ApprovalStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalRiskSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type ApprovalRisk = z.infer<typeof ApprovalRiskSchema>;

export const ApprovalActionTypeSchema = z.enum([
  "SEND_INVOICE_REMINDER",
  "REFUND_PAYMENT",
  "CANCEL_ORDER",
]);
export type ApprovalActionType = z.infer<typeof ApprovalActionTypeSchema>;

export interface ApprovalRequest {
  id: string;
  title: string;
  description: string;
  actionType: ApprovalActionType;
  toolName: string;
  arguments: Record<string, any>;
  reason: string;
  customer: string;
  amount?: string;
  risk: ApprovalRisk;
  relatedInvoiceId?: string;
  relatedCustomerId?: string;
  status: ApprovalStatus;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  executionStatus?: "NOT_EXECUTED" | "SUCCESS" | "FAILED";
  executionResult?: any;
}

export function formatDbApproval(dbRecord: any): ApprovalRequest {
  return {
    id: dbRecord.id,
    title: dbRecord.title,
    description: dbRecord.description,
    actionType: dbRecord.actionType as ApprovalActionType,
    toolName: dbRecord.toolName,
    arguments:
      typeof dbRecord.arguments === "object" && dbRecord.arguments !== null
        ? (dbRecord.arguments as Record<string, any>)
        : {},
    reason: dbRecord.reason,
    customer: dbRecord.customer,
    amount: dbRecord.amount ?? undefined,
    risk: dbRecord.risk as ApprovalRisk,
    relatedInvoiceId: dbRecord.relatedInvoiceId ?? undefined,
    relatedCustomerId: dbRecord.relatedCustomerId ?? undefined,
    status: dbRecord.status as ApprovalStatus,
    createdAt:
      dbRecord.createdAt instanceof Date
        ? dbRecord.createdAt.toISOString()
        : String(dbRecord.createdAt),
    decidedAt: dbRecord.decidedAt
      ? dbRecord.decidedAt instanceof Date
        ? dbRecord.decidedAt.toISOString()
        : String(dbRecord.decidedAt)
      : undefined,
    decidedBy: dbRecord.decidedBy ?? undefined,
    executionStatus:
      (dbRecord.executionStatus as "NOT_EXECUTED" | "SUCCESS" | "FAILED") ??
      "NOT_EXECUTED",
    executionResult: dbRecord.executionResult ?? undefined,
  };
}

export const approvalStore = {
  async getAll(status?: ApprovalStatus): Promise<ApprovalRequest[]> {
    const records = await prisma.approvalRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
    });
    return records.map(formatDbApproval);
  },

  async getById(id: string): Promise<ApprovalRequest | undefined> {
    const record = await prisma.approvalRequest.findUnique({
      where: { id: id.toUpperCase() },
    });
    return record ? formatDbApproval(record) : undefined;
  },

  async create(data: {
    title: string;
    description: string;
    actionType: ApprovalActionType;
    toolName: string;
    arguments: Record<string, any>;
    reason: string;
    customer: string;
    amount?: string;
    risk: ApprovalRisk;
    relatedInvoiceId?: string;
    relatedCustomerId?: string;
    requestedBy?: {
      id: string;
      name: string;
      email: string;
    };
  }): Promise<ApprovalRequest> {
    const record = await prisma.$transaction(async (tx) => {
      // 1. Idempotency safeguard: check if an identical pending approval already exists
      if (data.relatedInvoiceId) {
        const existingPending = await tx.approvalRequest.findFirst({
          where: {
            status: "PENDING",
            actionType: data.actionType,
            relatedInvoiceId: data.relatedInvoiceId,
          },
        });
        if (existingPending) {
          return existingPending;
        }
      }

      // 2. Collision-resistant ID generation: find highest numeric ID
      const existingRecords = await tx.approvalRequest.findMany({
        where: { id: { startsWith: "APR-" } },
        select: { id: true },
      });
      let maxNum = 1000;
      for (const rec of existingRecords) {
        const match = rec.id.match(/^APR-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
      const id = `APR-${maxNum + 1}`;

      const created = await tx.approvalRequest.create({
        data: {
          id,
          title: data.title,
          description: data.description,
          actionType: data.actionType,
          toolName: data.toolName,
          arguments: data.arguments,
          reason: data.reason,
          customer: data.customer,
          amount: data.amount,
          risk: data.risk,
          relatedInvoiceId: data.relatedInvoiceId,
          relatedCustomerId: data.relatedCustomerId,
          status: "PENDING",
          executionStatus: "NOT_EXECUTED",
        },
      });

      const actorLabel = data.requestedBy
        ? `${data.requestedBy.name} (${data.requestedBy.email}) via AI_AGENT`
        : "AI_AGENT";

      await tx.auditEvent.create({
        data: {
          approvalRequestId: created.id,
          eventType: "PROPOSAL_CREATED",
          actor: actorLabel,
          payload: {
            toolName: data.toolName,
            title: data.title,
            actionType: data.actionType,
            arguments: data.arguments,
            requestedByUserId: data.requestedBy?.id,
            requestedByEmail: data.requestedBy?.email,
          },
        },
      });

      return created;
    });

    return formatDbApproval(record);
  },
};
