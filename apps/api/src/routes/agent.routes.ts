import type { FastifyInstance } from "fastify";
import { config } from "../config/env.js";
import { agentController } from "../controllers/agent.controller.js";
import { authenticate, authorize, verifyCsrf } from "../middleware/auth.guard.js";

export async function agentRoutes(app: FastifyInstance) {
  // Agent invocation restricted to ADMIN and OPERATOR roles with CSRF protection on cookie mutations
  app.post(
    "/api/agent",
    {
      config: {
        rateLimit: {
          max: config.AGENT_RATE_LIMIT_MAX_PER_MINUTE,
          timeWindow: "1 minute",
        },
      },
      preHandler: [
        authenticate,
        authorize(["ADMIN", "OPERATOR"]),
        verifyCsrf,
      ],
    },
    async (request, reply) => {
      return agentController.handleAgentRequest(request, reply);
    },
  );
}
