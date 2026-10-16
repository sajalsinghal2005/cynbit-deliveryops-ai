import type { FastifyInstance } from "fastify";
import { auditController } from "../controllers/audit.controller.js";
import { authenticate, authorize } from "../middleware/auth.guard.js";

export async function auditRoutes(app: FastifyInstance) {
  // Audit log viewing is restricted strictly to ADMIN and APPROVER governance roles
  app.get(
    "/api/audit-events",
    {
      preHandler: [authenticate, authorize(["ADMIN", "APPROVER"])],
    },
    async (request, reply) => {
      return auditController.listAuditEvents(request, reply);
    },
  );

  app.get(
    "/api/audit-events/:id",
    {
      preHandler: [authenticate, authorize(["ADMIN", "APPROVER"])],
    },
    async (request, reply) => {
      return auditController.getAuditEvent(request, reply);
    },
  );
}
