import type { FastifyInstance } from "fastify";
import { userAdminController } from "../controllers/user-admin.controller.js";
import {
  authenticate,
  authorize,
  verifyCsrf,
} from "../middleware/auth.guard.js";

export async function userAdminRoutes(app: FastifyInstance) {
  // PreHandlers
  const adminGuard = [authenticate, authorize(["ADMIN"])];
  const adminMutationGuard = [authenticate, authorize(["ADMIN"]), verifyCsrf];

  // 1. List Users
  app.get(
    "/api/admin/users",
    {
      preHandler: adminGuard,
    },
    async (request, reply) => {
      return userAdminController.listUsers(request, reply);
    }
  );

  // 2. Get Single User Details
  app.get(
    "/api/admin/users/:id",
    {
      preHandler: adminGuard,
    },
    async (request, reply) => {
      return userAdminController.getUser(request, reply);
    }
  );

  // 3. Create User
  app.post(
    "/api/admin/users",
    {
      preHandler: adminMutationGuard,
    },
    async (request, reply) => {
      return userAdminController.createUser(request, reply);
    }
  );

  // 4. Update User Details / Role
  app.patch(
    "/api/admin/users/:id",
    {
      preHandler: adminMutationGuard,
    },
    async (request, reply) => {
      return userAdminController.updateUser(request, reply);
    }
  );

  // 5. Activate or Deactivate Account
  app.patch(
    "/api/admin/users/:id/status",
    {
      preHandler: adminMutationGuard,
    },
    async (request, reply) => {
      return userAdminController.setUserStatus(request, reply);
    }
  );

  // 6. Reset Password
  app.post(
    "/api/admin/users/:id/reset-password",
    {
      preHandler: adminMutationGuard,
    },
    async (request, reply) => {
      return userAdminController.resetPassword(request, reply);
    }
  );

  // 7. List User Active Sessions
  app.get(
    "/api/admin/users/:id/sessions",
    {
      preHandler: adminGuard,
    },
    async (request, reply) => {
      return userAdminController.listUserSessions(request, reply);
    }
  );

  // 8. Revoke Specific Session
  app.delete(
    "/api/admin/users/:id/sessions/:sessionId",
    {
      preHandler: adminMutationGuard,
    },
    async (request, reply) => {
      return userAdminController.revokeSession(request, reply);
    }
  );

  // 9. Revoke All Sessions for User
  app.delete(
    "/api/admin/users/:id/sessions",
    {
      preHandler: adminMutationGuard,
    },
    async (request, reply) => {
      return userAdminController.revokeAllSessions(request, reply);
    }
  );
}
