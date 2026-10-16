import type { FastifyInstance } from "fastify";
import { config } from "../config/env.js";
import { authController } from "../controllers/auth.controller.js";
import { authenticate, verifyCsrf } from "../middleware/auth.guard.js";

export async function authRoutes(app: FastifyInstance) {
  // Login endpoint with rate limiting protection (public)
  app.post(
    "/api/auth/login",
    {
      config: {
        rateLimit: {
          max: config.AUTH_RATE_LIMIT_MAX_PER_MINUTE,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      return authController.login(request, reply);
    },
  );

  // Logout endpoint (protected by authentication & CSRF)
  app.post(
    "/api/auth/logout",
    {
      preHandler: [authenticate, verifyCsrf],
    },
    async (request, reply) => {
      return authController.logout(request, reply);
    },
  );

  // Current authenticated user profile
  app.get(
    "/api/auth/me",
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      return authController.getMe(request, reply);
    },
  );
}
