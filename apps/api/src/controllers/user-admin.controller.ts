import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { userAdminService, AdminUserError } from "../services/user-admin.service.js";

const SESSION_COOKIE_NAME = "bizops_session";

// Zod Validation Schemas
const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().optional(),
  role: z.enum(["ALL", "ADMIN", "OPERATOR", "APPROVER"]).default("ALL"),
  status: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
});

const idParamSchema = z.object({
  id: z.string().min(1, "User ID is required"),
});

const sessionParamSchema = z.object({
  id: z.string().min(1, "User ID is required"),
  sessionId: z.string().min(1, "Session ID is required"),
});

const createUserBodySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z
    .string()
    .trim()
    .email("Invalid email address format")
    .max(255),
  role: z.enum(["ADMIN", "OPERATOR", "APPROVER"]),
  temporaryPassword: z
    .string()
    .min(8, "Temporary password must be at least 8 characters")
    .max(100)
    .optional(),
});

const updateUserBodySchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100).optional(),
    role: z.enum(["ADMIN", "OPERATOR", "APPROVER"]).optional(),
  })
  .refine((data) => data.name !== undefined || data.role !== undefined, {
    message: "At least one field (name or role) must be provided for update",
  });

const setStatusBodySchema = z.object({
  isActive: z.boolean({
    error: "isActive status boolean is required",
  }),
});

const resetPasswordBodySchema = z.object({
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(100)
    .optional(),
  revokeSessions: z.boolean().default(true),
});

const revokeAllSessionsQuerySchema = z.object({
  keepCurrentSession: z.coerce.boolean().optional(),
});

export class UserAdminController {
  private getSessionToken(request: FastifyRequest): string | undefined {
    return (
      request.cookies[SESSION_COOKIE_NAME] ||
      (request.headers.authorization?.startsWith("Bearer ")
        ? request.headers.authorization.slice(7)
        : undefined)
    );
  }

  /**
   * 1. GET /api/admin/users
   */
  public async listUsers(request: FastifyRequest, reply: FastifyReply) {
    const parseQuery = listUsersQuerySchema.safeParse(request.query);
    if (!parseQuery.success) {
      return reply.status(400).send({
        success: false,
        message: parseQuery.error.issues[0]?.message || "Invalid query parameters.",
      });
    }

    try {
      const result = await userAdminService.listUsers(parseQuery.data);
      return reply.status(200).send({
        success: true,
        ...result,
      });
    } catch (error) {
      return this.handleError(reply, error, "Failed to list users.");
    }
  }

  /**
   * GET /api/admin/users/:id
   */
  public async getUser(request: FastifyRequest, reply: FastifyReply) {
    const parseParam = idParamSchema.safeParse(request.params);
    if (!parseParam.success) {
      return reply.status(400).send({
        success: false,
        message: parseParam.error.issues[0]?.message || "Invalid user ID.",
      });
    }

    try {
      const user = await userAdminService.getUserById(parseParam.data.id);
      return reply.status(200).send({
        success: true,
        user,
      });
    } catch (error) {
      return this.handleError(reply, error, "Failed to retrieve user.");
    }
  }

