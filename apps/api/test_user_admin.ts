import { prisma } from "./src/lib/prisma.js";

async function runUserAdminTests() {
  console.log("=================================================");
  console.log("   BIZOPS AI - PHASE 5.1 ADMIN USER MANAGEMENT   ");
  console.log("=================================================\n");

  const baseUrl = "http://localhost:4000";
  const origin = "http://localhost:5173";

  const adminPassword = process.env.DEV_ADMIN_PASSWORD || "AdminDev@123!";
  const approverPassword = process.env.DEV_APPROVER_PASSWORD || "ApproverDev@123!";
  const operatorPassword = process.env.DEV_OPERATOR_PASSWORD || "OperatorDev@123!";

  // Track created test user IDs for cleanup
  const createdTestUserIds: string[] = [];

  // Helper to login and get session + csrf
  async function loginAs(email: string, password: string) {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    const setCookie = res.headers.get("set-cookie") || "";
    const sessionCookieMatch = setCookie.match(/bizops_session=([^;]+)/);
    const csrfCookieMatch = setCookie.match(/bizops_csrf=([^;]+)/);
    return {
      status: res.status,
      data,
      sessionToken: sessionCookieMatch ? sessionCookieMatch[1] : "",
      csrfToken: csrfCookieMatch ? csrfCookieMatch[1] : (data.csrfToken || ""),
    };
  }

  // Helper to make API requests with credentials and CSRF
  async function apiRequest(
    endpoint: string,
    auth: { sessionToken?: string; csrfToken?: string },
    options: {
      method?: string;
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
    if (auth.sessionToken) {
      cookies.push(`bizops_session=${auth.sessionToken}`);
    }
    if (auth.csrfToken) {
      cookies.push(`bizops_csrf=${auth.csrfToken}`);
      if (["POST", "PATCH", "PUT", "DELETE"].includes(method) && !headers["X-CSRF-Token"]) {
        headers["X-CSRF-Token"] = auth.csrfToken;
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

    return { status: res.status, ok: res.ok, data };
  }

  try {
    // 1. Establish sessions
    console.log("--- 1. Authenticating Roles ---");
    const adminAuth = await loginAs("admin@bizops.ai", adminPassword);
    const approverAuth = await loginAs("approver@bizops.ai", approverPassword);
    const operatorAuth = await loginAs("operator@bizops.ai", operatorPassword);

    console.log(`ADMIN session: ${adminAuth.data.user?.email} (${adminAuth.data.user?.role})`);
    console.log(`APPROVER session: ${approverAuth.data.user?.email} (${approverAuth.data.user?.role})`);
    console.log(`OPERATOR session: ${operatorAuth.data.user?.email} (${operatorAuth.data.user?.role})\n`);

    if (adminAuth.status !== 200 || approverAuth.status !== 200 || operatorAuth.status !== 200) {
      throw new Error("Failed to establish authentication for test roles");
    }

    // 2. Unauthenticated access returns 401
    console.log("--- TEST 1: Unauthenticated Requests Return 401 ---");
    const unauthGet = await apiRequest("/api/admin/users", {});
    const unauthPost = await apiRequest("/api/admin/users", {}, {
      method: "POST",
      body: { name: "Test User", email: "test@example.com", role: "OPERATOR" },
    });
    console.log(`GET /api/admin/users (Unauthenticated): ${unauthGet.status} (Expected: 401)`);
    console.log(`POST /api/admin/users (Unauthenticated): ${unauthPost.status} (Expected: 401)`);

    if (unauthGet.status !== 401 || unauthPost.status !== 401) {
      throw new Error("Test 1 Failed: Unauthenticated requests did not return 401");
    }
    console.log("✓ Test 1 Passed: Unauthenticated requests blocked with 401.\n");

    // 3. OPERATOR and APPROVER receive 403
    console.log("--- TEST 2: Non-Admin Roles Receive 403 Forbidden ---");
    const operatorList = await apiRequest("/api/admin/users", operatorAuth);
    const approverList = await apiRequest("/api/admin/users", approverAuth);
    const operatorCreate = await apiRequest("/api/admin/users", operatorAuth, {
      method: "POST",
      body: { name: "Hacker User", email: "hacker@example.com", role: "ADMIN" },
    });

    console.log(`OPERATOR GET /api/admin/users: ${operatorList.status} (Expected: 403)`);
    console.log(`APPROVER GET /api/admin/users: ${approverList.status} (Expected: 403)`);
    console.log(`OPERATOR POST /api/admin/users: ${operatorCreate.status} (Expected: 403)`);

    if (operatorList.status !== 403 || approverList.status !== 403 || operatorCreate.status !== 403) {
      throw new Error("Test 2 Failed: Non-admin users were not blocked with 403");
    }
    console.log("✓ Test 2 Passed: Non-admin roles strictly blocked with 403.\n");

    // 4. ADMIN can list, search, and filter users
    console.log("--- TEST 3: ADMIN Can List, Search, and Filter Users ---");
    const allUsersRes = await apiRequest("/api/admin/users?page=1&limit=10", adminAuth);
    console.log(`List status: ${allUsersRes.status}, Total: ${allUsersRes.data?.pagination?.total}`);
    console.log(`First user: ${allUsersRes.data?.users?.[0]?.name} (${allUsersRes.data?.users?.[0]?.email})`);

    // Search
    const searchRes = await apiRequest("/api/admin/users?search=admin", adminAuth);
    console.log(`Search 'admin' count: ${searchRes.data?.users?.length}`);

    // Filter by role
    const filterRoleRes = await apiRequest("/api/admin/users?role=OPERATOR", adminAuth);
    console.log(`Filter role 'OPERATOR' count: ${filterRoleRes.data?.users?.length}`);

    if (
      allUsersRes.status !== 200 ||
      !Array.isArray(allUsersRes.data?.users) ||
      allUsersRes.data?.users.length < 3 ||
      searchRes.status !== 200 ||
      filterRoleRes.status !== 200
    ) {
      throw new Error("Test 3 Failed: Listing, searching, or filtering failed");
    }

    // Verify passwordHash and sessionTokenHash are NEVER returned
    for (const u of allUsersRes.data.users) {
      if ("passwordHash" in u || "sessionTokenHash" in u) {
        throw new Error("Test 3 Security Violation: Sensitive hashes leaked in user list response!");
      }
    }
    console.log("✓ Test 3 Passed: User listing, search, and filters work with zero hash leaks.\n");

    // 5. ADMIN can create a new user with validated email and role
    console.log("--- TEST 4: ADMIN Can Create User & Temporary Password ---");
    const testEmail1 = `test.user.${Date.now()}@bizops.test`;
    const createRes = await apiRequest("/api/admin/users", adminAuth, {
      method: "POST",
      body: {
        name: "Test Engineer",
        email: testEmail1,
        role: "OPERATOR",
      },
    });

    console.log(`Create status: ${createRes.status}, Success: ${createRes.data?.success}`);
    console.log(`Created user: ${createRes.data?.user?.name} (${createRes.data?.user?.email})`);
    console.log(`Temporary password provided: ${createRes.data?.temporaryPassword ? "Yes" : "No"}`);

    if (
      createRes.status !== 201 ||
      !createRes.data?.success ||
      !createRes.data?.temporaryPassword ||
      createRes.data?.user?.role !== "OPERATOR"
    ) {
      throw new Error("Test 4 Failed: User creation failed");
    }

    const testUser1Id = createRes.data.user.id;
    createdTestUserIds.push(testUser1Id);
    const testUser1Password = createRes.data.temporaryPassword;

    // Verify created user can authenticate with temporary password
    const testUserLogin = await loginAs(testEmail1, testUser1Password);
    console.log(`New user login status: ${testUserLogin.status} (Expected: 200)`);
    if (testUserLogin.status !== 200 || !testUserLogin.data?.success) {
      throw new Error("Test 4 Failed: New user was unable to authenticate with temporary password");
    }
    console.log("✓ Test 4 Passed: User created and authenticated successfully with temporary password.\n");

    // 6. Duplicate email rejection (409)
    console.log("--- TEST 5: Duplicate Email Rejection (409 Conflict) ---");
    const dupRes = await apiRequest("/api/admin/users", adminAuth, {
      method: "POST",
      body: {
        name: "Duplicate Person",
        email: testEmail1,
        role: "APPROVER",
      },
    });
    console.log(`Duplicate status: ${dupRes.status} (Expected: 409), Message: "${dupRes.data?.message}"`);
    if (dupRes.status !== 409) {
      throw new Error("Test 5 Failed: Duplicate email did not return 409");
    }
    console.log("✓ Test 5 Passed: Duplicate email creation rejected with 409.\n");

    // 7. Update user profile and role
    console.log("--- TEST 6: Update User Details & Role ---");
    const updateRes = await apiRequest(`/api/admin/users/${testUser1Id}`, adminAuth, {
      method: "PATCH",
      body: {
        name: "Test Engineer Senior",
        role: "APPROVER",
      },
    });
    console.log(`Update status: ${updateRes.status}, New Name: ${updateRes.data?.user?.name}, New Role: ${updateRes.data?.user?.role}`);
    if (
      updateRes.status !== 200 ||
      updateRes.data?.user?.name !== "Test Engineer Senior" ||
      updateRes.data?.user?.role !== "APPROVER"
    ) {
      throw new Error("Test 6 Failed: User update failed");
    }
    console.log("✓ Test 6 Passed: User profile and role updated successfully.\n");

    // 8. Prevent last active admin demotion and deactivation (including self and concurrent)
    console.log("--- TEST 7: Prevent Last Active Admin Demotion and Deactivation ---");
    // Find acting admin user
    const actingAdminId = adminAuth.data.user.id;

    // 7a. Acting admin attempting self-deactivation -> 400
    const selfDeactivateRes = await apiRequest(`/api/admin/users/${actingAdminId}/status`, adminAuth, {
      method: "PATCH",
      body: { isActive: false },
    });
    console.log(`Self-deactivation status: ${selfDeactivateRes.status} (Expected: 400), Message: "${selfDeactivateRes.data?.message}"`);
    if (selfDeactivateRes.status !== 400) {
      throw new Error("Test 7a Failed: Self-deactivation was not blocked with 400");
    }

    // 7b. Acting admin attempting self-demotion -> 400
    const selfDemoteRes = await apiRequest(`/api/admin/users/${actingAdminId}`, adminAuth, {
      method: "PATCH",
      body: { role: "OPERATOR" },
    });
    console.log(`Self-demotion status: ${selfDemoteRes.status} (Expected: 400), Message: "${selfDemoteRes.data?.message}"`);
    if (selfDemoteRes.status !== 400) {
      throw new Error("Test 7b Failed: Self-demotion was not blocked with 400");
    }

    // 7c. Create a 2nd admin, establish session, then test concurrent attempts to demote both admins
    const testAdminEmail = `temp.admin.${Date.now()}@bizops.test`;
    const admin2Password = "Admin2Pass@123!";
    const createAdmin2 = await apiRequest("/api/admin/users", adminAuth, {
      method: "POST",
      body: {
        name: "Temporary Second Admin",
        email: testAdminEmail,
        role: "ADMIN",
        temporaryPassword: admin2Password,
      },
    });
    const admin2Id = createAdmin2.data.user.id;
    createdTestUserIds.push(admin2Id);

    // Login as Admin 2
    const admin2Auth = await loginAs(testAdminEmail, admin2Password);
    if (admin2Auth.status !== 200) {
      throw new Error("Failed to authenticate Admin 2 for concurrency testing");
    }

    // Now there are exactly 2 active admins (acting admin and admin2).
    const initialAdminsCount = await prisma.user.count({
      where: { role: "ADMIN", isActive: true },
    });
    console.log(`Initial active admin count in DB: ${initialAdminsCount} (Exactly 2 active admins)`);

    // Deterministic Cross-Concurrency HTTP Test:
    // Admin 1 concurrently attempts to demote Admin 2, while Admin 2 attempts to demote Admin 1
    console.log("Simulating simultaneous HTTP cross-demotion attempts...");
    const [crossDemote2By1, crossDemote1By2] = await Promise.all([
      apiRequest(`/api/admin/users/${admin2Id}`, adminAuth, {
        method: "PATCH",
        body: { role: "OPERATOR" },
      }),
      apiRequest(`/api/admin/users/${actingAdminId}`, admin2Auth, {
        method: "PATCH",
        body: { role: "OPERATOR" },
      }),
    ]);

    console.log(`Cross-Demote Admin 2 by Admin 1 status: ${crossDemote2By1.status}`);
    console.log(`Cross-Demote Admin 1 by Admin 2 status: ${crossDemote1By2.status}`);

    const httpRemainingAdmins = await prisma.user.count({
      where: { role: "ADMIN", isActive: true },
    });
    console.log(`Remaining active admins in DB after HTTP test: ${httpRemainingAdmins} (Must be >= 1)`);

    if (httpRemainingAdmins < 1) {
      throw new Error("Test 7 CRITICAL VIOLATION: System left with zero active administrators!");
    }

    if (crossDemote2By1.status === 200 && crossDemote1By2.status === 200) {
      throw new Error("Test 7 CRITICAL VIOLATION: Both concurrent cross-demotions succeeded! Invariant broken!");
    }

    // 7d. Deterministic Direct Service-Level Parallel Cross-Demotion Test
    // Restore Admin 2 and Admin 1 to ADMIN role
    await prisma.user.updateMany({
      where: { id: { in: [actingAdminId, admin2Id] } },
      data: { role: "ADMIN", isActive: true },
    });

    console.log("Simulating direct service-level parallel cross-demotions with pre-authenticated admin profiles...");
    const { userAdminService } = await import("./src/services/user-admin.service.js");
    const admin1Profile = {
      id: actingAdminId,
      name: "Super Admin",
      email: "admin@bizops.ai",
      role: "ADMIN" as const,
      isActive: true,
    };
    const admin2Profile = {
      id: admin2Id,
      name: "Temporary Second Admin",
      email: testAdminEmail,
      role: "ADMIN" as const,
      isActive: true,
    };

    const serviceResults = await Promise.allSettled([
      userAdminService.updateUser(admin1Profile, admin2Id, { role: "OPERATOR" }),
      userAdminService.updateUser(admin2Profile, actingAdminId, { role: "OPERATOR" }),
    ]);

    const serviceFulfilled = serviceResults.filter((r) => r.status === "fulfilled").length;
    const serviceRejected = serviceResults.filter((r) => r.status === "rejected").length;
    console.log(`Service-level parallel demotions: ${serviceFulfilled} fulfilled, ${serviceRejected} rejected.`);

    for (let i = 0; i < serviceResults.length; i++) {
      const res = serviceResults[i];
      if (res.status === "rejected") {
        console.log(`  - Rejection ${i + 1} reason: "${res.reason?.message}"`);
      }
    }

    const serviceRemainingAdmins = await prisma.user.count({
      where: { role: "ADMIN", isActive: true },
    });
    console.log(`Remaining active admins in DB after direct service test: ${serviceRemainingAdmins} (Must be >= 1)`);

    if (serviceRemainingAdmins < 1) {
      throw new Error("Test 7 CRITICAL VIOLATION: Zero active administrators left after service test!");
    }
    if (serviceFulfilled > 1) {
      throw new Error("Test 7 CRITICAL VIOLATION: Both concurrent demotions succeeded at service level!");
    }

    // Restore acting admin if demoted
    await prisma.user.update({
      where: { id: actingAdminId },
      data: { role: "ADMIN", isActive: true },
    });

    console.log("✓ Test 7 Passed: Last active admin invariant strictly enforced under concurrent operations.\n");

    // 8. Deactivation revokes active sessions immediately
    console.log("--- TEST 8: Deactivation Revokes Sessions Immediately ---");
    // Login as testUser1 to create an active session
    const userSessionLogin = await loginAs(testEmail1, testUser1Password);
    console.log(`Created session for test user: ${userSessionLogin.sessionToken ? "Yes" : "No"}`);

    // Deactivate test user
    const deactivateRes = await apiRequest(`/api/admin/users/${testUser1Id}/status`, adminAuth, {
      method: "PATCH",
      body: { isActive: false },
    });
    console.log(`Deactivation status: ${deactivateRes.status}, Sessions Revoked: ${deactivateRes.data?.sessionsRevoked}`);

    // Verify test user session is immediately rejected with 401
    const testUserPostDeactivate = await apiRequest("/api/auth/me", userSessionLogin);
    console.log(`Test user /api/auth/me after deactivation: ${testUserPostDeactivate.status} (Expected: 401)`);
    if (testUserPostDeactivate.status !== 401) {
      throw new Error("Test 8 Failed: Deactivated user was not blocked with 401");
    }

    // Reactivate test user
    const reactivateRes = await apiRequest(`/api/admin/users/${testUser1Id}/status`, adminAuth, {
      method: "PATCH",
      body: { isActive: true },
    });
    console.log(`Reactivation status: ${reactivateRes.status}, IsActive: ${reactivateRes.data?.user?.isActive}`);
    if (reactivateRes.status !== 200 || !reactivateRes.data?.user?.isActive) {
      throw new Error("Test 8 Failed: Reactivation failed");
    }
    console.log("✓ Test 8 Passed: Deactivation revokes sessions atomically and blocks subsequent requests.\n");

    // 9. Password reset revokes active sessions & verifies new credentials
    console.log("--- TEST 9: Password Reset & Session Invalidation ---");
    const newPassword = `NewSecPass@${Date.now()}!`;
    const resetRes = await apiRequest(`/api/admin/users/${testUser1Id}/reset-password`, adminAuth, {
      method: "POST",
      body: { newPassword, revokeSessions: true },
    });

    console.log(`Password reset status: ${resetRes.status}, Success: ${resetRes.data?.success}`);
    if (resetRes.status !== 200 || !resetRes.data?.success) {
      throw new Error("Test 9 Failed: Password reset failed");
    }

    // Old password should fail
    const oldLoginFail = await loginAs(testEmail1, testUser1Password);
    console.log(`Old password login: ${oldLoginFail.status} (Expected: 401)`);

    // New password should succeed
    const newLoginSuccess = await loginAs(testEmail1, newPassword);
    console.log(`New password login: ${newLoginSuccess.status} (Expected: 200)`);

    if (oldLoginFail.status !== 401 || newLoginSuccess.status !== 200) {
      throw new Error("Test 9 Failed: Password credentials not updated correctly");
    }
    console.log("✓ Test 9 Passed: Password reset securely updated credentials.\n");

    // 10. List active sessions and single/all session revocation
    console.log("--- TEST 10: Session Management & Revocation ---");
    // Create two sessions for testUser1
    const sessA = await loginAs(testEmail1, newPassword);
    const sessB = await loginAs(testEmail1, newPassword);

    const listSessionsRes = await apiRequest(`/api/admin/users/${testUser1Id}/sessions`, adminAuth);
    console.log(`Active sessions count: ${listSessionsRes.data?.count}`);
    if (listSessionsRes.status !== 200 || listSessionsRes.data?.count < 2) {
      throw new Error("Test 10 Failed: Listing sessions failed");
    }

    // Verify sessionTokenHash is NEVER in the response
    for (const s of listSessionsRes.data.sessions) {
      if ("sessionTokenHash" in s) {
        throw new Error("Test 10 Security Violation: sessionTokenHash exposed in session metadata!");
      }
    }

    // Revoke single session
    const targetSessionId = listSessionsRes.data.sessions[0].id;
    const revokeSingleRes = await apiRequest(
      `/api/admin/users/${testUser1Id}/sessions/${targetSessionId}`,
      adminAuth,
      { method: "DELETE" }
    );
    console.log(`Revoke single session status: ${revokeSingleRes.status}`);
    if (revokeSingleRes.status !== 200) {
      throw new Error("Test 10 Failed: Single session revocation failed");
    }

    // Revoke all remaining sessions
    const revokeAllRes = await apiRequest(
      `/api/admin/users/${testUser1Id}/sessions`,
      adminAuth,
      { method: "DELETE" }
    );
    console.log(`Revoke all sessions status: ${revokeAllRes.status}, Revoked count: ${revokeAllRes.data?.count}`);
    if (revokeAllRes.status !== 200) {
      throw new Error("Test 10 Failed: All sessions revocation failed");
    }

    // Verify user has 0 active sessions left
    const sessionsAfterAll = await apiRequest(`/api/admin/users/${testUser1Id}/sessions`, adminAuth);
    console.log(`Sessions count after bulk revoke: ${sessionsAfterAll.data?.count} (Expected: 0)`);
    if (sessionsAfterAll.data?.count !== 0) {
      throw new Error("Test 10 Failed: Sessions still remained after bulk revoke");
    }
    console.log("✓ Test 10 Passed: Session listing and granular/bulk revocation validated.\n");

    // 11. Verify Audit Events Recorded
    console.log("--- TEST 11: Verify Administrative Audit Events in PostgreSQL ---");
    const adminAuditEvents = await prisma.auditEvent.findMany({
      where: {
        eventType: {
          in: [
            "USER_CREATED",
            "USER_UPDATED",
            "USER_ACTIVATED",
            "USER_DEACTIVATED",
            "USER_PASSWORD_RESET",
            "USER_SESSION_REVOKED",
            "USER_ALL_SESSIONS_REVOKED",
          ],
        },
      },
      orderBy: { timestamp: "desc" },
      take: 10,
    });

    console.log(`Found ${adminAuditEvents.length} administrative audit events in PostgreSQL:`);
    for (const ev of adminAuditEvents) {
      console.log(`  - [${ev.eventType}] by ${ev.actor}: target=${(ev.payload as any)?.targetEmail || (ev.payload as any)?.targetUserId}`);
    }

    if (adminAuditEvents.length === 0) {
      throw new Error("Test 11 Failed: No administrative audit events were persisted");
    }

    // Verify actor is the authenticated administrator and no passwords are in payloads
    for (const ev of adminAuditEvents) {
      const payloadStr = JSON.stringify(ev.payload);
      if (
        payloadStr.includes("passwordHash") ||
        payloadStr.includes("sessionTokenHash") ||
        payloadStr.includes("NewSecPass")
      ) {
        throw new Error("Test 11 Security Violation: Secrets leaked into AuditEvent payload!");
      }
      if (!ev.actor.includes("admin@bizops.ai") && !ev.actor.includes("@bizops.test")) {
        throw new Error(`Test 11 Failed: Actor "${ev.actor}" does not match authenticated admin!`);
      }
    }
    console.log("✓ Test 11 Passed: Administrative audit events recorded accurately with verified actor and zero secret leaks.\n");

    console.log("=================================================");
    console.log(" ALL PHASE 5.1 ADMIN USER TESTS PASSED! 🛡️⚡🔑  ");
    console.log("=================================================");
  } finally {
    // Clean up dedicated test records without touching production or seed data
    console.log("\n🧹 Cleaning up test accounts created during test run...");
    for (const id of createdTestUserIds) {
      await prisma.session.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
    console.log(`✓ Cleaned up ${createdTestUserIds.length} test records.\n`);
    await prisma.$disconnect();
  }
}

runUserAdminTests().catch(async (err) => {
  console.error("❌ Phase 5.1 Admin User Tests Failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
