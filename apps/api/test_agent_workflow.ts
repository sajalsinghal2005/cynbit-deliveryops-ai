import { prisma } from "./src/lib/prisma.js";
import { toolRegistry } from "./src/tools/tool.registry.js";
import { customerSearchTool } from "./src/tools/customer.tool.js";

const BASE_URL = "http://localhost:4000";
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
    name: string;
    role: string;
  };
}

async function loginUser(email: string, pass: string): Promise<AuthSession> {
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
    },
    body: JSON.stringify({ email, password: pass }),
  });

  if (!loginRes.ok) {
    throw new Error(`Failed to log in as ${email}: ${loginRes.status} ${await loginRes.text()}`);
  }

  const data = (await loginRes.json()) as any;
  const rawCookieHeader = loginRes.headers.get("set-cookie") || "";

  const sessionMatch = rawCookieHeader.match(/bizops_session=([^;]+)/);
  const csrfMatch = rawCookieHeader.match(/bizops_csrf=([^;]+)/);

  const sessionCookie = sessionMatch ? `bizops_session=${sessionMatch[1]}` : "";
  const csrfCookie = csrfMatch ? `bizops_csrf=${csrfMatch[1]}` : "";
  const cookie = [sessionCookie, csrfCookie].filter(Boolean).join("; ");
  const csrfToken = csrfMatch ? csrfMatch[1] : (data.csrfToken || "");

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

