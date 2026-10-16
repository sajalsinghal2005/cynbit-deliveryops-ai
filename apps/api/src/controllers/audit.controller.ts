import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { auditService } from "../services/audit.service.js";

const listAuditQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
  eventType: z.string().optional(),
  actor: z.string().optional(),
  approvalRequestId: z.string().optional(),
  status: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
});

const idParamSchema = z.object({
  id: z.string().min(1, "Audit event ID is required"),
});

export class AuditController {
  /**
   * Handles GET /api/audit-events
   */
  public async listAuditEvents(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = listAuditQuerySchema.safeParse(request.query);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        message: "Invalid query parameters.",
        errors: parseResult.error.flatten(),
      });
    }

    try {
      const response = await auditService.listAuditEvents(parseResult.data);
      return reply.status(200).send(response);
    } catch (error) {
      request.log.error(error, "Failed to fetch audit events");
      return reply.status(500).send({
        success: false,
        message: "Failed to retrieve audit events from database.",
      });
    }
  }

  /**
   * Handles GET /api/audit-events/:id
   */
  public async getAuditEvent(request: FastifyRequest, reply: FastifyReply) {
    const parseParam = idParamSchema.safeParse(request.params);

    if (!parseParam.success) {
      return reply.status(400).send({
        success: false,
        message: "Invalid audit event ID provided.",
      });
    }

    try {
      const event = await auditService.getAuditEventById(parseParam.data.id);

      if (!event) {
        return reply.status(404).send({
          success: false,
          message: `Audit event "${parseParam.data.id}" was not found.`,
        });
      }

      return reply.status(200).send({
        success: true,
        data: event,
      });
    } catch (error) {
      request.log.error(error, `Failed to retrieve audit event ${parseParam.data.id}`);
      return reply.status(500).send({
        success: false,
        message: "Failed to retrieve audit event from database.",
      });
    }
  }
}

export const auditController = new AuditController();
