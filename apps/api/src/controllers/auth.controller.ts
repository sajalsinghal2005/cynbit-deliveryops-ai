import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authService } from "../services/auth.service.js";

const SESSION_COOKIE_NAME = "bizops_session";
const CSRF_COOKIE_NAME = "bizops_csrf";

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

    const isProd = process.env.NODE_ENV === "production";

    // Set secure HTTP-Only session cookie
    reply.setCookie(SESSION_COOKIE_NAME, result.sessionToken, {
      path: "/",
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    // Set CSRF token cookie accessible to frontend client for double-submit header
    if (result.csrfToken) {
      reply.setCookie(CSRF_COOKIE_NAME, result.csrfToken, {
        path: "/",
        httpOnly: false,
        secure: isProd,
        sameSite: "lax",
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
    // CSRF verification for mutating logout request
    const csrfCookie = request.cookies[CSRF_COOKIE_NAME];
    const csrfHeader = request.headers["x-csrf-token"];

    if (request.cookies[SESSION_COOKIE_NAME]) {
      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        return reply.status(403).send({
          success: false,
          message: "Invalid or missing CSRF token.",
        });
      }
    }

    const sessionToken = request.cookies[SESSION_COOKIE_NAME];
    const ipAddress =
      (request.headers["x-forwarded-for"] as string) ||
      request.socket.remoteAddress;

    await authService.logout(sessionToken, ipAddress);

    const isProd = process.env.NODE_ENV === "production";

    // Clear session and CSRF cookies
    reply.clearCookie(SESSION_COOKIE_NAME, {
      path: "/",
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
    });

    reply.clearCookie(CSRF_COOKIE_NAME, {
      path: "/",
      httpOnly: false,
      secure: isProd,
      sameSite: "lax",
    });

    return reply.status(200).send({
      success: true,
      message: "Logged out successfully.",
    });
  }

  /**
   * Handles GET /api/auth/me
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
      const isProd = process.env.NODE_ENV === "production";
      reply.clearCookie(SESSION_COOKIE_NAME, {
        path: "/",
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
      });
      reply.clearCookie(CSRF_COOKIE_NAME, {
        path: "/",
        httpOnly: false,
        secure: isProd,
        sameSite: "lax",
      });

      return reply.status(401).send({
        success: false,
        message: "Session expired or invalid. Please log in again.",
      });
    }

    return reply.status(200).send({
      success: true,
      user,
    });
  }
}

export const authController = new AuthController();
