import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "@prisma/client";
import { authService, type SafeUserProfile } from "../services/auth.service.js";

const SESSION_COOKIE_NAME = "bizops_session";
const CSRF_COOKIE_NAME = "bizops_csrf";

/**
 * Fastify preHandler hook: Authenticates request by validating session cookie or Bearer token.
 * Rejects with 401 Unauthorized for missing, invalid, expired, revoked, or disabled users.
 * Attaches validated, typed user identity strictly to request.user.
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const sessionToken =
    request.cookies[SESSION_COOKIE_NAME] ||
    (request.headers.authorization?.startsWith("Bearer ")
      ? request.headers.authorization.slice(7)
      : undefined);

  if (!sessionToken) {
    return reply.status(401).send({
      success: false,
      code: "UNAUTHORIZED",
      message: "Authentication required. Please log in.",
      requestId: request.id,
    });
  }

  const user = await authService.getCurrentUser(sessionToken);

  if (!user) {
    // Clear stale cookies if present
    if (request.cookies[SESSION_COOKIE_NAME]) {
      reply.clearCookie(SESSION_COOKIE_NAME, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
      reply.clearCookie(CSRF_COOKIE_NAME, {
        path: "/",
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
    }

    return reply.status(401).send({
      success: false,
      code: "UNAUTHORIZED",
      message: "Session is invalid, expired, or user is disabled.",
      requestId: request.id,
    });
  }

  request.user = user;
}

/**
 * Fastify preHandler hook generator: Authorizes request against allowed UserRole permissions.
 * Returns 403 Forbidden if user lacks required role.
 */
export function authorize(allowedRoles: UserRole[]) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        code: "UNAUTHORIZED",
        message: "Authentication required.",
        requestId: request.id,
      });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({
        success: false,
        code: "FORBIDDEN",
        message: `Access denied. Action requires ${allowedRoles.join(" or ")} role.`,
        requestId: request.id,
      });
    }
  };
}

/**
 * Fastify preHandler hook: Validates CSRF token on mutating cookie-authenticated requests.
 */
export async function verifyCsrf(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // If request uses cookie authentication, enforce CSRF protection
  if (request.cookies[SESSION_COOKIE_NAME]) {
    const csrfCookie = request.cookies[CSRF_COOKIE_NAME];
    const csrfHeader = request.headers["x-csrf-token"];

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return reply.status(403).send({
        success: false,
        code: "FORBIDDEN",
        message: "Invalid or missing CSRF token.",
        requestId: request.id,
      });
    }
  }
}
