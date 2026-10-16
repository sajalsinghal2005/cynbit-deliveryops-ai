import { prisma } from "./src/lib/prisma.js";

async function runFrontendAuthIntegrationTests() {
  console.log("=================================================");
  console.log(" BIZOPS AI - PHASE 4 FRONTEND AUTH INTEGRATION   ");
  console.log("=================================================\n");

  const baseUrl = "http://localhost:4000";
  const origin = "http://localhost:5173";

  const adminPassword = process.env.DEV_ADMIN_PASSWORD || "AdminDev@123!";
  const approverPassword = process.env.DEV_APPROVER_PASSWORD || "ApproverDev@123!";
  const operatorPassword = process.env.DEV_OPERATOR_PASSWORD || "OperatorDev@123!";

  // Helper function to simulate browser client fetch with credentials and CSRF
  async function simulateClientRequest(
    endpoint: string,
    options: {
      method?: string;
      sessionCookie?: string;
      csrfToken?: string;
      body?: any;
      headers?: Record<string, string>;
    } = {}
  ) {
    const method = options.method || "GET";
    const headers: Record<string, string> = {
      Origin: origin,
      ...(options.headers || {}),
    };

    if (options.body && typeof options.body === "object") {
      headers["Content-Type"] = "application/json";
    }

    const cookies: string[] = [];
    if (options.sessionCookie) {
      cookies.push(`bizops_session=${options.sessionCookie}`);
    }
    if (options.csrfToken) {
      cookies.push(`bizops_csrf=${options.csrfToken}`);
      // Mutating requests automatically attach X-CSRF-Token header in frontend api.ts unless overridden in test
      if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && !headers["X-CSRF-Token"]) {
        headers["X-CSRF-Token"] = options.csrfToken;
      }
    }
    if (cookies.length > 0) {
      headers["Cookie"] = cookies.join("; ");
    }

    const res = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    let data: any = null;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    const setCookie = res.headers.get("set-cookie") || "";
    const sessionCookieMatch = setCookie.match(/bizops_session=([^;]+)/);
    const csrfCookieMatch = setCookie.match(/bizops_csrf=([^;]+)/);

    return {
      status: res.status,
      ok: res.ok,
      data,
      setCookie,
      newSessionCookie: sessionCookieMatch ? sessionCookieMatch[1] : undefined,
      newCsrfToken: csrfCookieMatch ? csrfCookieMatch[1] : (data?.csrfToken || undefined),
    };
  }

  // TEST 1: Unauthenticated access to protected endpoints returns 401 (triggering redirect to /login)
  console.log("--- TEST 1: Unauthenticated Access Triggers 401 (Redirects to /login) ---");
  const unauthMe = await simulateClientRequest("/api/auth/me");
  const unauthApprovals = await simulateClientRequest("/api/approvals");
  const unauthAudit = await simulateClientRequest("/api/audit-events");
  const unauthAgent = await simulateClientRequest("/api/agent", {
    method: "POST",
    body: { message: "Search customers" },
  });

  console.log(`GET /api/auth/me (No session): status ${unauthMe.status} (Expected: 401)`);
  console.log(`GET /api/approvals (No session): status ${unauthApprovals.status} (Expected: 401)`);
  console.log(`GET /api/audit-events (No session): status ${unauthAudit.status} (Expected: 401)`);
  console.log(`POST /api/agent (No session): status ${unauthAgent.status} (Expected: 401)`);

  if (
    unauthMe.status !== 401 ||
    unauthApprovals.status !== 401 ||
    unauthAudit.status !== 401 ||
    unauthAgent.status !== 401
  ) {
    throw new Error("Test 1 Failed: Unauthenticated requests did not return 401");
  }
  console.log("✓ Test 1 Passed: Unauthenticated access triggers 401 to redirect to /login.\n");

  // TEST 2: Correct credentials establish a session with HTTP-only cookie & CSRF cookie
  console.log("--- TEST 2: Correct Credentials Establish Session ---");
  const adminLogin = await simulateClientRequest("/api/auth/login", {
    method: "POST",
    body: { email: "admin@bizops.ai", password: adminPassword },
  });

  console.log(`Login status: ${adminLogin.status}, Success: ${adminLogin.data?.success}`);
  console.log(`User profile returned: ${adminLogin.data?.user?.name} (${adminLogin.data?.user?.role})`);
  console.log(`CSRF token returned: ${adminLogin.newCsrfToken ? "Yes" : "No"}`);
  console.log(`Session cookie set: ${adminLogin.newSessionCookie ? "Yes" : "No"}`);

  if (
    adminLogin.status !== 200 ||
    !adminLogin.data?.success ||
    !adminLogin.newSessionCookie ||
    !adminLogin.newCsrfToken ||
    adminLogin.data?.user?.role !== "ADMIN"
  ) {
    throw new Error("Test 2 Failed: Login did not establish proper session and credentials");
  }
  console.log("✓ Test 2 Passed: Correct credentials established session with secure cookies.\n");

  const adminSession = adminLogin.newSessionCookie;
  const adminCsrf = adminLogin.newCsrfToken;

  // TEST 3: Refreshing the page preserves an active session (GET /api/auth/me)
  console.log("--- TEST 3: Refreshing Page Preserves Active Session ---");
  const refreshMe = await simulateClientRequest("/api/auth/me", {
    sessionCookie: adminSession,
  });

  console.log(`GET /api/auth/me status: ${refreshMe.status}, Success: ${refreshMe.data?.success}`);
  console.log(`Authenticated user: ${refreshMe.data?.user?.email}, Role: ${refreshMe.data?.user?.role}`);

  if (refreshMe.status !== 200 || !refreshMe.data?.success || refreshMe.data?.user?.email !== "admin@bizops.ai") {
    throw new Error("Test 3 Failed: /api/auth/me did not restore active session");
  }
  console.log("✓ Test 3 Passed: Session preserved on reload via /api/auth/me.\n");

  // TEST 4: Logout invalidates the server session
  console.log("--- TEST 4: Logout Invalidates Server Session ---");
  // Establish temporary session to logout
  const tempLogin = await simulateClientRequest("/api/auth/login", {
    method: "POST",
    body: { email: "admin@bizops.ai", password: adminPassword },
  });
  const tempSession = tempLogin.newSessionCookie!;
  const tempCsrf = tempLogin.newCsrfToken!;

  const logoutRes = await simulateClientRequest("/api/auth/logout", {
    method: "POST",
    sessionCookie: tempSession,
    csrfToken: tempCsrf,
  });

  console.log(`POST /api/auth/logout status: ${logoutRes.status}, Message: "${logoutRes.data?.message}"`);

  // Verify session is dead on server
  const afterLogoutMe = await simulateClientRequest("/api/auth/me", {
    sessionCookie: tempSession,
  });
  console.log(`GET /api/auth/me with invalidated session: ${afterLogoutMe.status} (Expected: 401)`);

  if (logoutRes.status !== 200 || afterLogoutMe.status !== 401) {
    throw new Error("Test 4 Failed: Server session was not invalidated upon logout");
  }
  console.log("✓ Test 4 Passed: Logout successfully invalidated server-side session.\n");

  // TEST 5: Expired sessions return the user to login (401)
  console.log("--- TEST 5: Expired Sessions Return 401 ---");
  const expiredRes = await simulateClientRequest("/api/auth/me", {
    sessionCookie: "expired-or-invalid-session-token-12345",
  });
  console.log(`GET /api/auth/me with stale cookie: ${expiredRes.status} (Expected: 401)`);

  if (expiredRes.status !== 401) {
    throw new Error("Test 5 Failed: Stale session did not return 401");
  }
  console.log("✓ Test 5 Passed: Expired session returns 401 without redirect loops.\n");

  // TEST 6: Each role sees appropriate navigation and backend authorization
  console.log("--- TEST 6: Role Verification (ADMIN, OPERATOR, APPROVER) ---");
  const operatorLogin = await simulateClientRequest("/api/auth/login", {
    method: "POST",
    body: { email: "operator@bizops.ai", password: operatorPassword },
  });
  const approverLogin = await simulateClientRequest("/api/auth/login", {
    method: "POST",
    body: { email: "approver@bizops.ai", password: approverPassword },
  });

  const operatorSession = operatorLogin.newSessionCookie!;
  const operatorCsrf = operatorLogin.newCsrfToken!;
  const approverSession = approverLogin.newSessionCookie!;
  const approverCsrf = approverLogin.newCsrfToken!;

  console.log(`ADMIN: ${adminLogin.data?.user?.email} -> Role: ${adminLogin.data?.user?.role}`);
  console.log(`OPERATOR: ${operatorLogin.data?.user?.email} -> Role: ${operatorLogin.data?.user?.role}`);
  console.log(`APPROVER: ${approverLogin.data?.user?.email} -> Role: ${approverLogin.data?.user?.role}`);

  if (
    adminLogin.data?.user?.role !== "ADMIN" ||
    operatorLogin.data?.user?.role !== "OPERATOR" ||
    approverLogin.data?.user?.role !== "APPROVER"
  ) {
    throw new Error("Test 6 Failed: User roles do not match expected identities");
  }
  console.log("✓ Test 6 Passed: All 3 roles established and validated.\n");

  // TEST 7: Forbidden API actions remain blocked by the backend (403 Forbidden)
  console.log("--- TEST 7: Forbidden Actions Blocked by Backend (403) ---");
  // OPERATOR cannot view audit logs
  const operatorAuditAttempt = await simulateClientRequest("/api/audit-events", {
    sessionCookie: operatorSession,
  });
  console.log(`OPERATOR GET /api/audit-events: ${operatorAuditAttempt.status} (Expected: 403)`);

  // OPERATOR cannot approve actions
  const operatorApproveAttempt = await simulateClientRequest("/api/approvals/APR-1025/approve", {
    method: "POST",
    sessionCookie: operatorSession,
    csrfToken: operatorCsrf,
  });
  console.log(`OPERATOR POST /api/approvals/:id/approve: ${operatorApproveAttempt.status} (Expected: 403)`);

  if (operatorAuditAttempt.status !== 403 || operatorApproveAttempt.status !== 403) {
    throw new Error("Test 7 Failed: Forbidden actions were not blocked with 403");
  }
  console.log("✓ Test 7 Passed: Forbidden API actions strictly enforced with 403.\n");

  // TEST 8: Approvals continue working with CSRF protection
  console.log("--- TEST 8: Approvals with CSRF Protection ---");
  const testApprovalId1 = `APR-P4-A-${Date.now().toString().slice(-4)}`;
  const testApprovalId2 = `APR-P4-B-${Date.now().toString().slice(-4)}`;

  await prisma.approvalRequest.createMany({
    data: [
      {
        id: testApprovalId1,
        title: "Phase 4 Forged CSRF Test",
        description: "Testing rejection on forged CSRF header",
        actionType: "SEND_INVOICE_REMINDER",
        toolName: "send-email",
        arguments: { invoiceNumber: "INV-2048" },
        reason: "CSRF security verification",
        customer: "Rahul Sharma",
        status: "PENDING",
      },
      {
        id: testApprovalId2,
        title: "Phase 4 Valid CSRF Test",
        description: "Testing success with matching CSRF cookie and header",
        actionType: "SEND_INVOICE_REMINDER",
        toolName: "send-email",
        arguments: { invoiceNumber: "INV-2048" },
        reason: "CSRF security verification",
        customer: "Rahul Sharma",
        status: "PENDING",
      },
    ],
  });

  // 8a. Tampered CSRF is rejected with 403
  const forgedApprove = await simulateClientRequest(`/api/approvals/${testApprovalId1}/approve`, {
    method: "POST",
    sessionCookie: approverSession,
    csrfToken: "actual-cookie-token",
    headers: { "X-CSRF-Token": "tampered-different-header-token" },
  });
  console.log(`Forged CSRF Approval Status: ${forgedApprove.status} (Expected: 403)`);

  // 8b. Valid CSRF succeeds
  const validApprove = await simulateClientRequest(`/api/approvals/${testApprovalId2}/approve`, {
    method: "POST",
    sessionCookie: approverSession,
    csrfToken: approverCsrf,
  });
  console.log(`Valid CSRF Approval Status: ${validApprove.status}, Success: ${validApprove.data?.success}`);
  console.log(`Decided By: "${validApprove.data?.approval?.decidedBy}"`);

  if (forgedApprove.status !== 403 || validApprove.status !== 200 || !validApprove.data?.success) {
    throw new Error("Test 8 Failed: CSRF protection on approvals did not behave correctly");
  }
  console.log("✓ Test 8 Passed: Approvals enforce CSRF and succeed for authorized approver.\n");

  // TEST 9: Audit Log, customer search, and invoice search remain functional for permitted roles
  console.log("--- TEST 9: Audit Log, Customer Search, and Invoice Search ---");
  // Audit log for APPROVER
  const approverAudit = await simulateClientRequest("/api/audit-events?page=1&limit=5", {
    sessionCookie: approverSession,
  });
  console.log(`APPROVER Audit Log Status: ${approverAudit.status}, Count: ${approverAudit.data?.data?.length}`);

  // Customer search via Agent for OPERATOR
  const operatorCustSearch = await simulateClientRequest("/api/agent", {
    method: "POST",
    sessionCookie: operatorSession,
    body: { message: "Find customer Rahul Sharma" },
  });
  console.log(`OPERATOR Agent Customer Search Status: ${operatorCustSearch.status}, Tool: ${operatorCustSearch.data?.toolUsed}`);

  // Invoice search via Agent for OPERATOR
  const operatorInvSearch = await simulateClientRequest("/api/agent", {
    method: "POST",
    sessionCookie: operatorSession,
    body: { message: "Find invoice INV-2048" },
  });
  console.log(`OPERATOR Agent Invoice Search Status: ${operatorInvSearch.status}, Tool: ${operatorInvSearch.data?.toolUsed}`);

  if (
    approverAudit.status !== 200 ||
    !approverAudit.data?.success ||
    operatorCustSearch.status !== 200 ||
    !operatorCustSearch.data?.success ||
    operatorInvSearch.status !== 200 ||
    !operatorInvSearch.data?.success
  ) {
    throw new Error("Test 9 Failed: Permitted operations failed");
  }
  console.log("✓ Test 9 Passed: Audit Log, customer search, and invoice search functional for permitted roles.\n");

  // TEST 10: Summary
  console.log("=================================================");
  console.log("   ALL PHASE 4 INTEGRATION TESTS PASSED! 🛡️🚀   ");
  console.log("=================================================");

  await prisma.$disconnect();
}

runFrontendAuthIntegrationTests().catch(async (err) => {
  console.error("❌ Phase 4 Integration Tests Failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
