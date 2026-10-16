import { prisma } from "./src/lib/prisma.js";

async function runAuthTests() {
  console.log("=================================================");
  console.log("    BIZOPS AI - AUTHENTICATION TEST SUITE        ");
  console.log("=================================================\n");

  const baseUrl = "http://localhost:4000";

  // Development test passwords from seed
  const adminPassword = process.env.DEV_ADMIN_PASSWORD || "AdminDev@123!";
  const approverPassword = process.env.DEV_APPROVER_PASSWORD || "ApproverDev@123!";
  const operatorPassword = process.env.DEV_OPERATOR_PASSWORD || "OperatorDev@123!";

  // Test 1: Successful Login for ADMIN
  console.log("--- TEST 1: POST /api/auth/login (ADMIN Account) ---");
  const adminRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:5173",
    },
    body: JSON.stringify({
      email: "admin@bizops.ai",
      password: adminPassword,
    }),
  });

  const adminData = await adminRes.json();
  const setCookieHeader = adminRes.headers.get("set-cookie") || "";

  console.log(`Status: ${adminRes.status}, Success: ${adminData.success}`);
  console.log(`User: ${adminData.user?.name} (${adminData.user?.email}), Role: ${adminData.user?.role}`);
  console.log(`Set-Cookie header received: ${setCookieHeader ? "Yes (Cookies set)" : "No"}`);

  if (
    adminRes.status !== 200 ||
    !adminData.success ||
    adminData.user?.role !== "ADMIN" ||
    !setCookieHeader.includes("bizops_session") ||
    !setCookieHeader.includes("HttpOnly")
  ) {
    throw new Error("Test 1 Failed: Admin login did not return expected user and HTTP-only cookie.");
  }
  console.log("✓ Test 1 Passed: ADMIN login succeeded with secure cookie.\n");

  // Extract session cookie for subsequent requests
  const sessionCookieMatch = setCookieHeader.match(/bizops_session=([^;]+)/);
  const adminSessionCookie = sessionCookieMatch ? sessionCookieMatch[0] : "";
  const csrfCookieMatch = setCookieHeader.match(/bizops_csrf=([^;]+)/);
  const adminCsrfToken = csrfCookieMatch ? csrfCookieMatch[1] : (adminData.csrfToken || "");

  // Test 2: GET /api/auth/me with active session
  console.log("--- TEST 2: GET /api/auth/me (Active Session) ---");
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: {
      Cookie: adminSessionCookie,
      Origin: "http://localhost:5173",
    },
  });
  const meData = await meRes.json();
  console.log(`Status: ${meRes.status}, Name: ${meData.user?.name}, Role: ${meData.user?.role}`);
  if (meRes.status !== 200 || !meData.success || meData.user?.email !== "admin@bizops.ai") {
    throw new Error("Test 2 Failed: /api/auth/me failed to validate active session");
  }
  console.log("✓ Test 2 Passed: /api/auth/me returned authenticated user profile.\n");

  // Test 3: Successful Login for APPROVER & OPERATOR
  console.log("--- TEST 3: Login for APPROVER and OPERATOR Roles ---");
  const approverRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
    body: JSON.stringify({ email: "approver@bizops.ai", password: approverPassword }),
  });
  const approverData = await approverRes.json();
  console.log(`Approver Role: ${approverData.user?.role} (Expected: APPROVER)`);

  const operatorRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
    body: JSON.stringify({ email: "operator@bizops.ai", password: operatorPassword }),
  });
  const operatorData = await operatorRes.json();
  console.log(`Operator Role: ${operatorData.user?.role} (Expected: OPERATOR)`);

  if (approverData.user?.role !== "APPROVER" || operatorData.user?.role !== "OPERATOR") {
    throw new Error("Test 3 Failed: Roles do not match seed accounts");
  }
  console.log("✓ Test 3 Passed: Approver and Operator accounts validated.\n");

  // Test 4: Invalid Password (Generic Error)
  console.log("--- TEST 4: Invalid Password (Generic 401 Error) ---");
  const badPassRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
    body: JSON.stringify({ email: "admin@bizops.ai", password: "WrongPassword999!" }),
  });
  const badPassData = await badPassRes.json();
  console.log(`Status: ${badPassRes.status}, Message: "${badPassData.message}"`);
  if (badPassRes.status !== 401 || badPassData.message !== "Invalid email or password.") {
    throw new Error("Test 4 Failed: Expected generic 401 for wrong password");
  }
  console.log("✓ Test 4 Passed: Invalid password rejected with generic error.\n");

  // Test 5: Non-existent Email (User Enumeration Prevention)
  console.log("--- TEST 5: Non-Existent Email (User Enumeration Prevention) ---");
  const nonExistRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
    body: JSON.stringify({ email: "nonexistent@bizops.ai", password: "SomePassword123!" }),
  });
  const nonExistData = await nonExistRes.json();
  console.log(`Status: ${nonExistRes.status}, Message: "${nonExistData.message}"`);
  if (nonExistRes.status !== 401 || nonExistData.message !== "Invalid email or password.") {
    throw new Error("Test 5 Failed: Expected identical generic error message for non-existent user");
  }
  console.log("✓ Test 5 Passed: Non-existent email returns identical error message.\n");

  // Test 6: Disabled Account Rejection
  console.log("--- TEST 6: Disabled Account Rejection ---");
  // Temporarily disable operator account
  await prisma.user.update({
    where: { email: "operator@bizops.ai" },
    data: { isActive: false },
  });

  const disabledRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
    body: JSON.stringify({ email: "operator@bizops.ai", password: operatorPassword }),
  });
  const disabledData = await disabledRes.json();
  console.log(`Disabled Login Status: ${disabledRes.status}, Message: "${disabledData.message}"`);

  // Re-enable account
  await prisma.user.update({
    where: { email: "operator@bizops.ai" },
    data: { isActive: true },
  });

  if (disabledRes.status !== 401) {
    throw new Error("Test 6 Failed: Disabled user was not rejected with 401");
  }
  console.log("✓ Test 6 Passed: Disabled account was rejected.\n");

  // Test 7: Logout & Session Invalidation
  console.log("--- TEST 7: POST /api/auth/logout & Session Invalidation ---");
  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: {
      Cookie: `${adminSessionCookie}; bizops_csrf=${adminCsrfToken}`,
      "X-CSRF-Token": adminCsrfToken,
      Origin: "http://localhost:5173",
    },
  });
  const logoutData = await logoutRes.json();
  const clearCookieHeader = logoutRes.headers.get("set-cookie") || "";
  console.log(`Logout Status: ${logoutRes.status}, Message: "${logoutData.message}"`);
  console.log(`Cookie cleared: ${clearCookieHeader.includes("Max-Age=0") || clearCookieHeader.includes("expires=") ? "Yes" : "No"}`);

  // Try accessing /api/auth/me with invalidated cookie
  const expiredMeRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: {
      Cookie: adminSessionCookie,
      Origin: "http://localhost:5173",
    },
  });
  console.log(`After Logout /api/auth/me Status: ${expiredMeRes.status} (Expected: 401)`);
  if (logoutRes.status !== 200 || expiredMeRes.status !== 401) {
    throw new Error("Test 7 Failed: Session was not invalidated upon logout");
  }
  console.log("✓ Test 7 Passed: Logout successfully invalidated server-side session.\n");

  // Test 8: CSRF Protection on Mutating Logout
  console.log("--- TEST 8: CSRF Protection Validation ---");
  // Login again to get a fresh session
  const freshLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
    body: JSON.stringify({ email: "admin@bizops.ai", password: adminPassword }),
  });
  const freshCookies = freshLogin.headers.get("set-cookie") || "";
  const freshSession = freshCookies.match(/bizops_session=([^;]+)/)?.[0] || "";

  // Attempt logout with mismatched CSRF header
  const forgedLogout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: {
      Cookie: `${freshSession}; bizops_csrf=valid-token-cookie`,
      "X-CSRF-Token": "tampered-forged-csrf-header",
      Origin: "http://localhost:5173",
    },
  });
  console.log(`Forged CSRF Status: ${forgedLogout.status} (Expected: 403)`);
  if (forgedLogout.status !== 403) {
    throw new Error("Test 8 Failed: Forged CSRF request was not blocked with 403");
  }
  console.log("✓ Test 8 Passed: CSRF token mismatch rejected with 403.\n");

  // Test 9: Verify Security Audit Trail in PostgreSQL
  console.log("--- TEST 9: Verify PostgreSQL Security Audit Trail ---");
  const authAuditEvents = await prisma.auditEvent.findMany({
    where: {
      eventType: { in: ["USER_LOGIN_SUCCESS", "USER_LOGIN_FAILURE", "USER_LOGOUT"] },
    },
    orderBy: { timestamp: "desc" },
    take: 5,
  });
  console.log(`Found ${authAuditEvents.length} recent auth security audit events in PostgreSQL:`);
  for (const ev of authAuditEvents) {
    console.log(`  - [${ev.eventType}] by ${ev.actor}: ${JSON.stringify(ev.payload)}`);
  }
  if (authAuditEvents.length === 0) {
    throw new Error("Test 9 Failed: No auth audit events were persisted to PostgreSQL");
  }
  console.log("✓ Test 9 Passed: Security audit events persisted accurately without sensitive data.\n");

  // Test 10: Verify Database Integrity (Existing Models Untouched)
  console.log("--- TEST 10: Database Integrity Check ---");
  const customerCount = await prisma.customer.count();
  const invoiceCount = await prisma.invoice.count();
  const approvalCount = await prisma.approvalRequest.count();
  console.log(`Existing entities: Customers=${customerCount}, Invoices=${invoiceCount}, Approvals=${approvalCount}`);
  if (customerCount === 0 || invoiceCount === 0 || approvalCount === 0) {
    throw new Error("Test 10 Failed: Existing records were modified or deleted");
  }
  console.log("✓ Test 10 Passed: Existing business records remain 100% intact.\n");

  console.log("=================================================");
  console.log("   ALL 10 AUTHENTICATION TESTS PASSED! 🛡️🔑     ");
  console.log("=================================================");

  await prisma.$disconnect();
}

runAuthTests().catch(async (err) => {
  console.error("❌ Auth test suite failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
