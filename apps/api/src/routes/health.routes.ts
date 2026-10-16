import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { metricsService } from "../services/metrics.service.js";
import { authenticate, authorize } from "../middleware/auth.guard.js";
import { aiOrchestrator } from "../orchestrator/ai.orchestrator.js";

export async function healthRoutes(app: FastifyInstance) {
  /**
   * GET /health - Liveness Probe
   * Answers whether the application process is running and able to handle traffic.
   */
  app.get("/health", async (_request, reply) => {
    const providerInfo = aiOrchestrator.getProviderInfo();
    return reply.status(200).send({
      success: true,
      service: "BizOps API",
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      llm: {
        provider: providerInfo.name,
        model: providerInfo.model,
      },
    });
  });

  /**
   * GET /ready - Readiness Probe
   * Verifies critical external dependencies (PostgreSQL database connectivity).
   * Returns 200 OK if ready, 503 Service Unavailable if dependencies are unhealthy.
   * Never exposes internal SQL queries, connection strings, or database credentials.
   */
  app.get("/ready", async (_request, reply) => {
    try {
      // Execute a lightweight ping query with a 3-second timeout
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Database readiness probe timed out")), 3000)
        ),
      ]);

      return reply.status(200).send({
        success: true,
        service: "BizOps API",
        status: "ready",
        checks: {
          database: "healthy",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      _request.log.error({ msg: "Readiness probe failed", error: err?.message });

      return reply.status(503).send({
        success: false,
        service: "BizOps API",
        status: "not_ready",
        checks: {
          database: "unhealthy",
        },
        message: "Service dependencies are not ready to accept traffic.",
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/metrics - Operational Telemetry
   * Strictly restricted to authenticated ADMIN users.
   * Returns safe system telemetry without sensitive data.
   */
  app.get(
    "/api/metrics",
    {
      preHandler: [authenticate, authorize(["ADMIN"])],
    },
    async (_request, reply) => {
      const snapshot = metricsService.getSnapshot();
      return reply.status(200).send({
        success: true,
        metrics: snapshot,
        timestamp: new Date().toISOString(),
      });
    }
  );
}
