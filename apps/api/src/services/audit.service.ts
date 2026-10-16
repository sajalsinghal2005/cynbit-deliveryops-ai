import { prisma } from "../lib/prisma.js";
import type { Prisma } from "@prisma/client";

export interface AuditEventFilterParams {
  page?: number;
  limit?: number;
  eventType?: string;
  actor?: string;
  approvalRequestId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface SanitizedAuditEvent {
  id: string;
  approvalRequestId: string | null;
  eventType: string;
  actor: string;
  payload: Record<string, any>;
  timestamp: string;
  approvalRequest?: {
    id: string;
    title: string;
    description: string;
    actionType: string;
    toolName: string;
    customer: string;
    amount: string | null;
    risk: string;
    status: string;
    executionStatus: string;
    relatedInvoiceId: string | null;
    relatedCustomerId: string | null;
    decidedBy: string | null;
    decidedAt: string | null;
    createdAt: string;
  } | null;
}

export interface AuditEventsResponse {
  success: boolean;
  data: SanitizedAuditEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  stats: {
    total: number;
    approved: number;
    rejected: number;
    proposals: number;
  };
}

/**
 * Strips any sensitive properties such as secrets, keys, or private credentials
 * to ensure raw payloads remain strictly secure and read-only.
 */
function sanitizePayload(raw: unknown): Record<string, any> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { data: raw };
  }

  const sensitiveKeys = new Set([
    "password",
    "secret",
    "apikey",
    "api_key",
    "token",
    "authorization",
    "creditcard",
    "cvv",
  ]);

  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(raw as Record<string, any>)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizePayload(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export class AuditService {
  /**
   * Retrieves paginated, sorted, and filtered audit records directly from PostgreSQL
   * without mutating or creating any records.
   */
  public async listAuditEvents(
    params: AuditEventFilterParams = {},
  ): Promise<AuditEventsResponse> {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.AuditEventWhereInput = {};

    // Filter by Event Type
    if (params.eventType && params.eventType.trim() !== "") {
      where.eventType = {
        equals: params.eventType.trim(),
        mode: "insensitive",
      };
    }

    // Filter by Actor
    if (params.actor && params.actor.trim() !== "") {
      where.actor = {
        contains: params.actor.trim(),
        mode: "insensitive",
      };
    }

    // Filter by Approval Request ID
    if (params.approvalRequestId && params.approvalRequestId.trim() !== "") {
      where.approvalRequestId = {
        equals: params.approvalRequestId.trim().toUpperCase(),
      };
    }

    // Filter by Date Range
    if (params.startDate || params.endDate) {
      where.timestamp = {};
      if (params.startDate) {
        const start = new Date(params.startDate);
        if (!isNaN(start.getTime())) {
          where.timestamp.gte = start;
        }
      }
      if (params.endDate) {
        const end = new Date(params.endDate);
        if (!isNaN(end.getTime())) {
          where.timestamp.lte = end;
        }
      }
    }

    // Search query across actor, eventType, approvalRequestId, or approvalRequest fields
    if (params.search && params.search.trim() !== "") {
      const q = params.search.trim();
      where.OR = [
        { actor: { contains: q, mode: "insensitive" } },
        { eventType: { contains: q, mode: "insensitive" } },
        { approvalRequestId: { contains: q, mode: "insensitive" } },
        {
          approvalRequest: {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { customer: { contains: q, mode: "insensitive" } },
              { toolName: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    // Filter by status on related ApprovalRequest if provided
    if (params.status && params.status.trim() !== "") {
      const normalizedStatus = params.status.trim().toUpperCase();
      if (
        normalizedStatus === "APPROVED" ||
        normalizedStatus === "REJECTED" ||
        normalizedStatus === "PENDING"
      ) {
        where.approvalRequest = {
          ...((where.approvalRequest as any) || {}),
          status: normalizedStatus as any,
        };
      }
    }

    // Fetch records and total count concurrently
    const [records, total, approvedCount, rejectedCount, proposalCount] =
      await Promise.all([
        prisma.auditEvent.findMany({
          where,
          include: {
            approvalRequest: {
              select: {
                id: true,
                title: true,
                description: true,
                actionType: true,
                toolName: true,
                customer: true,
                amount: true,
                risk: true,
                status: true,
                executionStatus: true,
                relatedInvoiceId: true,
                relatedCustomerId: true,
                decidedBy: true,
                decidedAt: true,
                createdAt: true,
              },
            },
          },
          orderBy: { timestamp: "desc" },
          skip,
          take: limit,
        }),
        prisma.auditEvent.count({ where }),
        prisma.auditEvent.count({ where: { eventType: "DECISION_APPROVED" } }),
        prisma.auditEvent.count({ where: { eventType: "DECISION_REJECTED" } }),
        prisma.auditEvent.count({ where: { eventType: "PROPOSAL_CREATED" } }),
      ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    const sanitizedData: SanitizedAuditEvent[] = records.map((record) => {
      const appReq = record.approvalRequest;
      return {
        id: record.id,
        approvalRequestId: record.approvalRequestId,
        eventType: record.eventType,
        actor: record.actor,
        payload: sanitizePayload(record.payload),
        timestamp:
          record.timestamp instanceof Date
            ? record.timestamp.toISOString()
            : String(record.timestamp),
        approvalRequest: appReq
          ? {
              id: appReq.id,
              title: appReq.title,
              description: appReq.description,
              actionType: String(appReq.actionType),
              toolName: appReq.toolName,
              customer: appReq.customer,
              amount: appReq.amount,
              risk: String(appReq.risk),
              status: String(appReq.status),
              executionStatus: String(appReq.executionStatus),
              relatedInvoiceId: appReq.relatedInvoiceId,
              relatedCustomerId: appReq.relatedCustomerId,
              decidedBy: appReq.decidedBy,
              decidedAt: appReq.decidedAt
                ? appReq.decidedAt.toISOString()
                : null,
              createdAt: appReq.createdAt.toISOString(),
            }
          : null,
      };
    });

    return {
      success: true,
      data: sanitizedData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      stats: {
        total: approvedCount + rejectedCount + proposalCount,
        approved: approvedCount,
        rejected: rejectedCount,
        proposals: proposalCount,
      },
    };
  }

  /**
   * Retrieves a single audit record by its ID.
   */
  public async getAuditEventById(
    id: string,
  ): Promise<SanitizedAuditEvent | null> {
    const record = await prisma.auditEvent.findUnique({
      where: { id },
      include: {
        approvalRequest: {
          select: {
            id: true,
            title: true,
            description: true,
            actionType: true,
            toolName: true,
            customer: true,
            amount: true,
            risk: true,
            status: true,
            executionStatus: true,
            relatedInvoiceId: true,
            relatedCustomerId: true,
            decidedBy: true,
            decidedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!record) return null;

    const appReq = record.approvalRequest;
    return {
      id: record.id,
      approvalRequestId: record.approvalRequestId,
      eventType: record.eventType,
      actor: record.actor,
      payload: sanitizePayload(record.payload),
      timestamp:
        record.timestamp instanceof Date
          ? record.timestamp.toISOString()
          : String(record.timestamp),
      approvalRequest: appReq
        ? {
            id: appReq.id,
            title: appReq.title,
            description: appReq.description,
            actionType: String(appReq.actionType),
            toolName: appReq.toolName,
            customer: appReq.customer,
            amount: appReq.amount,
            risk: String(appReq.risk),
            status: String(appReq.status),
            executionStatus: String(appReq.executionStatus),
            relatedInvoiceId: appReq.relatedInvoiceId,
            relatedCustomerId: appReq.relatedCustomerId,
            decidedBy: appReq.decidedBy,
            decidedAt: appReq.decidedAt ? appReq.decidedAt.toISOString() : null,
            createdAt: appReq.createdAt.toISOString(),
          }
        : null,
    };
  }
}

export const auditService = new AuditService();
