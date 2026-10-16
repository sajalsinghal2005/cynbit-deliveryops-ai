import { prisma } from "./src/lib/prisma.js";

async function runHardeningTestSuite() {
  console.log("==================================================================");
  console.log("   BIZOPS AI - PHASE 5.4 SECURITY & INTEGRATION HARDENING SUITE   ");
  console.log("==================================================================\n");

  const baseUrl = "http://localhost:4000";
  const origin = "http://localhost:5173";

  const adminPassword = process.env.DEV_ADMIN_PASSWORD || "AdminDev@123!";
  const approverPassword = process.env.DEV_APPROVER_PASSWORD || "ApproverDev@123!";
  const operatorPassword = process.env.DEV_OPERATOR_PASSWORD || "OperatorDev@123!";

  // Dedicated test cleanup tracker
  const createdTestUserIds: string[] = [];
  const createdTestApprovalIds: string[] = [];

  // Snapshot initial business record counts for immutability verification
  const initialCustomerCount = await prisma.customer.count();
  const initialInvoiceCount = await prisma.invoice.count();
  const initialApprovalCount = await prisma.approvalRequest.count();

  console.log("--- Baseline Data Integrity Snapshot ---");
  console.log(`Customers: ${initialCustomerCount}, Invoices: ${initialInvoiceCount}, Approvals: ${initialApprovalCount}\n`);

  // Helper: login and get tokens
  async function loginAs(email: string, pass: string) {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ email, password: pass }),
    });
    const data = await res.json();
    const setCookie = res.headers.get("set-cookie") || "";
    const sessionMatch = setCookie.match(/bizops_session=([^;]+)/);
    const csrfMatch = setCookie.match(/bizops_csrf=([^;]+)/);
    return {
      status: res.status,
      data,
      sessionToken: sessionMatch ? sessionMatch[1] : "",
      csrfToken: csrfMatch ? csrfMatch[1] : (data.csrfToken || ""),
      rawSetCookie: setCookie,
    };
  }

  // Helper: authenticated API request
  async function requestApi(
    endpoint: string,
    auth: { sessionToken?: string; csrfToken?: string },
    options: {
      method?: string;
      body?: any;
      headers?: Record<string, string>;
      omitCsrfHeader?: boolean;
      customOrigin?: string;
    } = {}
  ) {
    const method = options.method || "GET";
    const reqHeaders: Record<string, string> = {
      Origin: options.customOrigin !== undefined ? options.customOrigin : origin,
      ...(options.headers || {}),
    };

    if (options.body && typeof options.body === "object") {
      reqHeaders["Content-Type"] = "application/json";
    }

    const cookies: string[] = [];
    if (auth.sessionToken) {
      cookies.push(`bizops_session=${auth.sessionToken}`);
    }
    if (auth.csrfToken) {
      cookies.push(`bizops_csrf=${auth.csrfToken}`);
      if (!options.omitCsrfHeader && ["POST", "PATCH", "PUT", "DELETE"].includes(method) && !reqHeaders["X-CSRF-Token"]) {
        reqHeaders["X-CSRF-Token"] = auth.csrfToken;
      }
    }
    if (cookies.length > 0) {
      reqHeaders["Cookie"] = cookies.join("; ");
    }

    const res = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: reqHeaders,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    let data: any = null;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    return { status: res.status, ok: res.ok, data, headers: res.headers };
  }

  try {
    // -------------------------------------------------------------
    // SECTION 1: AUTHENTICATION & AUTHORIZATION PERMISSIONS MATRIX
    // -------------------------------------------------------------
    console.log("=================================================");
    console.log(" SECTION 1: AUTHENTICATION & ROLE ACCESS MATRIX ");
    console.log("=================================================");

    let adminAuth = await loginAs("admin@bizops.ai", adminPassword);
    const approverAuth = await loginAs("approver@bizops.ai", approverPassword);
    const operatorAuth = await loginAs("operator@bizops.ai", operatorPassword);

    console.log(`ADMIN: ${adminAuth.data.user?.email} (${adminAuth.data.user?.role})`);
    console.log(`APPROVER: ${approverAuth.data.user?.email} (${approverAuth.data.user?.role})`);
    console.log(`OPERATOR: ${operatorAuth.data.user?.email} (${operatorAuth.data.user?.role})\n`);

    if (adminAuth.status !== 200 || approverAuth.status !== 200 || operatorAuth.status !== 200) {
      throw new Error("Section 1 Failure: Could not authenticate test users");
    }

    // 1.1 Unauthenticated requests to all protected routes return 401
    console.log("--- 1.1: Unauthenticated Requests Blocked with 401 ---");
    const unauthChecks = [
      await requestApi("/api/auth/me", {}),
      await requestApi("/api/agent", {}, { method: "POST", body: { message: "test" } }),
      await requestApi("/api/approvals", {}),
      await requestApi("/api/audit-events", {}),
      await requestApi("/api/admin/users", {}),
    ];
    for (const check of unauthChecks) {
      if (check.status !== 401) {
        throw new Error(`1.1 Failed: Expected 401 but got ${check.status}`);
      }
    }
    console.log("✓ 1.1 Passed: All protected routes strictly return 401 for unauthenticated requests.\n");

    // 1.2 OPERATOR Role Restrictions
    console.log("--- 1.2: OPERATOR Role Authorization Checks ---");
    const opAgent = await requestApi("/api/agent", operatorAuth, {
      method: "POST",
      body: { message: "Find customer Rahul" },
    });
    const opApprovalsRead = await requestApi("/api/approvals", operatorAuth);
    const opAudit = await requestApi("/api/audit-events", operatorAuth);
    const opAdmin = await requestApi("/api/admin/users", operatorAuth);

    console.log(`OPERATOR POST /api/agent: ${opAgent.status} (Expected: 200)`);
    console.log(`OPERATOR GET /api/approvals: ${opApprovalsRead.status} (Expected: 200)`);
    console.log(`OPERATOR GET /api/audit-events: ${opAudit.status} (Expected: 403 Forbidden)`);
    console.log(`OPERATOR GET /api/admin/users: ${opAdmin.status} (Expected: 403 Forbidden)`);

    if (opAgent.status !== 200 || opApprovalsRead.status !== 200 || opAudit.status !== 403 || opAdmin.status !== 403) {
      throw new Error("1.2 Failed: OPERATOR role restrictions violated");
    }
    console.log("✓ 1.2 Passed: OPERATOR role accurately scoped.\n");

    // 1.3 APPROVER Role Restrictions
    console.log("--- 1.3: APPROVER Role Authorization Checks ---");
    const appAgent = await requestApi("/api/agent", approverAuth, {
      method: "POST",
      body: { message: "Find invoice" },
    });
    const appApprovals = await requestApi("/api/approvals", approverAuth);
    const appAudit = await requestApi("/api/audit-events", approverAuth);
    const appAdmin = await requestApi("/api/admin/users", approverAuth);

    console.log(`APPROVER POST /api/agent: ${appAgent.status} (Expected: 403 Forbidden)`);
    console.log(`APPROVER GET /api/approvals: ${appApprovals.status} (Expected: 200)`);
    console.log(`APPROVER GET /api/audit-events: ${appAudit.status} (Expected: 200)`);
    console.log(`APPROVER GET /api/admin/users: ${appAdmin.status} (Expected: 403 Forbidden)`);

    if (appAgent.status !== 403 || appApprovals.status !== 200 || appAudit.status !== 200 || appAdmin.status !== 403) {
      throw new Error("1.3 Failed: APPROVER role restrictions violated");
    }
    console.log("✓ 1.3 Passed: APPROVER role accurately scoped.\n");

    // 1.4 Inactive / Disabled User Rejection
    console.log("--- 1.4: Inactive Account Rejection ---");
    const disabledUserEmail = `disabled.test.${Date.now()}@bizops.test`;
    const createDisabled = await requestApi("/api/admin/users", adminAuth, {
      method: "POST",
      body: { name: "Disabled Person", email: disabledUserEmail, role: "OPERATOR", temporaryPassword: "TempPassword@123!" },
    });
    const disabledUserId = createDisabled.data.user.id;
    createdTestUserIds.push(disabledUserId);

    // Deactivate user
    await requestApi(`/api/admin/users/${disabledUserId}/status`, adminAuth, {
      method: "PATCH",
      body: { isActive: false },
    });

    // Attempt login with disabled account
    const disabledLogin = await loginAs(disabledUserEmail, "TempPassword@123!");
    console.log(`Disabled login status: ${disabledLogin.status} (Expected: 401), Message: "${disabledLogin.data?.message}"`);
    if (disabledLogin.status !== 401 || !disabledLogin.data?.message?.includes("Account is disabled")) {
      throw new Error("1.4 Failed: Disabled account was not rejected with proper message");
    }
    console.log("✓ 1.4 Passed: Disabled accounts blocked from authentication.\n");

    // -------------------------------------------------------------
    // SECTION 2: CSRF, COOKIES & SESSION SECURITY
    // -------------------------------------------------------------
    console.log("=================================================");
    console.log(" SECTION 2: CSRF & SESSION SECURITY HARDENING   ");
    console.log("=================================================");

    // 2.1 Cookie Security Attributes
    console.log("--- 2.1: Cookie Flags & Attribute Verification ---");
    const rawSetCookie = adminAuth.rawSetCookie;
    console.log(`Set-Cookie header received: ${rawSetCookie ? "Yes" : "No"}`);
    if (!rawSetCookie.includes("HttpOnly") || !rawSetCookie.includes("SameSite=Lax") || !rawSetCookie.includes("Path=/")) {
      throw new Error("2.1 Failed: Session cookie missing HttpOnly, SameSite=Lax, or Path=/");
    }
    console.log("✓ 2.1 Passed: Session cookie flags verified (HttpOnly, SameSite=Lax, Path=/).\n");

    // 2.2 CSRF Protection on Cookie Mutations
    console.log("--- 2.2: CSRF Enforcement on Cookie Mutations ---");
    // Missing X-CSRF-Token header on mutating endpoint
    const missingCsrf = await requestApi("/api/admin/users", adminAuth, {
      method: "POST",
      omitCsrfHeader: true,
      body: { name: "Csrf Hacker", email: "hacker@test.com", role: "OPERATOR" },
    });
    console.log(`Missing CSRF Token Status: ${missingCsrf.status} (Expected: 403 Forbidden)`);

    // Mismatched X-CSRF-Token header
    const forgedCsrf = await requestApi("/api/admin/users", adminAuth, {
      method: "POST",
      headers: { "X-CSRF-Token": "forged_malicious_token" },
      body: { name: "Csrf Hacker 2", email: "hacker2@test.com", role: "OPERATOR" },
    });
    console.log(`Forged CSRF Token Status: ${forgedCsrf.status} (Expected: 403 Forbidden)`);

    // CSRF on Agent route
    const agentMissingCsrf = await requestApi("/api/agent", operatorAuth, {
      method: "POST",
      omitCsrfHeader: true,
      body: { message: "Test agent csrf" },
    });
    console.log(`Agent route missing CSRF Status: ${agentMissingCsrf.status} (Expected: 403 Forbidden)`);

    if (missingCsrf.status !== 403 || forgedCsrf.status !== 403 || agentMissingCsrf.status !== 403) {
      throw new Error("2.2 Failed: Mutating requests with missing or forged CSRF were not blocked with 403");
    }
    console.log("✓ 2.2 Passed: Cookie-authenticated mutations require verified CSRF token.\n");

    // 2.3 CORS Enforcement
    console.log("--- 2.3: CORS Origin Policy Enforcement ---");
    const untrustedCors = await requestApi("/api/auth/me", adminAuth, {
      customOrigin: "http://attacker-controlled-site.com",
    });
    console.log(`Untrusted Origin Status: ${untrustedCors.status} (Expected: Non-200 / CORS rejection)`);

    const trustedCors = await requestApi("/api/auth/me", adminAuth, {
      customOrigin: "http://localhost:5173",
    });
    console.log(`Trusted Origin Status: ${trustedCors.status} (Expected: 200)`);
    console.log(`Access-Control-Allow-Credentials: ${trustedCors.headers.get("access-control-allow-credentials")}`);

    if (untrustedCors.status === 200 || trustedCors.status !== 200 || trustedCors.headers.get("access-control-allow-credentials") !== "true") {
      throw new Error("2.3 Failed: CORS origin enforcement failed");
    }
    console.log("✓ 2.3 Passed: CORS strictly accepts only configured origins with credentials.\n");

    // 2.4 Server-Side Session Invalidation on Logout
    console.log("--- 2.4: Session Invalidation on Logout ---");
    const tempUserEmail = `logout.test.${Date.now()}@bizops.test`;
    const tempPass = "LogoutTest@123!";
    const createTemp = await requestApi("/api/admin/users", adminAuth, {
      method: "POST",
      body: { name: "Logout Test", email: tempUserEmail, role: "OPERATOR", temporaryPassword: tempPass },
    });
    const tempUserId = createTemp.data.user.id;
    createdTestUserIds.push(tempUserId);

    const tempLogin = await loginAs(tempUserEmail, tempPass);
    console.log(`Temporary user logged in: ${tempLogin.status === 200}`);

    // Verify session active
    const preLogoutMe = await requestApi("/api/auth/me", tempLogin);
    console.log(`Pre-logout /api/auth/me: ${preLogoutMe.status} (Expected: 200)`);

    // Logout
    const logoutRes = await requestApi("/api/auth/logout", tempLogin, { method: "POST" });
    console.log(`Logout status: ${logoutRes.status} (Expected: 200)`);

    // Verify subsequent call with old session token returns 401
    const postLogoutMe = await requestApi("/api/auth/me", tempLogin);
    console.log(`Post-logout /api/auth/me: ${postLogoutMe.status} (Expected: 401)`);

    if (preLogoutMe.status !== 200 || logoutRes.status !== 200 || postLogoutMe.status !== 401) {
      throw new Error("2.4 Failed: Logout did not invalidate server-side session");
    }
    console.log("✓ 2.4 Passed: Logout immediately invalidates session in PostgreSQL.\n");

    // 2.5 Zero Secret Leakage in Responses
    console.log("--- 2.5: Zero Secret Leakage Verification ---");
    const usersListRes = await requestApi("/api/admin/users", adminAuth);
    const sessionsListRes = await requestApi(`/api/admin/users/${adminAuth.data.user.id}/sessions`, adminAuth);

    const listStr = JSON.stringify(usersListRes.data);
    const sessStr = JSON.stringify(sessionsListRes.data);

    if (listStr.includes("passwordHash") || listStr.includes("sessionTokenHash")) {
      throw new Error("2.5 CRITICAL LEAK: passwordHash or sessionTokenHash exposed in user list!");
    }
    if (sessStr.includes("sessionTokenHash") || sessStr.includes("cookie")) {
      throw new Error("2.5 CRITICAL LEAK: sessionTokenHash exposed in sessions list!");
    }
    console.log("✓ 2.5 Passed: Zero sensitive hashes or token secrets exposed in API responses.\n");

    // -------------------------------------------------------------
    // SECTION 3: ADMIN USER MANAGEMENT HARDENING & CONCURRENCY
    // -------------------------------------------------------------
    console.log("=================================================");
    console.log(" SECTION 3: ADMIN USER MANAGEMENT & CONCURRENCY ");
    console.log("=================================================");

    const actingAdminId = adminAuth.data.user.id;

    // 3.1 Self-Safeguards: Prevent self-demotion and self-deactivation
    console.log("--- 3.1: Self-Demotion & Self-Deactivation Prevention ---");
    const selfDemote = await requestApi(`/api/admin/users/${actingAdminId}`, adminAuth, {
      method: "PATCH",
      body: { role: "OPERATOR" },
    });
    console.log(`Self-demotion status: ${selfDemote.status} (Expected: 400), Message: "${selfDemote.data?.message}"`);

    const selfDeactivate = await requestApi(`/api/admin/users/${actingAdminId}/status`, adminAuth, {
      method: "PATCH",
      body: { isActive: false },
    });
    console.log(`Self-deactivation status: ${selfDeactivate.status} (Expected: 400), Message: "${selfDeactivate.data?.message}"`);

    if (selfDemote.status !== 400 || selfDeactivate.status !== 400) {
      throw new Error("3.1 Failed: Self-demotion or self-deactivation was not rejected with 400");
    }
    console.log("✓ 3.1 Passed: Administrators blocked from demoting or deactivating their own account.\n");

    // 3.2 Concurrent Cross-Deactivation Invariant Test
    console.log("--- 3.2: Concurrent Cross-Deactivation Test ---");
    const admin2Email = `concurrent.admin2.${Date.now()}@bizops.test`;
    const admin2Pass = "Admin2Concur@123!";
    const createAdmin2 = await requestApi("/api/admin/users", adminAuth, {
      method: "POST",
      body: { name: "Concurrent Admin 2", email: admin2Email, role: "ADMIN", temporaryPassword: admin2Pass },
    });
    const admin2Id = createAdmin2.data.user.id;
    createdTestUserIds.push(admin2Id);

    const admin2Auth = await loginAs(admin2Email, admin2Pass);
    console.log(`Admin 2 authenticated: ${admin2Auth.status === 200}`);

    const preDeactCount = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
    console.log(`Active Admins before cross-deactivation: ${preDeactCount} (Exactly 2)`);

    console.log("Firing simultaneous cross-deactivations: Admin 1 deactivates Admin 2, Admin 2 deactivates Admin 1...");
    const [deact2By1, deact1By2] = await Promise.all([
      requestApi(`/api/admin/users/${admin2Id}/status`, adminAuth, { method: "PATCH", body: { isActive: false } }),
      requestApi(`/api/admin/users/${actingAdminId}/status`, admin2Auth, { method: "PATCH", body: { isActive: false } }),
    ]);

    console.log(`Admin 1 deactivates Admin 2 status: ${deact2By1.status}`);
    console.log(`Admin 2 deactivates Admin 1 status: ${deact1By2.status}`);

    const postDeactCount = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
    console.log(`Active Admins in DB after cross-deactivation: ${postDeactCount} (Must be >= 1)`);

    if (postDeactCount < 1) {
      throw new Error("3.2 CRITICAL VIOLATION: System left with zero active administrators!");
    }
    if (deact2By1.status === 200 && deact1By2.status === 200) {
      throw new Error("3.2 CRITICAL VIOLATION: Both concurrent deactivations succeeded! Invariant broken!");
    }

    // Restore Admin 1 and Admin 2 to active ADMIN
    await prisma.user.updateMany({
      where: { id: { in: [actingAdminId, admin2Id] } },
      data: { role: "ADMIN", isActive: true },
    });
    console.log("✓ 3.2 Passed: Concurrent cross-deactivation strictly serializes and protects the last admin.\n");

    // 3.3 Concurrent Cross-Demotion Invariant Test
    console.log("--- 3.3: Concurrent Cross-Demotion Test ---");
    console.log("Firing simultaneous cross-demotions: Admin 1 demotes Admin 2, Admin 2 demotes Admin 1...");
    const [demote2By1, demote1By2] = await Promise.all([
      requestApi(`/api/admin/users/${admin2Id}`, adminAuth, { method: "PATCH", body: { role: "OPERATOR" } }),
      requestApi(`/api/admin/users/${actingAdminId}`, admin2Auth, { method: "PATCH", body: { role: "OPERATOR" } }),
    ]);

    console.log(`Admin 1 demotes Admin 2 status: ${demote2By1.status}`);
    console.log(`Admin 2 demotes Admin 1 status: ${demote1By2.status}`);

    const postDemoteCount = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
    console.log(`Active Admins in DB after cross-demotion: ${postDemoteCount} (Must be >= 1)`);

    if (postDemoteCount < 1) {
      throw new Error("3.3 CRITICAL VIOLATION: System left with zero active administrators!");
    }
    if (demote2By1.status === 200 && demote1By2.status === 200) {
      throw new Error("3.3 CRITICAL VIOLATION: Both concurrent demotions succeeded! Invariant broken!");
    }

    // Restore acting admin
    await prisma.user.update({
      where: { id: actingAdminId },
      data: { role: "ADMIN", isActive: true },
    });
    // Re-authenticate admin in case its session was revoked during the concurrent demotion attempt
    adminAuth = await loginAs("admin@bizops.ai", adminPassword);
    console.log("✓ 3.3 Passed: Concurrent cross-demotion strictly serializes and protects the last admin.\n");

    // 3.4 Password Reset & Session Revocation
    console.log("--- 3.4: Password Reset & Session Revocation ---");
    const newSecurePass = "NewSecurePassword@456!";
    const resetRes = await requestApi(`/api/admin/users/${tempUserId}/reset-password`, adminAuth, {
      method: "POST",
      body: { newPassword: newSecurePass, revokeSessions: true },
    });
    console.log(`Password reset status: ${resetRes.status} (Expected: 200), Sessions revoked: ${resetRes.data?.sessionsRevoked}`);

    const oldPassLogin = await loginAs(tempUserEmail, tempPass);
    console.log(`Login with old password status: ${oldPassLogin.status} (Expected: 401)`);

    const newPassLogin = await loginAs(tempUserEmail, newSecurePass);
    console.log(`Login with new password status: ${newPassLogin.status} (Expected: 200)`);

    if (resetRes.status !== 200 || oldPassLogin.status !== 401 || newPassLogin.status !== 200) {
      throw new Error("3.4 Failed: Password reset did not correctly update credentials and revoke sessions");
    }
    console.log("✓ 3.4 Passed: Password reset securely invalidates old password and sessions.\n");

    // 3.5 Session Inspector & Granular Revocation
    console.log("--- 3.5: Session Inspector & Granular Revocation ---");
    // Create 2 sessions for temp user
    const sessA = await loginAs(tempUserEmail, newSecurePass);
    const sessB = await loginAs(tempUserEmail, newSecurePass);

    const listSessRes = await requestApi(`/api/admin/users/${tempUserId}/sessions`, adminAuth);
    console.log(`Active sessions listed: ${listSessRes.data?.count} (Expected: >= 2)`);

    const targetSessId = listSessRes.data.sessions[0].id;
    const revokeSingle = await requestApi(`/api/admin/users/${tempUserId}/sessions/${targetSessId}`, adminAuth, {
      method: "DELETE",
    });
    console.log(`Revoke single session status: ${revokeSingle.status} (Expected: 200)`);

    const revokeAll = await requestApi(`/api/admin/users/${tempUserId}/sessions`, adminAuth, {
      method: "DELETE",
    });
    console.log(`Revoke all sessions status: ${revokeAll.status} (Expected: 200), Count: ${revokeAll.data?.count}`);

    const afterRevokeAll = await requestApi(`/api/admin/users/${tempUserId}/sessions`, adminAuth);
    console.log(`Sessions count after bulk revoke: ${afterRevokeAll.data?.count} (Expected: 0)`);

    if (revokeSingle.status !== 200 || revokeAll.status !== 200 || afterRevokeAll.data?.count !== 0) {
      throw new Error("3.5 Failed: Session inspector or revocation failed");
    }
    console.log("✓ 3.5 Passed: Granular and bulk session revocation validated.\n");

    // -------------------------------------------------------------
    // SECTION 4: APPROVALS & AUDIT TRAIL HARDENING
    // -------------------------------------------------------------
    console.log("=================================================");
    console.log(" SECTION 4: APPROVALS & AUDIT TRAIL HARDENING   ");
    console.log("=================================================");

    // 4.1 Concurrent Approval Decision Race Condition Test
    console.log("--- 4.1: Concurrent Approval Race Condition Test ---");
    const raceApprovalId = `APR-RACE-${Date.now().toString().slice(-4)}`;
    await prisma.approvalRequest.create({
      data: {
        id: raceApprovalId,
        title: "Concurrent Race Condition Test",
        description: "Two approvers click approve at the exact same millisecond",
        actionType: "REFUND_PAYMENT",
        toolName: "refund-payment",
        arguments: { paymentId: "PAY-9999", amount: "₹10,000" },
        reason: "Concurrency test",
        customer: "Ananya Iyer",
        status: "PENDING",
      },
    });
    createdTestApprovalIds.push(raceApprovalId);

    console.log(`Simultaneously sending TWO approval decisions for ${raceApprovalId}...`);
    const [decisionA, decisionB] = await Promise.all([
      requestApi(`/api/approvals/${raceApprovalId}/approve`, approverAuth, { method: "POST" }),
      requestApi(`/api/approvals/${raceApprovalId}/approve`, adminAuth, { method: "POST" }),
    ]);

    console.log(`Decision 1 status: ${decisionA.status}`);
    console.log(`Decision 2 status: ${decisionB.status}`);

    const decStatuses = [decisionA.status, decisionB.status].sort();
    if (decStatuses[0] !== 200 || decStatuses[1] !== 400) {
      throw new Error("4.1 Failed: Concurrency guard did not reject duplicate approval with 400!");
    }

    const approvalInDb = await prisma.approvalRequest.findUnique({ where: { id: raceApprovalId } });
    console.log(`Final approval status in DB: ${approvalInDb?.status}, executionStatus: ${approvalInDb?.executionStatus}`);
    if (approvalInDb?.status !== "APPROVED" || approvalInDb?.executionStatus !== "SUCCESS") {
      throw new Error("4.1 Failed: DB record was not set to APPROVED");
    }
    console.log("✓ 4.1 Passed: Concurrent approvals strictly prevented from double-executing.\n");

    // 4.2 Actor Lockdown (Ignore Client Spoofed Actor)
    console.log("--- 4.2: Actor Lockdown Verification ---");
    const spoofApprovalId = `APR-SPOOF-${Date.now().toString().slice(-4)}`;
    await prisma.approvalRequest.create({
      data: {
        id: spoofApprovalId,
        title: "Spoof Actor Test",
        description: "Client tries to spoof decidedBy",
        actionType: "CANCEL_ORDER",
        toolName: "cancel-order",
        arguments: { orderId: "ORD-9999" },
        reason: "Actor lockdown verification",
        customer: "Vikram Mehta",
        status: "PENDING",
      },
    });
    createdTestApprovalIds.push(spoofApprovalId);

    const spoofDecision = await requestApi(`/api/approvals/${spoofApprovalId}/approve`, approverAuth, {
      method: "POST",
      headers: { actor: "HackerInHeader" },
      body: { actor: "HackerInBody (hacker@evil.com)" },
    });

    console.log(`Decision status: ${spoofDecision.status}`);
    console.log(`DecidedBy reported by API: "${spoofDecision.data?.approval?.decidedBy}"`);

    const spoofDb = await prisma.approvalRequest.findUnique({ where: { id: spoofApprovalId } });
    console.log(`DecidedBy in DB: "${spoofDb?.decidedBy}"`);

    if (
      spoofDb?.decidedBy?.includes("Hacker") ||
      !spoofDb?.decidedBy?.includes(approverAuth.data.user.email)
    ) {
      throw new Error("4.2 CRITICAL VULNERABILITY: Client was able to spoof decidedBy actor!");
    }
    console.log("✓ 4.2 Passed: Client actor ignored; authenticated user canonical identity locked in DB.\n");

    // 4.3 Audit Event Integrity
    console.log("--- 4.3: Audit Trail Integrity & Payload Inspection ---");
    const recentAuditEvents = await prisma.auditEvent.findMany({
      orderBy: { timestamp: "desc" },
      take: 15,
    });

    for (const ev of recentAuditEvents) {
      const payloadStr = JSON.stringify(ev.payload);
      if (
        payloadStr.includes("passwordHash") ||
        payloadStr.includes("sessionTokenHash") ||
        payloadStr.includes("AdminDev@123!") ||
        payloadStr.includes("TempPassword@123!")
      ) {
        throw new Error("4.3 CRITICAL VIOLATION: Sensitive secrets found in AuditEvent payload!");
      }
    }
    console.log(`✓ 4.3 Passed: Verified ${recentAuditEvents.length} recent AuditEvents with zero secret leaks.\n`);

    // -------------------------------------------------------------
    // SECTION 5: DATA INTEGRITY & IMMUTABILITY CONFIRMATION
    // -------------------------------------------------------------
    console.log("=================================================");
    console.log(" SECTION 5: DATABASE INTEGRITY VERIFICATION     ");
    console.log("=================================================");

    const finalCustomerCount = await prisma.customer.count();
    const finalInvoiceCount = await prisma.invoice.count();
    const finalApprovalCount = await prisma.approvalRequest.count({
      where: { id: { notIn: createdTestApprovalIds } },
    });

    console.log(`Final Customers in DB: ${finalCustomerCount} (Baseline: ${initialCustomerCount})`);
    console.log(`Final Invoices in DB: ${finalInvoiceCount} (Baseline: ${initialInvoiceCount})`);
    console.log(`Final Baseline Approvals in DB: ${finalApprovalCount} (Baseline: ${initialApprovalCount})`);

    if (
      finalCustomerCount !== initialCustomerCount ||
      finalInvoiceCount !== initialInvoiceCount ||
      finalApprovalCount !== initialApprovalCount
    ) {
      throw new Error("Section 5 Failure: Existing business records were modified or deleted!");
    }
    console.log("✓ Section 5 Passed: Existing business data 100% preserved and untouched.\n");

    console.log("==================================================================");
    console.log("  ALL PHASE 5.4 HARDENING & INTEGRATION TESTS PASSED! 🛡️⚡🔑✅   ");
    console.log("==================================================================");
  } finally {
    console.log("\n🧹 Cleaning up dedicated test accounts and records...");
    for (const uid of createdTestUserIds) {
      await prisma.session.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    }
    for (const aid of createdTestApprovalIds) {
      await prisma.auditEvent.deleteMany({ where: { approvalRequestId: aid } }).catch(() => {});
      await prisma.approvalRequest.delete({ where: { id: aid } }).catch(() => {});
    }
    console.log(`✓ Purged ${createdTestUserIds.length} test users and ${createdTestApprovalIds.length} test approvals.\n`);
    await prisma.$disconnect();
  }
}

runHardeningTestSuite().catch(async (err) => {
  console.error("❌ Hardening Test Suite Failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
