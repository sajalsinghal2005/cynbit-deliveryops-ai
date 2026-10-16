import type { FastifyInstance } from "fastify";
import { approvalController } from "../controllers/approval.controller.js";
import {
  authenticate,
  authorize,
  verifyCsrf,
} from "../middleware/auth.guard.js";

export async function approvalRoutes(app: FastifyInstance) {
  // Reading approvals is allowed for all authenticated business roles (ADMIN, OPERATOR, APPROVER)
  app.get(
    "/api/approvals",
    {
      preHandler: [authenticate, authorize(["ADMIN", "OPERATOR", "APPROVER"])],
    },
    async (request, reply) => {
      return approvalController.listApprovals(request, reply);
    },
  );

  app.get(
    "/api/approvals/:id",
    {
      preHandler: [authenticate, authorize(["ADMIN", "OPERATOR", "APPROVER"])],
    },
    async (request, reply) => {
      return approvalController.getApproval(request, reply);
    },
  );

  // Authorizing (approving) pending critical actions is restricted strictly to ADMIN and APPROVER roles
  app.post(
    "/api/approvals/:id/approve",
    {
      preHandler: [
        authenticate,
        authorize(["ADMIN", "APPROVER"]),
        verifyCsrf,
      ],
    },
    async (request, reply) => {
      return approvalController.approve(request, reply);
    },
  );

  // Rejecting pending critical actions is restricted strictly to ADMIN and APPROVER roles
  app.post(
    "/api/approvals/:id/reject",
    {
      preHandler: [
        authenticate,
        authorize(["ADMIN", "APPROVER"]),
        verifyCsrf,
      ],
    },
    async (request, reply) => {
      return approvalController.reject(request, reply);
    },
  );
}
