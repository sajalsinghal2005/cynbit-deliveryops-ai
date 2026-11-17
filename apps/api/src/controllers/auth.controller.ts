import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authService } from "../services/auth.service.js";

export const SESSION_COOKIE_NAME = "bizops_session";
export const CSRF_COOKIE_NAME = "bizops_csrf";

/**
 * Returns security-hardened cookie configuration:
 * In production or over HTTPS, uses SameSite=None + Secure for cross-origin SPA compatibility.
 * In local development, uses SameSite=Lax for standard local browsing.
 */
export function getCookieSecurityOptions(request?: FastifyRequest) {
  const isHttps = Boolean(
    request &&
      ((request.headers["x-forwarded-proto"] as string) === "https" ||
        request.protocol === "https")
  );
  const isProd =
    process.env.NODE_ENV === "production" ||
    process.env.RENDER === "true" ||
    process.env.VERCEL === "1" ||
    isHttps;

  return {
    path: "/",
    secure: isProd,
    sameSite: isProd ? ("none" as const) : ("lax" as const),
  };
}

const loginBodySchema = z.object({
  email: z
    .string({
      error: "Email is required",
    })
    .trim()
    .email("Invalid email address format.")
    .max(255),
  password: z
    .string({
      error: "Password is required",
    })
    .min(1, "Password is required.")
    .max(255),
});

export class AuthController {
  /**
   * Handles POST /api/auth/login
   */
  public async login(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = loginBodySchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        message:
          parseResult.error.issues[0]?.message || "Invalid login credentials provided.",
      });
    }

    const ipAddress =
      (request.headers["x-forwarded-for"] as string) ||
      request.socket.remoteAddress ||
      "UNKNOWN";
    const userAgent = request.headers["user-agent"] || "UNKNOWN";

    const result = await authService.login({
      email: parseResult.data.email,
      password: parseResult.data.password,
      ipAddress,
      userAgent,
    });

    if (!result.success || !result.sessionToken) {
      return reply.status(401).send({
        success: false,
        message: result.message || "Invalid email or password.",
      });
    }

    const cookieOpts = getCookieSecurityOptions(request);

    // Set secure HTTP-Only session cookie
    reply.setCookie(SESSION_COOKIE_NAME, result.sessionToken, {
      ...cookieOpts,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    // Set CSRF token cookie accessible to frontend client for double-submit header
    if (result.csrfToken) {
      reply.setCookie(CSRF_COOKIE_NAME, result.csrfToken, {
        ...cookieOpts,
        httpOnly: false,
        maxAge: 7 * 24 * 60 * 60,
      });
    }

    return reply.status(200).send({
      success: true,
      user: result.user,
      csrfToken: result.csrfToken,
      message: "Login successful.",
    });
  }

  /**
   * Handles POST /api/auth/logout
   */
  public async logout(request: FastifyRequest, reply: FastifyReply) {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const ipAddress =
      (request.headers["x-forwarded-for"] as string) ||
      request.socket.remoteAddress;

    if (sessionToken) {
      await authService.logout(sessionToken, ipAddress);
    }

    const cookieOpts = getCookieSecurityOptions(request);

    // Clear session and CSRF cookies
    reply.clearCookie(SESSION_COOKIE_NAME, {
      ...cookieOpts,
      httpOnly: true,
    });

    reply.clearCookie(CSRF_COOKIE_NAME, {
      ...cookieOpts,
      httpOnly: false,
    });

    return reply.status(200).send({
      success: true,
      message: "Logged out successfully.",
    });
  }

  /**
   * Handles GET /api/auth/me
   * Validates active session and ensures client retains matching CSRF token and cookie.
   */
  public async getMe(request: FastifyRequest, reply: FastifyReply) {
    const sessionToken =
      request.cookies[SESSION_COOKIE_NAME] ||
      (request.headers.authorization?.startsWith("Bearer ")
        ? request.headers.authorization.slice(7)
        : undefined);

    if (!sessionToken) {
      return reply.status(401).send({
        success: false,
        message: "Not authenticated.",
      });
    }

    const user = await authService.getCurrentUser(sessionToken);

    if (!user) {
      const cookieOpts = getCookieSecurityOptions(request);
      reply.clearCookie(SESSION_COOKIE_NAME, {
        ...cookieOpts,
        httpOnly: true,
      });
      reply.clearCookie(CSRF_COOKIE_NAME, {
        ...cookieOpts,
        httpOnly: false,
      });

      return reply.status(401).send({
        success: false,
        message: "Session expired or invalid. Please log in again.",
      });
    }

    let csrfToken = request.cookies[CSRF_COOKIE_NAME];
    const cookieOpts = getCookieSecurityOptions(request);

    // If CSRF cookie is missing or was partitioned, issue a fresh one
    if (!csrfToken) {
      csrfToken = authService.generateCsrfToken();
      reply.setCookie(CSRF_COOKIE_NAME, csrfToken, {
        ...cookieOpts,
        httpOnly: false,
        maxAge: 7 * 24 * 60 * 60,
      });
    }

    return reply.status(200).send({
      success: true,
      user,
      csrfToken,
    });
  }

  /**
   * Handles GET /api/auth/csrf
   * Provides on-demand CSRF token acquisition/refresh for client double-submit headers.
   */
  public async getCsrf(request: FastifyRequest, reply: FastifyReply) {
    let csrfToken = request.cookies[CSRF_COOKIE_NAME];
    const cookieOpts = getCookieSecurityOptions(request);

    if (!csrfToken) {
      csrfToken = authService.generateCsrfToken();
      reply.setCookie(CSRF_COOKIE_NAME, csrfToken, {
        ...cookieOpts,
        httpOnly: false,
        maxAge: 7 * 24 * 60 * 60,
      });
    }

    return reply.status(200).send({
      success: true,
      csrfToken,
    });
  }
}

export const authController = new AuthController();
