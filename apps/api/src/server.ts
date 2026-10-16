import crypto from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";

import { config } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { metricsService } from "./services/metrics.service.js";
import { aiOrchestrator } from "./orchestrator/ai.orchestrator.js";

import { healthRoutes } from "./routes/health.routes.js";
import { agentRoutes } from "./routes/agent.routes.js";
import { approvalRoutes } from "./routes/approval.routes.js";
import { auditRoutes } from "./routes/audit.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { userAdminRoutes } from "./routes/user-admin.routes.js";
import { toolRoutes } from "./routes/tool.routes.js";
import { webhookRoutes } from "./routes/webhook.routes.js";

/**
 * Fastify Application Factory
 * Configures enterprise structured logging, request correlation,
 * security headers, and production middleware.
 */
export const app = Fastify({
  // Structured logging with strict redaction of credentials and secrets
  logger: {
    level: config.LOG_LEVEL,
    redact: [
      "req.headers.cookie",
      "req.headers.authorization",
      "req.headers['x-csrf-token']",
      "body.password",
      "body.newPassword",
      "*.password",
      "*.sessionToken",
      "*.sessionTokenHash",
    ],
  },
  // Request Correlation: generate random ID or safely accept valid incoming X-Request-ID
  requestIdHeader: "x-request-id",
  genReqId: (req) => {
    const incomingId = req.headers["x-request-id"];
    if (typeof incomingId === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(incomingId)) {
      return incomingId;
    }
    return `req-${crypto.randomUUID()}`;
  },
});

// Configure Trusted Frontend Origins for Credentialed CORS
const isProduction = config.NODE_ENV === "production";
const devOrigins = isProduction ? [] : ["http://localhost:5173", "http://127.0.0.1:5173"];
const additionalOrigins = config.ALLOWED_ORIGINS
  ? config.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
  : [];

const trustedOrigins = new Set<string>([
  config.FRONTEND_URL,
  ...devOrigins,
  ...additionalOrigins,
]);

await app.register(cors, {
  origin: (origin, cb) => {
    // Allow non-browser requests (tools, curl, server-side tests)
    if (!origin) return cb(null, true);
    if (trustedOrigins.has(origin)) {
      return cb(null, true);
    }
    return cb(new Error("CORS origin not permitted by security policy"), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-CSRF-Token",
    "X-Requested-With",
    "X-Request-ID",
  ],
  exposedHeaders: ["X-Request-ID"],
});

// Register Secure Cookie Parser
await app.register(cookie, {
  secret: config.SESSION_SECRET,
});

// Register Global Rate Limiting
await app.register(rateLimit, {
  global: false, // Applied explicitly per sensitive route (e.g. auth login)
  max: config.RATE_LIMIT_MAX_PER_MINUTE,
  timeWindow: "1 minute",
});

// =============================================================================
// REQUEST HOOKS: TELEMETRY & SECURITY HEADERS
// =============================================================================

// 1. Record request initiation
app.addHook("onRequest", (request, _reply, done) => {
  (request as any).startTime = Date.now();
  metricsService.recordRequestStart();
  done();
});

// 2. Attach security headers and request correlation ID to every outgoing response
app.addHook("onSend", (request, reply, _payload, done) => {
  reply.header("X-Request-ID", request.id);
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "DENY");
  reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
  reply.header("X-XSS-Protection", "0");
  reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  done();
});

// 3. Record response telemetry and latency
app.addHook("onResponse", (request, reply, done) => {
  const durationMs = Date.now() - ((request as any).startTime || Date.now());
  metricsService.recordRequestEnd(reply.statusCode, durationMs);
  done();
});

// =============================================================================
// REGISTER ROUTES
// =============================================================================

await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(agentRoutes);
await app.register(approvalRoutes);
await app.register(auditRoutes);
await app.register(userAdminRoutes);
await app.register(toolRoutes);
await app.register(webhookRoutes);

// =============================================================================
// CENTRALIZED SANITIZED ERROR HANDLER
// =============================================================================

app.setErrorHandler((error: any, request, reply) => {
  request.log.error({
    err: error,
    requestId: request.id,
    path: request.url,
    method: request.method,
  });

  const statusCode = error.statusCode || 500;
  let code = "INTERNAL_SERVER_ERROR";

  if (statusCode === 400) code = "VALIDATION_ERROR";
  else if (statusCode === 401) code = "UNAUTHORIZED";
  else if (statusCode === 403) code = "FORBIDDEN";
  else if (statusCode === 404) code = "NOT_FOUND";
  else if (statusCode === 429) code = "RATE_LIMITED";

  metricsService.recordError(code);

  if (statusCode >= 500) {
    return reply.status(statusCode).send({
      success: false,
      code,
      message: "An internal server error occurred while processing your request.",
      requestId: request.id,
    });
  }

  return reply.status(statusCode).send({
    success: false,
    code,
    message: error.message || "Request failed.",
    requestId: request.id,
  });
});

// =============================================================================
// SERVER LIFECYCLE & GRACEFUL SHUTDOWN
// =============================================================================

let isShuttingDown = false;

export const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  app.log.info({ msg: `Received ${signal}. Initiating graceful shutdown...` });

  // Safety timeout to prevent hung processes
  const forceExitTimeout = setTimeout(() => {
    app.log.error({ msg: "Graceful shutdown timed out. Forcing process exit." });
    process.exit(1);
  }, 10000);
  forceExitTimeout.unref();

  try {
    await app.close();
    await prisma.$disconnect();
    app.log.info({ msg: "All connections closed cleanly. BizOps API stopped." });
    process.exit(0);
  } catch (err: any) {
    app.log.error({ msg: "Error during graceful shutdown", error: err?.message });
    process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

const start = async () => {
  try {
    await app.listen({
      port: config.PORT,
      host: config.HOST,
    });

    console.log(`🚀 BizOps API running on http://localhost:${config.PORT} [${config.NODE_ENV}]`);
    const providerInfo = aiOrchestrator.getProviderInfo();
    console.log(`🤖 AI Orchestrator initialized [provider: ${providerInfo.name}, model: ${providerInfo.model}]`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();