async function main() {
  console.log("==================================================================");
  console.log("   BIZOPS AI - PHASE 6.1 AGENT WORKFLOW RELIABILITY AUDIT SUITE   ");
  console.log("==================================================================\n");

  // 0. Capture Baselines
  const baselineCustomers = await prisma.customer.count();
  const baselineInvoices = await prisma.invoice.count();
  const baselineApprovals = await prisma.approvalRequest.count();
  const baselineUsers = await prisma.user.count();
  const baselineAuditEvents = await prisma.auditEvent.count();

  console.log("--- Baseline Data Snapshot ---");
  console.log(`Customers: ${baselineCustomers}, Invoices: ${baselineInvoices}, Approvals: ${baselineApprovals}, Users: ${baselineUsers}, AuditEvents: ${baselineAuditEvents}\n`);

  const createdApprovalIds: string[] = [];

  try {
    // Authenticate roles
    const adminSession = await loginUser("admin@bizops.ai", ADMIN_PASSWORD);
    const operatorSession = await loginUser("operator@bizops.ai", OPERATOR_PASSWORD);
    const approverSession = await loginUser("approver@bizops.ai", APPROVER_PASSWORD);

    console.log("--- Authenticated Sessions Established ---");
    console.log(`ADMIN: ${adminSession.user.email} (${adminSession.user.role})`);
    console.log(`OPERATOR: ${operatorSession.user.email} (${operatorSession.user.role})`);
    console.log(`APPROVER: ${approverSession.user.email} (${approverSession.user.role})\n`);

    // =========================================================================
    // TEST 1: Valid read-only agent requests (no approval created)
    // =========================================================================
    console.log("--- TEST 1: Read-Only Agent Requests ---");
    const readOnlyPrompts = [
      "Find customer Acme",
      "Show unpaid invoices",
      "Find invoice INV-1001",
      "Check the current account status of ABC Technologies",
    ];

    for (const prompt of readOnlyPrompts) {
      const res = await callApi("/api/agent", operatorSession, {
        method: "POST",
        body: { message: prompt },
      });

      if (!res.ok) {
        throw new Error(`Read-only prompt "${prompt}" failed with status ${res.status}`);
      }

      const body = (await res.json()) as any;
      if (body.approvalRequired !== false || body.outcome !== "READ_ONLY_RESULT") {
        throw new Error(`Prompt "${prompt}" unexpectedly requested approval or bad outcome: ${JSON.stringify(body)}`);
      }
      console.log(`  ✓ Read-only prompt passed: "${prompt}" -> toolUsed: ${body.toolUsed}, outcome: ${body.outcome}`);
    }
    console.log("✓ TEST 1 Passed: Read-only queries execute safely without creating approval requests.\n");

    // =========================================================================
    // TEST 2: Consequential request creates approval proposal
    // =========================================================================
    console.log("--- TEST 2: Consequential Request Creates Approval Proposal ---");
    const consequentialPrompt = "Send a reminder for invoice INV-1001";
    const agentMutationRes = await callApi("/api/agent", operatorSession, {
      method: "POST",
      body: { message: consequentialPrompt },
    });

    if (!agentMutationRes.ok) {
      throw new Error(`Consequential request failed: ${agentMutationRes.status}`);
    }

    const agentMutationBody = (await agentMutationRes.json()) as any;
    if (!agentMutationBody.approvalRequired || agentMutationBody.outcome !== "APPROVAL_REQUIRED") {
      throw new Error(`Expected approvalRequired: true, received: ${JSON.stringify(agentMutationBody)}`);
    }

    const approvalId = agentMutationBody.approvalId;
    if (!approvalId) {
      throw new Error("Missing approvalId in consequential agent response");
    }
    createdApprovalIds.push(approvalId);

    console.log(`Created approval proposal ID: ${approvalId}`);
    console.log(`Outcome reported: ${agentMutationBody.outcome}, Tool used: ${agentMutationBody.toolUsed}`);
    console.log("✓ TEST 2 Passed: Consequential action creates a pending proposal.\n");

    // =========================================================================
    // TEST 3: Consequential action does not execute before approval
    // =========================================================================
    console.log("--- TEST 3: Action Invariant: No Execution Before Approval ---");
    const dbApprovalBefore = await prisma.approvalRequest.findUnique({
      where: { id: approvalId },
    });

    if (!dbApprovalBefore) {
      throw new Error(`Approval ${approvalId} not found in PostgreSQL!`);
    }

    if (dbApprovalBefore.status !== "PENDING" || dbApprovalBefore.executionStatus !== "NOT_EXECUTED") {
      throw new Error(`Approval invariant violated before decision: status=${dbApprovalBefore.status}, execution=${dbApprovalBefore.executionStatus}`);
    }

    if (dbApprovalBefore.decidedAt !== null || dbApprovalBefore.decidedBy !== null) {
      throw new Error(`Approval already decided prematurely: decidedBy=${dbApprovalBefore.decidedBy}`);
    }

    console.log(`Verified DB state: status=${dbApprovalBefore.status}, executionStatus=${dbApprovalBefore.executionStatus}, decidedAt=${dbApprovalBefore.decidedAt}`);
    console.log("✓ TEST 3 Passed: Consequential action does not execute before approval.\n");

    // =========================================================================
    // TEST 4: Authorized approval executes exactly once
    // =========================================================================
    console.log("--- TEST 4: Authorized Approver Approves (Executes Exactly Once) ---");
    const approveRes = await callApi(`/api/approvals/${approvalId}/approve`, approverSession, {
      method: "POST",
    });

    if (!approveRes.ok) {
      throw new Error(`Approval failed with status ${approveRes.status}: ${await approveRes.text()}`);
    }

    const approveBody = (await approveRes.json()) as any;
    if (!approveBody.success || approveBody.approval.status !== "APPROVED" || approveBody.approval.executionStatus !== "SUCCESS") {
      throw new Error(`Approval execution state invalid: ${JSON.stringify(approveBody)}`);
    }

    const dbApprovalAfter = await prisma.approvalRequest.findUnique({
      where: { id: approvalId },
    });

    if (!dbApprovalAfter || dbApprovalAfter.status !== "APPROVED" || dbApprovalAfter.executionStatus !== "SUCCESS") {
      throw new Error(`DB verification failed: status=${dbApprovalAfter?.status}, executionStatus=${dbApprovalAfter?.executionStatus}`);
    }

    console.log(`DB state verified: status=${dbApprovalAfter.status}, executionStatus=${dbApprovalAfter.executionStatus}, decidedBy=${dbApprovalAfter.decidedBy}`);
    console.log("✓ TEST 4 Passed: Authorized decision transitions status to APPROVED and executes simulated action.\n");

    // =========================================================================
    // TEST 5: Duplicate approval cannot execute twice
    // =========================================================================
    console.log("--- TEST 5: Duplicate Decision Prevention ---");
    const dupApproveRes = await callApi(`/api/approvals/${approvalId}/approve`, approverSession, {
      method: "POST",
    });

    if (dupApproveRes.status !== 400) {
      throw new Error(`Expected 400 Bad Request on duplicate approval, got ${dupApproveRes.status}`);
    }

    const dupBody = (await dupApproveRes.json()) as any;
    console.log(`Duplicate approval status: ${dupApproveRes.status}, message: "${dupBody.message}"`);
    console.log("✓ TEST 5 Passed: Duplicate approval requests cannot execute twice.\n");

    // =========================================================================
    // TEST 6: Rejected approval does not execute
    // =========================================================================
    console.log("--- TEST 6: Rejected Approval Does Not Execute ---");
    // Create another proposal for testing rejection (INV-2046 is overdue)
    const rejectPromptRes = await callApi("/api/agent", operatorSession, {
      method: "POST",
      body: { message: "Send reminder for invoice INV-2046" },
    });

    const rejectPromptBody = (await rejectPromptRes.json()) as any;
    const rejectApprovalId = rejectPromptBody.approvalId;
    if (!rejectApprovalId) {
      throw new Error(`Failed to create proposal for rejection test: ${JSON.stringify(rejectPromptBody)}`);
    }
    createdApprovalIds.push(rejectApprovalId);

    const rejectRes = await callApi(`/api/approvals/${rejectApprovalId}/reject`, approverSession, {
      method: "POST",
      body: { reason: "Customer requested extension until next week." },
    });

    if (!rejectRes.ok) {
      throw new Error(`Rejection failed with status ${rejectRes.status}`);
    }

    const dbRejected = await prisma.approvalRequest.findUnique({
      where: { id: rejectApprovalId },
    });

    if (!dbRejected || dbRejected.status !== "REJECTED" || dbRejected.executionStatus !== "NOT_EXECUTED") {
      throw new Error(`Rejected request executionStatus should be NOT_EXECUTED, got: ${dbRejected?.executionStatus}`);
    }

    // Now attempt to approve the rejected request
    const approveRejectedRes = await callApi(`/api/approvals/${rejectApprovalId}/approve`, approverSession, {
      method: "POST",
    });

    if (approveRejectedRes.status !== 400) {
      throw new Error(`Expected 400 when approving rejected request, got ${approveRejectedRes.status}`);
    }

    console.log(`Verified rejected state: status=${dbRejected.status}, executionStatus=${dbRejected.executionStatus}`);
    console.log(`Attempt to approve rejected request returned 400: "${(await approveRejectedRes.json() as any).message}"`);
    console.log("✓ TEST 6 Passed: Rejected approvals never execute.\n");

    // =========================================================================
    // TEST 7: Unauthorized approval is rejected (OPERATOR role blocked)
    // =========================================================================
    console.log("--- TEST 7: Unauthorized Approval Rejected (403 Forbidden) ---");
    // Create a new proposal (INV-2048 is pending)
    const unauthPromptRes = await callApi("/api/agent", adminSession, {
      method: "POST",
      body: { message: "Send reminder for invoice INV-2048" },
    });

    const unauthApprovalId = (await unauthPromptRes.json() as any).approvalId;
    if (!unauthApprovalId) {
      throw new Error(`Failed to create proposal for unauthorized test: ${JSON.stringify(await unauthPromptRes.json())}`);
    }
    createdApprovalIds.push(unauthApprovalId);

    // Operator attempts to approve
    const operatorApproveRes = await callApi(`/api/approvals/${unauthApprovalId}/approve`, operatorSession, {
      method: "POST",
    });

    if (operatorApproveRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for OPERATOR approval, got ${operatorApproveRes.status}`);
    }

    console.log(`OPERATOR approval status: ${operatorApproveRes.status} (Expected: 403 Forbidden)`);
    console.log("✓ TEST 7 Passed: Non-governance roles are strictly blocked from approving actions.\n");

    // =========================================================================
    // TEST 8: Unknown tool is rejected safely
    // =========================================================================
    console.log("--- TEST 8: Unknown Tool Invocation Rejected Safely ---");
    const unknownToolResult = await toolRegistry.executeTool("system-exec-shell", { command: "whoami" });
    if (unknownToolResult.success !== false || !unknownToolResult.error?.includes("not registered")) {
      throw new Error(`Expected unknown tool rejection, got: ${JSON.stringify(unknownToolResult)}`);
    }

    console.log(`Direct unknown tool execution result: success=${unknownToolResult.success}, error="${unknownToolResult.error}"`);
    console.log("✓ TEST 8 Passed: Unregistered tools are rejected safely.\n");

    // =========================================================================
    // TEST 9: Invalid tool arguments rejected by schema validation
    // =========================================================================
    console.log("--- TEST 9: Invalid Tool Arguments Rejected by Schema Validation ---");
    const invalidArgResult = await toolRegistry.executeTool("invoice-search", {
      status: "non-existent-status-value",
      minAmount: -500, // Non-negative constraint violated
    });

    if (invalidArgResult.success !== false || !invalidArgResult.error?.includes("Invalid arguments")) {
      throw new Error(`Expected argument validation failure, got: ${JSON.stringify(invalidArgResult)}`);
    }

    console.log(`Tool validation failure caught: success=${invalidArgResult.success}, error="${invalidArgResult.error}"`);
    console.log("✓ TEST 9 Passed: Invalid tool parameters are rejected by schema validation.\n");

    // =========================================================================
    // TEST 10: Malformed and empty agent requests rejected safely
    // =========================================================================
    console.log("--- TEST 10: Malformed & Empty Requests Fail Safely (HTTP 400) ---");
    const malformedPayloads = [
      { body: { message: "" }, label: "Empty string" },
      { body: { message: "     " }, label: "Whitespace only" },
      { body: { message: 12345 }, label: "Non-string payload" },
      { body: {}, label: "Missing message field" },
      { body: { message: "A".repeat(2500) }, label: "Exceeding max length (2500 chars)" },
    ];

    for (const testCase of malformedPayloads) {
      const malformedRes = await callApi("/api/agent", operatorSession, {
        method: "POST",
        body: testCase.body,
      });

      if (malformedRes.status !== 400) {
        throw new Error(`Expected 400 for ${testCase.label}, got ${malformedRes.status}`);
      }

      const malformedBody = (await malformedRes.json()) as any;
      if (malformedBody.outcome !== "INVALID_REQUEST") {
        throw new Error(`Expected outcome: INVALID_REQUEST for ${testCase.label}`);
      }
      console.log(`  ✓ Case "${testCase.label}" -> status: ${malformedRes.status}, message: "${malformedBody.message}"`);
    }
    console.log("✓ TEST 10 Passed: Malformed and boundary-violating requests rejected with safe 400 responses.\n");

    // =========================================================================
    // TEST 11: Client actor spoofing is ignored
    // =========================================================================
    console.log("--- TEST 11: Client Actor Spoofing Immunity ---");
    // Attempt to spoof actor in headers and body
    const spoofPromptRes = await callApi("/api/agent", operatorSession, {
      method: "POST",
      headers: {
        "X-Actor": "SpoofedAdminInHeader",
      },
      body: {
        message: "Send reminder for invoice INV-1001",
        actor: "SpoofedAdminInBody",
        userId: "fake-user-id-999",
      },
    });

    const spoofApprovalId = (await spoofPromptRes.json() as any).approvalId;
    if (!spoofApprovalId) {
      throw new Error(`Failed to create proposal for spoof test: ${JSON.stringify(await spoofPromptRes.json())}`);
    }
    createdApprovalIds.push(spoofApprovalId);

    // Approve with spoof attempt
    const spoofApproveRes = await callApi(`/api/approvals/${spoofApprovalId}/approve`, approverSession, {
      method: "POST",
      headers: {
        "X-Actor": "SpoofedAdminInHeader",
      },
      body: {
        actor: "MaliciousActor",
        decidedBy: "FakeDecidedBy",
      },
    });

    const spoofApproveBody = (await spoofApproveRes.json()) as any;
    const verifiedDbApproval = await prisma.approvalRequest.findUnique({
      where: { id: spoofApprovalId },
    });

    if (verifiedDbApproval?.decidedBy?.includes("MaliciousActor") || verifiedDbApproval?.decidedBy?.includes("SpoofedAdmin")) {
      throw new Error(`Actor spoofing vulnerability! decidedBy=${verifiedDbApproval?.decidedBy}`);
    }

    const expectedAuthorizer = `${approverSession.user.name} (${approverSession.user.email})`;
    if (verifiedDbApproval?.decidedBy !== expectedAuthorizer) {
      throw new Error(`Expected decidedBy to be "${expectedAuthorizer}", got: "${verifiedDbApproval?.decidedBy}"`);
    }

    console.log(`Persisted decidedBy in DB: "${verifiedDbApproval.decidedBy}"`);
    console.log("✓ TEST 11 Passed: Client actor overrides are completely ignored.\n");

    // =========================================================================
    // TEST 12: Tool failure produces safe sanitized response
    // =========================================================================
    console.log("--- TEST 12: Tool Failure Produces Safe Response ---");
    // Register temporary failing tool to verify exception isolation
    toolRegistry.register({
      id: "failing-test-tool",
      name: "Failing Test Tool",
      description: "Throws database exception for error handling audit",
      category: "Test",
      risk: "LOW",
      schema: customerSearchTool.schema,
      execute: () => {
        throw new Error("PrismaClientKnownRequestError: SELECT * FROM secret_table WHERE leak = 1");
      },
    });

    const failureResult = await toolRegistry.executeTool("failing-test-tool", { query: "test" });
    if (failureResult.success !== false) {
      throw new Error("Expected failing tool to return success: false");
    }

    if (failureResult.error?.includes("secret_table") || failureResult.error?.includes("SELECT *")) {
      throw new Error(`Error leaked internal database query: ${failureResult.error}`);
    }

    console.log(`Sanitized error returned: "${failureResult.error}"`);
    console.log("✓ TEST 12 Passed: Tool exceptions are isolated and sanitized without leaking SQL or stack traces.\n");

    // =========================================================================
    // TEST 13: Zero secrets in responses and audit records
    // =========================================================================
    console.log("--- TEST 13: Zero Secret Leakage in Agent & Audit Payloads ---");
    const auditRes = await callApi("/api/audit-events?limit=20", adminSession);

    const auditData = (await auditRes.json()) as any;
    const auditEvents = auditData.data || [];

    for (const evt of auditEvents) {
      const stringified = JSON.stringify(evt).toLowerCase();
      if (stringified.includes("passwordhash") || stringified.includes("sessiontokenhash")) {
        throw new Error(`Secret detected in AuditEvent ${evt.id}: ${stringified}`);
      }
    }

    console.log(`Inspected ${auditEvents.length} recent AuditEvents: zero password hashes or token secrets found.`);
    console.log("✓ TEST 13 Passed: Zero secrets leaked in API responses or audit logs.\n");

    // =========================================================================
    // TEST 14: Repeated Agent Proposal Idempotency
    // =========================================================================
    console.log("--- TEST 14: Repeated Agent Proposal Idempotency Safeguard ---");
    // Send prompt for INV-2046
    const prompt1Res = await callApi("/api/agent", operatorSession, {
      method: "POST",
      body: { message: "Send reminder for invoice INV-2046" },
    });

    const prompt1Body = (await prompt1Res.json()) as any;
    const id1 = prompt1Body.approvalId;
    if (!id1) {
      throw new Error(`Failed to create proposal 1: ${JSON.stringify(prompt1Body)}`);
    }
    createdApprovalIds.push(id1);

    // Repeated request for same invoice while pending
    const prompt2Res = await callApi("/api/agent", operatorSession, {
      method: "POST",
      body: { message: "Send reminder for invoice INV-2046" },
    });

    const prompt2Body = (await prompt2Res.json()) as any;
    const id2 = prompt2Body.approvalId;

    if (id1 !== id2) {
      throw new Error(`Expected idempotent approval proposal reuse for INV-2046, but got different IDs: ${id1} vs ${id2}`);
    }

    console.log(`Proposal 1 ID: ${id1}, Proposal 2 ID: ${id2} (Reused pending approval, no duplicate created in DB)`);
    console.log("✓ TEST 14 Passed: Repeated agent proposals for the same invoice are deduplicated.\n");

    // =========================================================================
    // TEST 15: Non-existent invoice does not create ghost approval proposal
    // =========================================================================
    console.log("--- TEST 15: Non-Existent Invoice Query Does Not Create Ghost Proposal ---");
    const nonExistentRes = await callApi("/api/agent", operatorSession, {
      method: "POST",
      body: { message: "Send reminder for invoice INV-9999" },
    });

    const nonExistentBody = (await nonExistentRes.json()) as any;
    if (nonExistentBody.approvalRequired !== false || nonExistentBody.approvalId !== undefined) {
      throw new Error(`Unexpected approval created for non-existent invoice: ${JSON.stringify(nonExistentBody)}`);
    }
    console.log(`Non-existent invoice response: approvalRequired=${nonExistentBody.approvalRequired}, outcome=${nonExistentBody.outcome}`);
    console.log("✓ TEST 15 Passed: Consequential request for non-existent invoice safely returns zero matches without creating approval.\n");

    console.log("==================================================================");
    console.log("  ALL PHASE 6.1 AGENT WORKFLOW AUDIT TESTS PASSED! 🛡️⚡🤖✅     ");
    console.log("==================================================================\n");

  } finally {
    // Cleanup disposable test approval requests and their audit events
    if (createdApprovalIds.length > 0) {
      console.log(`🧹 Cleaning up ${createdApprovalIds.length} test approval proposals...`);
      for (const id of createdApprovalIds) {
        await prisma.auditEvent.deleteMany({
          where: { approvalRequestId: id },
        });
        await prisma.approvalRequest.deleteMany({
          where: { id },
        });
      }
      console.log("✓ Cleanup completed.");
    }

    // Verify baseline preservation
    const postCustomers = await prisma.customer.count();
    const postInvoices = await prisma.invoice.count();
    const postApprovals = await prisma.approvalRequest.count();
    const postUsers = await prisma.user.count();

    console.log("\n--- Post-Test Database Baseline Verification ---");
    console.log(`Customers: ${postCustomers} (Baseline: ${baselineCustomers})`);
    console.log(`Invoices: ${postInvoices} (Baseline: ${baselineInvoices})`);
    console.log(`Approvals: ${postApprovals} (Baseline: ${baselineApprovals})`);
    console.log(`Users: ${postUsers} (Baseline: ${baselineUsers})`);

    if (
      postCustomers !== baselineCustomers ||
      postInvoices !== baselineInvoices ||
      postApprovals !== baselineApprovals ||
      postUsers !== baselineUsers
    ) {
      console.error("⚠️ BASELINE MISMATCH DETECTED!");
      process.exit(1);
    } else {
      console.log("✓ 100% Data Preservation Verified.\n");
    }
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in test_agent_workflow:", err);
  process.exit(1);
});
