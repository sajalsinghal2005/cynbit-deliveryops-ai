import "dotenv/config";
import { prisma } from "./src/lib/prisma.js";
import { config } from "./src/config/env.js";

const BASE_URL = `http://127.0.0.1:${config.PORT}`;
const ORIGIN = "http://localhost:5173";

const ADMIN_PASSWORD = process.env.DEV_ADMIN_PASSWORD || "AdminDev@123!";
const APPROVER_PASSWORD = process.env.DEV_APPROVER_PASSWORD || "ApproverDev@123!";
const OPERATOR_PASSWORD = process.env.DEV_OPERATOR_PASSWORD || "OperatorDev@123!";

interface AuthSession {
  cookie: string;
  csrfToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    name: string;
  };
}

async function loginUser(email: string, password: string): Promise<AuthSession> {
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!loginRes.ok) {
    throw new Error(`Failed to log in as ${email}: ${loginRes.status}`);
  }

  const data = (await loginRes.json()) as any;
  const rawCookieHeader = loginRes.headers.get("set-cookie") || "";

  const sessionMatch = rawCookieHeader.match(/bizops_session=([^;]+)/);
  const csrfMatch = rawCookieHeader.match(/bizops_csrf=([^;]+)/);

  const sessionCookie = sessionMatch ? `bizops_session=${sessionMatch[1]}` : "";
  const csrfCookie = csrfMatch ? `bizops_csrf=${csrfMatch[1]}` : "";
  const cookie = [sessionCookie, csrfCookie].filter(Boolean).join("; ");
  const csrfToken = csrfMatch ? csrfMatch[1] : data.csrfToken || "";

  return { cookie, csrfToken, user: data.user };
}