  /**
   * 2. POST /api/admin/users
   */
  public async createUser(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        message: "Authentication required.",
      });
    }

    const parseBody = createUserBodySchema.safeParse(request.body);
    if (!parseBody.success) {
      return reply.status(400).send({
        success: false,
        message: parseBody.error.issues[0]?.message || "Invalid user input.",
      });
    }

    try {
      const result = await userAdminService.createUser(request.user, parseBody.data);
      return reply.status(201).send({
        success: true,
        user: result.user,
        temporaryPassword: result.temporaryPassword,
        message: "User created successfully.",
      });
    } catch (error) {
      return this.handleError(reply, error, "Failed to create user.");
    }
  }

  /**
   * 3. PATCH /api/admin/users/:id
   */
  public async updateUser(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        message: "Authentication required.",
      });
    }

    const parseParam = idParamSchema.safeParse(request.params);
    if (!parseParam.success) {
      return reply.status(400).send({
        success: false,
        message: parseParam.error.issues[0]?.message || "Invalid user ID.",
      });
    }

    const parseBody = updateUserBodySchema.safeParse(request.body);
    if (!parseBody.success) {
      return reply.status(400).send({
        success: false,
        message: parseBody.error.issues[0]?.message || "Invalid update data.",
      });
    }

    try {
      const user = await userAdminService.updateUser(
        request.user,
        parseParam.data.id,
        parseBody.data
      );
      return reply.status(200).send({
        success: true,
        user,
        message: "User profile updated successfully.",
      });
    } catch (error) {
      return this.handleError(reply, error, "Failed to update user.");
    }
  }

  /**
   * 4. PATCH /api/admin/users/:id/status
   */
  public async setUserStatus(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        message: "Authentication required.",
      });
    }

    const parseParam = idParamSchema.safeParse(request.params);
    if (!parseParam.success) {
      return reply.status(400).send({
        success: false,
        message: parseParam.error.issues[0]?.message || "Invalid user ID.",
      });
    }

    const parseBody = setStatusBodySchema.safeParse(request.body);
    if (!parseBody.success) {
      return reply.status(400).send({
        success: false,
        message: parseBody.error.issues[0]?.message || "Invalid status payload.",
      });
    }

    try {
      const result = await userAdminService.setUserStatus(
        request.user,
        parseParam.data.id,
        parseBody.data.isActive
      );
      return reply.status(200).send({
        success: true,
        user: result.user,
        sessionsRevoked: result.sessionsRevoked,
        message: result.user.isActive
          ? "User account activated successfully."
          : `User account deactivated and ${result.sessionsRevoked} active session(s) revoked.`,
      });
    } catch (error) {
      return this.handleError(reply, error, "Failed to change user status.");
    }
  }

  /**
   * 5. POST /api/admin/users/:id/reset-password
   */
  public async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        message: "Authentication required.",
      });
    }

    const parseParam = idParamSchema.safeParse(request.params);
    if (!parseParam.success) {
      return reply.status(400).send({
        success: false,
        message: parseParam.error.issues[0]?.message || "Invalid user ID.",
      });
    }

    const parseBody = resetPasswordBodySchema.safeParse(request.body || {});
    if (!parseBody.success) {
      return reply.status(400).send({
        success: false,
        message: parseBody.error.issues[0]?.message || "Invalid password payload.",
      });
    }

    const currentSessionToken = this.getSessionToken(request);

    try {
      const result = await userAdminService.resetPassword(
        request.user,
        parseParam.data.id,
        {
          newPassword: parseBody.data.newPassword,
          revokeSessions: parseBody.data.revokeSessions,
          currentSessionToken,
        }
      );

      return reply.status(200).send({
        success: true,
        temporaryPassword: result.temporaryPassword,
        sessionsRevoked: result.sessionsRevoked,
        message: "Password reset successfully. Active sessions revoked.",
      });
    } catch (error) {
      return this.handleError(reply, error, "Failed to reset password.");
    }
  }

  /**
   * 6. GET /api/admin/users/:id/sessions
   */
  public async listUserSessions(request: FastifyRequest, reply: FastifyReply) {
    const parseParam = idParamSchema.safeParse(request.params);
    if (!parseParam.success) {
      return reply.status(400).send({
        success: false,
        message: parseParam.error.issues[0]?.message || "Invalid user ID.",
      });
    }

    const currentSessionToken = this.getSessionToken(request);

    try {
      const sessions = await userAdminService.listUserSessions(
        parseParam.data.id,
        currentSessionToken
      );
      return reply.status(200).send({
        success: true,
        count: sessions.length,
        sessions,
      });
    } catch (error) {
      return this.handleError(reply, error, "Failed to list user sessions.");
    }
  }

  /**
   * 7. DELETE /api/admin/users/:id/sessions/:sessionId
   */
  public async revokeSession(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        message: "Authentication required.",
      });
    }

    const parseParam = sessionParamSchema.safeParse(request.params);
    if (!parseParam.success) {
      return reply.status(400).send({
        success: false,
        message: parseParam.error.issues[0]?.message || "Invalid parameters.",
      });
    }

    const currentSessionToken = this.getSessionToken(request);

    try {
      const result = await userAdminService.revokeSession(
        request.user,
        parseParam.data.id,
        parseParam.data.sessionId,
        currentSessionToken
      );

      return reply.status(200).send({
        success: true,
        isCurrentSession: result.isCurrentSession,
        message: "Session revoked successfully.",
      });
    } catch (error) {
      return this.handleError(reply, error, "Failed to revoke session.");
    }
  }

  /**
   * 8. DELETE /api/admin/users/:id/sessions
   */
  public async revokeAllSessions(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        message: "Authentication required.",
      });
    }

    const parseParam = idParamSchema.safeParse(request.params);
    if (!parseParam.success) {
      return reply.status(400).send({
        success: false,
        message: parseParam.error.issues[0]?.message || "Invalid user ID.",
      });
    }

    const parseQuery = revokeAllSessionsQuerySchema.safeParse(request.query);
    const keepCurrent = parseQuery.success ? parseQuery.data.keepCurrentSession : undefined;
    const currentSessionToken = this.getSessionToken(request);

    try {
      const result = await userAdminService.revokeAllSessions(
        request.user,
        parseParam.data.id,
        {
          keepCurrentSession: keepCurrent,
          currentSessionToken,
        }
      );

      return reply.status(200).send({
        success: true,
        count: result.count,
        preservedCurrentSession: result.preservedCurrentSession,
        message: `Revoked ${result.count} active session(s).`,
      });
    } catch (error) {
      return this.handleError(reply, error, "Failed to revoke sessions.");
    }
  }

  private handleError(reply: FastifyReply, error: unknown, fallbackMessage: string) {
    if (error instanceof AdminUserError) {
      return reply.status(error.statusCode).send({
        success: false,
        message: error.message,
      });
    }

    // Handle Prisma unique constraint error (e.g. concurrent duplicate email race)
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as any).code === "P2002"
    ) {
      return reply.status(409).send({
        success: false,
        message: "A user account with this email already exists.",
      });
    }

    const message = error instanceof Error ? error.message : fallbackMessage;
    return reply.status(500).send({
      success: false,
      message,
    });
  }
}

export const userAdminController = new UserAdminController();
