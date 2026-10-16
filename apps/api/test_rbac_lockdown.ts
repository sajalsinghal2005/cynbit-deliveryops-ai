import { prisma } from "./src/lib/prisma.js";

async function runRbacTests() {
  console.log("=================================================");
  console.log("   BIZOPS AI - RBAC & ACTOR LOCKDOWN TEST SUITE  ");
  console.log("=================================================\n");

  const baseUrl = "http://localhost:4000";

  const adminPassword = process.env.DEV_ADMIN_PASSWORD || "AdminDev@123!";
  const approverPassword = process.env.DEV_APPROVER_PASSWORD || "ApproverDev@123!";
  const operatorPassword = process.env.DEV_OPERATOR_PASSWORD || "OperatorDev@123!";

  // Helper to log in and return session cookie and csrf token
  async function loginAs(email: string, password: string) {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    const setCookie = res.headers.get("set-cookie") || "";
    const sessionCookie = setCookie.match(/bizops_session=([^;]+)/)?.[0] || "";
    const csrfToken = setCookie.match(/bizops_csrf=([^;]+)/)?.[1] || data.csrfToken || "";
    return { status: res.status, data, sessionCookie, csrfToken };
  }

  // Obtain sessions for all 3 roles
  const adminAuth = await loginAs("admin@bizops.ai", adminPassword);
  const approverAuth = await loginAs("approver@bizops.ai", approverPassword);
  const operatorAuth = await loginAs("operator@bizops.ai", operatorPassword);

  console.log("--- Sessions Established ---");
  console.log(`ADMIN session: ${adminAuth.data.user?.email} (${adminAuth.data.user?.role})`);
  console.log(`APPROVER session: ${approverAuth.data.user?.email} (${approverAuth.data.user?.role})`);
  console.log(`OPERATOR session: ${operatorAuth.data.user?.email} (${operatorAuth.data.user?.role})\n`);

  // Test 1: Unauthenticated requests to protected endpoints return 401
  console.log("--- TEST 1: Unauthenticated Requests Return 401 ---");
  const unauthAgent = await fetch(`${baseUrl}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Find customer Rahul" }),
  });
  const unauthApprovals = await fetch(`${baseUrl}/api/approvals`);
  const unauthAudit = await fetch(`${baseUrl}/api/audit-events`);

  console.log(`POST /api/agent (Unauthenticated): ${unauthAgent.status} (Expected: 401)`);
  console.log(`GET /api/approvals (Unauthenticated): ${unauthApprovals.status} (Expected: 401)`);
  console.log(`GET /api/audit-events (Unauthenticated): ${unauthAudit.status} (Expected: 401)`);

  if (unauthAgent.status !== 401 || unauthApprovals.status !== 401 || unauthAudit.status !== 401) {
    throw new Error("Test 1 Failed: Protected routes did not return 401 for unauthenticated requests");
  }
  console.log("✓ Test 1 Passed: Unauthenticated requests blocked with 401.\n");

  // Test 2: OPERATOR attempting to approve or reject returns 403 Forbidden
  console.log("--- TEST 2: OPERATOR Role Blocked from Approvals (403 Forbidden) ---");
  // Find or create a test pending approval request
  let pendingApp = await prisma.approvalRequest.findFirst({
    where: { status: "PENDING" },
  });

  if (!pendingApp) {
    pendingApp = await prisma.approvalRequest.create({
      data: {
        id: `APR-RBAC-${Date.now().toString().slice(-4)}`,
        title: "Test RBAC approval item",
        description: "Testing role boundaries",
        actionType: "SEND_INVOICE_REMINDER",
        toolName: "send-email",
        arguments: { invoiceNumber: "INV-2048" },
        reason: "RBAC security test",
        customer: "Rahul Sharma",
        status: "PENDING",
      },
    });
  }

  const operatorApprove = await fetch(`${baseUrl}/api/approvals/${pendingApp.id}/approve`, {
    method: "POST",
    headers: {
      Cookie: `${operatorAuth.sessionCookie}; bizops_csrf=${operatorAuth.csrfToken}`,
      "X-CSRF-Token": operatorAuth.csrfToken,
      Origin: "http://localhost:5173",
    },
  });
  const operatorApproveData = await operatorApprove.json();
  console.log(`OPERATOR Approve Status: ${operatorApprove.status} (Expected: 403)`);
  console.log(`Response message: "${operatorApproveData.message}"`);

  const operatorReject = await fetch(`${baseUrl}/api/approvals/${pendingApp.id}/reject`, {
    method: "POST",
    headers: {
      Cookie: `${operatorAuth.sessionCookie}; bizops_csrf=${operatorAuth.csrfToken}`,
      "X-CSRF-Token": operatorAuth.csrfToken,
      Origin: "http://localhost:5173",
    },
    body: JSON.stringify({ reason: "Operator trying to reject" }),
  });
  console.log(`OPERATOR Reject Status: ${operatorReject.status} (Expected: 403)`);

  if (operatorApprove.status !== 403 || operatorReject.status !== 403) {
    throw new Error("Test 2 Failed: OPERATOR was not blocked from approving/rejecting with 403");
  }
  console.log("✓ Test 2 Passed: OPERATOR role strictly blocked from approval decisions with 403.\n");

  // Test 3: OPERATOR CAN query Agent and create proposals
  console.log("--- TEST 3: OPERATOR Allowed on /api/agent ---");
  const operatorAgent = await fetch(`${baseUrl}/api/agent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${operatorAuth.sessionCookie}; bizops_csrf=${operatorAuth.csrfToken}`,
      "X-CSRF-Token": operatorAuth.csrfToken,
      Origin: "http://localhost:5173",
    },
    body: JSON.stringify({ message: "Find customer ABC Technologies" }),
  });
  const operatorAgentData = await operatorAgent.json();
  console.log(`OPERATOR /api/agent Status: ${operatorAgent.status}, Success: ${operatorAgentData.success}`);
  if (operatorAgent.status !== 200 || !operatorAgentData.success) {
    throw new Error("Test 3 Failed: OPERATOR was blocked from /api/agent");
  }
  console.log("✓ Test 3 Passed: OPERATOR can execute permitted agent workflows.\n");

  // Test 4: APPROVER can approve a pending request & Actor Lockdown verification
  console.log("--- TEST 4: APPROVER Approval & Actor Lockdown (Ignore Client Actor) ---");
  const testApprovalId = `APR-RBAC-LOCK-${Date.now().toString().slice(-4)}`;
  await prisma.approvalRequest.create({
    data: {
      id: testApprovalId,
      title: "Actor Lockdown Test Request",
      description: "Verifying actor cannot be spoofed by client body",
      actionType: "SEND_INVOICE_REMINDER",
      toolName: "send-email",
      arguments: { invoiceNumber: "INV-2048" },
      reason: "Security lockdown verification",
      customer: "Rahul Sharma",
      status: "PENDING",
    },
  });

  // Attempt to pass spoofed actor in body
  const approverDecision = await fetch(`${baseUrl}/api/approvals/${testApprovalId}/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${approverAuth.sessionCookie}; bizops_csrf=${approverAuth.csrfToken}`,
      "X-CSRF-Token": approverAuth.csrfToken,
      Origin: "http://localhost:5173",
      actor: "SpoofedHeaderHacker",
    },
    body: JSON.stringify({
      actor: "SpoofedBodyHacker (hacker@evil.com)",
    }),
  });

  const approverDecisionData = await approverDecision.json();
  console.log(`APPROVER Decision Status: ${approverDecision.status}, Success: ${approverDecisionData.success}`);
  console.log(`Reported DecidedBy: "${approverDecisionData.approval?.decidedBy}"`);

  // Verify in PostgreSQL database
  const dbRecord = await prisma.approvalRequest.findUnique({
    where: { id: testApprovalId },
  });
  const dbAuditEvent = await prisma.auditEvent.findFirst({
    where: { approvalRequestId: testApprovalId, eventType: "DECISION_APPROVED" },
    orderBy: { timestamp: "desc" },
  });

  console.log(`PostgreSQL DB decidedBy: "${dbRecord?.decidedBy}"`);
  console.log(`PostgreSQL AuditEvent actor: "${dbAuditEvent?.actor}"`);
  console.log(`PostgreSQL AuditEvent payload userId: "${(dbAuditEvent?.payload as any)?.decidedByUserId}"`);

  const expectedActor = "Finance & Compliance Approver (approver@bizops.ai)";

  if (
    approverDecision.status !== 200 ||
    dbRecord?.decidedBy !== expectedActor ||
    dbAuditEvent?.actor !== expectedActor ||
    !(dbAuditEvent?.payload as any)?.decidedByUserId
  ) {
    throw new Error("Test 4 Failed: DecidedBy or AuditEvent actor did not lock to authenticated user identity");
  }
  console.log("✓ Test 4 Passed: Client spoofed actor ignored. Authenticated user locked as canonical authorizer.\n");

  // Test 5: Duplicate decision guard returns 400
  console.log("--- TEST 5: Duplicate Decision Protection ---");
  const dupDecision = await fetch(`${baseUrl}/api/approvals/${testApprovalId}/approve`, {
    method: "POST",
    headers: {
      Cookie: `${approverAuth.sessionCookie}; bizops_csrf=${approverAuth.csrfToken}`,
      "X-CSRF-Token": approverAuth.csrfToken,
      Origin: "http://localhost:5173",
    },
  });
  console.log(`Duplicate Approval Status: ${dupDecision.status} (Expected: 400)`);
  if (dupDecision.status !== 400) {
    throw new Error("Test 5 Failed: Duplicate decision was not rejected with 400");
  }
  console.log("✓ Test 5 Passed: Concurrency & duplicate decision protection intact.\n");

  // Test 6: ADMIN can reject a request
  console.log("--- TEST 6: ADMIN Role Can Reject Pending Request ---");
  const rejectTestId = `APR-RBAC-REJ-${Date.now().toString().slice(-4)}`;
  await prisma.approvalRequest.create({
    data: {
      id: rejectTestId,
      title: "Admin Rejection Test",
      description: "Testing rejection authorization",
      actionType: "REFUND_PAYMENT",
      toolName: "payment-refund",
      arguments: { paymentId: "PAY-100" },
      reason: "Admin rejection check",
      customer: "Ananya Iyer",
      status: "PENDING",
    },
  });

  const adminReject = await fetch(`${baseUrl}/api/approvals/${rejectTestId}/reject`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${adminAuth.sessionCookie}; bizops_csrf=${adminAuth.csrfToken}`,
      "X-CSRF-Token": adminAuth.csrfToken,
      Origin: "http://localhost:5173",
    },
    body: JSON.stringify({ reason: "Admin policy enforcement override" }),
  });
  const adminRejectData = await adminReject.json();
  console.log(`ADMIN Reject Status: ${adminReject.status}, Decision Status: ${adminRejectData.approval?.status}`);
  if (adminReject.status !== 200 || adminRejectData.approval?.status !== "REJECTED") {
    throw new Error("Test 6 Failed: ADMIN was unable to reject request");
  }
  console.log("✓ Test 6 Passed: ADMIN successfully rejected action with verified identity.\n");

  // Test 7: Audit endpoint RBAC (OPERATOR -> 403, APPROVER & ADMIN -> 200)
  console.log("--- TEST 7: Audit Endpoint Role Enforcement ---");
  const operatorAudit = await fetch(`${baseUrl}/api/audit-events`, {
    headers: { Cookie: operatorAuth.sessionCookie, Origin: "http://localhost:5173" },
  });
  console.log(`OPERATOR /api/audit-events: ${operatorAudit.status} (Expected: 403)`);

  const approverAudit = await fetch(`${baseUrl}/api/audit-events`, {
    headers: { Cookie: approverAuth.sessionCookie, Origin: "http://localhost:5173" },
  });
  console.log(`APPROVER /api/audit-events: ${approverAudit.status} (Expected: 200)`);

  const adminAudit = await fetch(`${baseUrl}/api/audit-events`, {
    headers: { Cookie: adminAuth.sessionCookie, Origin: "http://localhost:5173" },
  });
  console.log(`ADMIN /api/audit-events: ${adminAudit.status} (Expected: 200)`);

  if (operatorAudit.status !== 403 || approverAudit.status !== 200 || adminAudit.status !== 200) {
    throw new Error("Test 7 Failed: Audit endpoint RBAC permissions incorrect");
  }
  console.log("✓ Test 7 Passed: Audit logs restricted to governance roles (ADMIN, APPROVER).\n");

  // Test 8: CSRF Protection on Mutating Approval Routes
  console.log("--- TEST 8: CSRF Protection on State-Changing Approval Endpoint ---");
  const csrfFailApprove = await fetch(`${baseUrl}/api/approvals/${testApprovalId}/approve`, {
    method: "POST",
    headers: {
      Cookie: `${approverAuth.sessionCookie}; bizops_csrf=fake-csrf-token`,
      "X-CSRF-Token": "invalid-mismatched-csrf-token",
      Origin: "http://localhost:5173",
    },
  });
  console.log(`Mismatched CSRF Status: ${csrfFailApprove.status} (Expected: 403)`);
  if (csrfFailApprove.status !== 403) {
    throw new Error("Test 8 Failed: CSRF mismatch was not rejected with 403");
  }
  console.log("✓ Test 8 Passed: CSRF verification protects mutating endpoints.\n");

  // Test 9: Disabled User Cannot Access Protected Endpoints
  console.log("--- TEST 9: Disabled User Session Invalidation ---");
  await prisma.user.update({
    where: { email: "operator@bizops.ai" },
    data: { isActive: false },
  });

  const disabledAccess = await fetch(`${baseUrl}/api/agent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: operatorAuth.sessionCookie,
      Origin: "http://localhost:5173",
    },
    body: JSON.stringify({ message: "Hello" }),
  });
  console.log(`Disabled User /api/agent Access: ${disabledAccess.status} (Expected: 401)`);

  // Restore user
  await prisma.user.update({
    where: { email: "operator@bizops.ai" },
    data: { isActive: true },
  });

  if (disabledAccess.status !== 401) {
    throw new Error("Test 9 Failed: Disabled user was not rejected with 401");
  }
  console.log("✓ Test 9 Passed: Disabled user immediately blocked from all endpoints.\n");

  console.log("=================================================");
  console.log("  ALL RBAC & ACTOR LOCKDOWN TESTS PASSED! 🛡️⚡   ");
  console.log("=================================================");

  await prisma.$disconnect();
}

runRbacTests().catch(async (err) => {
  console.error("❌ RBAC test suite failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