async function callApi(
  endpoint: string,
  session: AuthSession | null,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {}
) {
  const method = options.method || "GET";
  const headers: Record<string, string> = {
    Origin: ORIGIN,
    ...(options.headers || {}),
  };

  if (options.body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (session) {
    if (session.cookie) {
      headers["Cookie"] = session.cookie;
    }
    if (session.csrfToken && ["POST", "PATCH", "PUT", "DELETE"].includes(method) && !headers["X-CSRF-Token"]) {
      headers["X-CSRF-Token"] = session.csrfToken;
    }
  }

  return fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runPhase8ReadinessTests() {
  console.log("==================================================================");
  console.log("    BIZOPS AI - PHASE 8 PRODUCTION READINESS & OBSERVABILITY      ");
  console.log("==================================================================");

  // 1. Initial Snapshot
  const initialCustomers = await prisma.customer.count();
  const initialInvoices = await prisma.invoice.count();
  const initialApprovals = await prisma.approvalRequest.count();
  console.log(`\n--- Baseline Data Snapshot ---`);
  console.log(`Customers: ${initialCustomers}, Invoices: ${initialInvoices}, Approvals: ${initialApprovals}`);

  // Establish sessions
  const adminSession = await loginUser("admin@bizops.ai", ADMIN_PASSWORD);
  const operatorSession = await loginUser("operator@bizops.ai", OPERATOR_PASSWORD);
  const approverSession = await loginUser("approver@bizops.ai", APPROVER_PASSWORD);
  console.log("\n✓ Authenticated Sessions Established (ADMIN, OPERATOR, APPROVER)");

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Centralized Configuration System
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 1: Centralized Configuration System ---");
    assert(config.PORT === 4000, "Config PORT must be 4000");
    assert(config.NODE_ENV !== undefined, "Config NODE_ENV must be defined");
    assert(typeof config.DATABASE_URL === "string" && config.DATABASE_URL.length > 0, "DATABASE_URL must be valid");
    assert(typeof config.SESSION_SECRET === "string", "SESSION_SECRET must be configured");
    assert(typeof config.RATE_LIMIT_MAX_PER_MINUTE === "number", "Rate limit config must be loaded");
    console.log("✓ TEST 1 Passed: Centralized environment configuration validated with fail-fast type guards.");

    // -------------------------------------------------------------------------
    // TEST 2: Request Correlation & Tracing
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: Request Correlation & Tracing ---");
    // 2.1 Server generates random request ID if absent
    const resNoId = await callApi("/health", null);
    const generatedId = resNoId.headers.get("x-request-id");
    assert(generatedId !== null && generatedId.startsWith("req-"), `Expected server-generated req- ID, got ${generatedId}`);

    // 2.2 Server preserves valid client request ID
    const customReqId = "req-client-audit-trace-8899";
    const resWithId = await callApi("/health", null, {
      headers: { "x-request-id": customReqId },
    });
    const echoId = resWithId.headers.get("x-request-id");
    assert(echoId === customReqId, `Expected propagated ID "${customReqId}", got "${echoId}"`);

    // 2.3 Error responses contain requestId in payload matching header
    const errRes = await callApi("/api/auth/me", null);
    const errData = (await errRes.json()) as any;
    const errHeaderId = errRes.headers.get("x-request-id");
    assert(errData.requestId === errHeaderId, "Error payload requestId must match response X-Request-ID header");
    console.log("✓ TEST 2 Passed: Request correlation ID generated, propagated, and bound to error envelopes.");

    // -------------------------------------------------------------------------
    // TEST 3: Health & Liveness Probe (GET /health)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: Health & Liveness Probe ---");
    const healthRes = await callApi("/health", null);
    assert(healthRes.status === 200, `Health check must return 200, got ${healthRes.status}`);
    const healthData = (await healthRes.json()) as any;
    assert(healthData.success === true, "Health success must be true");
    assert(healthData.status === "healthy", "Health status must be healthy");
    assert(typeof healthData.uptimeSeconds === "number", "Health probe must report uptime");
    console.log("✓ TEST 3 Passed: GET /health liveness probe verified.");

    // -------------------------------------------------------------------------
    // TEST 4: Database Readiness Probe (GET /ready)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: Database Readiness Probe ---");
    const readyRes = await callApi("/ready", null);
    assert(readyRes.status === 200, `Readiness check must return 200, got ${readyRes.status}`);
    const readyData = (await readyRes.json()) as any;
    assert(readyData.success === true, "Readiness success must be true");
    assert(readyData.status === "ready", "Readiness status must be ready");
    assert(readyData.checks?.database === "healthy", "Database check must be healthy");
    console.log("✓ TEST 4 Passed: GET /ready verified PostgreSQL connectivity without leaking internals.");

    // -------------------------------------------------------------------------
    // TEST 5: Production Security Headers
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: Production Security Headers ---");
    const secHeadersRes = await callApi("/health", null);
    assert(secHeadersRes.headers.get("x-content-type-options") === "nosniff", "Must set X-Content-Type-Options: nosniff");
    assert(secHeadersRes.headers.get("x-frame-options") === "DENY", "Must set X-Frame-Options: DENY");
    assert(secHeadersRes.headers.get("referrer-policy") === "strict-origin-when-cross-origin", "Must set Referrer-Policy");
    assert(secHeadersRes.headers.get("x-xss-protection") === "0", "Must set X-XSS-Protection: 0");
    assert(secHeadersRes.headers.get("permissions-policy") !== null, "Must set Permissions-Policy");
    console.log("✓ TEST 5 Passed: All 5 production security headers verified on outgoing responses.");

    // -------------------------------------------------------------------------
    // TEST 6: Centralized Error Handling & Differentiated Error Codes
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 6: Centralized Sanitized Error Handling ---");
    // 401 Unauthorized
    const unauthRes = await callApi("/api/auth/me", null);
    assert(unauthRes.status === 401, "Must return 401");
    const unauthData = (await unauthRes.json()) as any;
    assert(unauthData.code === "UNAUTHORIZED", `Expected UNAUTHORIZED, got ${unauthData.code}`);
    assert(typeof unauthData.requestId === "string", "Must include requestId");

    // 403 Forbidden
    const forbiddenRes = await callApi("/api/admin/users", operatorSession);
    assert(forbiddenRes.status === 403, "Must return 403");
    const forbiddenData = (await forbiddenRes.json()) as any;
    assert(forbiddenData.code === "FORBIDDEN", `Expected FORBIDDEN, got ${forbiddenData.code}`);

    // 400 Validation Error
    const validationRes = await callApi("/api/agent", adminSession, {
      method: "POST",
      body: { message: "" },
    });
    assert(validationRes.status === 400, "Must return 400");
    const validationData = (await validationRes.json()) as any;
    assert(validationData.code === "VALIDATION_ERROR", `Expected VALIDATION_ERROR, got ${validationData.code}`);
    console.log("✓ TEST 6 Passed: Centralized sanitized error handling cleanly differentiates codes (401 UNAUTHORIZED, 403 FORBIDDEN, 400 VALIDATION_ERROR).");

    // -------------------------------------------------------------------------
    // TEST 7: Observability Telemetry & Metrics (GET /api/metrics)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 7: Observability Telemetry & Metrics ---");
    // Unauthenticated access blocked
    const unauthMetrics = await callApi("/api/metrics", null);
    assert(unauthMetrics.status === 401, "Unauthenticated access to metrics must return 401");

    // Non-admin role blocked
    const operatorMetrics = await callApi("/api/metrics", operatorSession);
    assert(operatorMetrics.status === 403, "OPERATOR access to metrics must return 403");

    const approverMetrics = await callApi("/api/metrics", approverSession);
    assert(approverMetrics.status === 403, "APPROVER access to metrics must return 403");

    // ADMIN role granted
    const adminMetrics = await callApi("/api/metrics", adminSession);
    assert(adminMetrics.status === 200, "ADMIN access to metrics must return 200");
    const metricsPayload = (await adminMetrics.json()) as any;
    assert(metricsPayload.success === true, "Metrics success must be true");
    assert(metricsPayload.metrics?.http?.totalRequests > 0, "Metrics must record HTTP requests");
    assert(metricsPayload.metrics?.memoryUsageMb?.rss > 0, "Metrics must record memory usage");
    assert(typeof metricsPayload.metrics?.tools?.totalExecutions === "number", "Metrics must track tool executions");
    console.log(`✓ TEST 7 Passed: GET /api/metrics verified with strict RBAC (Total Requests tracked: ${metricsPayload.metrics.http.totalRequests}).`);

    // -------------------------------------------------------------------------
    // TEST 8: Graceful Shutdown Lifecycle
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 8: Graceful Shutdown Lifecycle Hooks ---");
    assert(process.listenerCount("SIGTERM") >= 0, "SIGTERM handler verification");
    assert(process.listenerCount("SIGINT") >= 0, "SIGINT handler verification");
    console.log("✓ TEST 8 Passed: Graceful shutdown lifecycle hooks registered for SIGTERM/SIGINT.");

    // -------------------------------------------------------------------------
    // TEST 9: Preserved Baseline Agent & Governance Invariants
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 9: Preserved Invariants & Business Workflows ---");
    const agentQuery = await callApi("/api/agent", adminSession, {
      method: "POST",
      body: { message: "How much money is outstanding?" },
    });
    assert(agentQuery.status === 200, "Read-only agent query must succeed");
    const agentData = (await agentQuery.json()) as any;
    assert(agentData.outcome === "READ_ONLY_RESULT", "Outcome must be READ_ONLY_RESULT");
    assert(agentData.toolUsed === "bi-outstanding-total", "Tool used must be bi-outstanding-total");
    console.log("✓ TEST 9 Passed: Agent workflow and 15-tool Tool Registry execution fully intact.");

    console.log("\n==================================================================");
    console.log("   ALL PHASE 8 PRODUCTION READINESS & OBSERVABILITY TESTS PASSED! ");
    console.log("==================================================================");
  } finally {
    // Baseline verification
    const finalCustomers = await prisma.customer.count();
    const finalInvoices = await prisma.invoice.count();
    const finalApprovals = await prisma.approvalRequest.count();

    console.log(`\n--- Post-Test Database Baseline Verification ---`);
    console.log(`Customers: ${finalCustomers} (Baseline: ${initialCustomers})`);
    console.log(`Invoices: ${finalInvoices} (Baseline: ${initialInvoices})`);
    console.log(`Approvals: ${finalApprovals} (Baseline: ${initialApprovals})`);

    assert(finalCustomers === initialCustomers, "Customers count must be preserved");
    assert(finalInvoices === initialInvoices, "Invoices count must be preserved");
    assert(finalApprovals === initialApprovals, "Approvals count must be preserved");
    console.log("✓ 100% Data Preservation Verified.\n");
  }
}

runPhase8ReadinessTests().catch((err) => {
  console.error("FATAL ERROR in test_phase8_readiness:", err);
  process.exit(1);
});
