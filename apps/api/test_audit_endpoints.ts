import { prisma } from "./src/lib/prisma.js";

async function runAuditTests() {
  console.log("=================================================");
  console.log("    BIZOPS AI - AUDIT API ENDPOINTS TEST SUITE   ");
  console.log("=================================================\n");

  const baseUrl = "http://localhost:4000";

  // Authenticate as APPROVER / ADMIN for audit read access
  const adminPassword = process.env.DEV_ADMIN_PASSWORD || "AdminDev@123!";
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
    body: JSON.stringify({ email: "admin@bizops.ai", password: adminPassword }),
  });
  const loginData = await loginRes.json();
  const setCookie = loginRes.headers.get("set-cookie") || "";
  const sessionCookie = setCookie.match(/bizops_session=([^;]+)/)?.[0] || "";
  const csrfToken = setCookie.match(/bizops_csrf=([^;]+)/)?.[1] || loginData.csrfToken || "";

  const authHeaders = {
    Cookie: `${sessionCookie}; bizops_csrf=${csrfToken}`,
    "X-CSRF-Token": csrfToken,
    Origin: "http://localhost:5173",
  };

  // Test 1: GET /api/audit-events (Default)
  console.log("--- TEST 1: GET /api/audit-events (Default Pagination) ---");
  const res1 = await fetch(`${baseUrl}/api/audit-events`, { headers: authHeaders });
  const data1 = await res1.json();
  console.log(`Status: ${res1.status}, Success: ${data1.success}`);
  console.log(`Total records: ${data1.pagination?.total}, Returned in page: ${data1.data?.length}`);
  console.log(`Stats breakdown:`, data1.stats);

  if (!data1.success || !Array.isArray(data1.data) || !data1.pagination) {
    throw new Error("Test 1 Failed: Expected valid audit events response");
  }
  console.log("✓ Test 1 Passed: Default list returned valid response and pagination.\n");

  // Test 2: Pagination parameters
  console.log("--- TEST 2: Pagination (page=1&limit=2 vs page=2&limit=2) ---");
  const resPage1 = await fetch(`${baseUrl}/api/audit-events?page=1&limit=2`, { headers: authHeaders });
  const dataPage1 = await resPage1.json();
  const resPage2 = await fetch(`${baseUrl}/api/audit-events?page=2&limit=2`, { headers: authHeaders });
  const dataPage2 = await resPage2.json();

  console.log(`Page 1 IDs: ${dataPage1.data.map((d: any) => d.id).join(", ")}`);
  console.log(`Page 2 IDs: ${dataPage2.data.map((d: any) => d.id).join(", ")}`);

  if (dataPage1.data.length !== 2 || dataPage2.data.length !== 2) {
    throw new Error("Test 2 Failed: Pagination limit did not restrict results");
  }
  if (dataPage1.data[0].id === dataPage2.data[0].id) {
    throw new Error("Test 2 Failed: Page 1 and Page 2 returned identical records");
  }
  console.log("✓ Test 2 Passed: Pagination correctly offsets records.\n");

  // Test 3: Filter by Event Type
  console.log("--- TEST 3: Filter by eventType=DECISION_APPROVED ---");
  const resApproved = await fetch(`${baseUrl}/api/audit-events?eventType=DECISION_APPROVED`, { headers: authHeaders });
  const dataApproved = await resApproved.json();
  console.log(`Count of DECISION_APPROVED: ${dataApproved.data.length}`);
  for (const item of dataApproved.data) {
    if (item.eventType !== "DECISION_APPROVED") {
      throw new Error(`Test 3 Failed: Non-matching eventType found: ${item.eventType}`);
    }
  }
  console.log("✓ Test 3 Passed: eventType filtering works accurately.\n");

  // Test 4: Filter by Search Keyword
  console.log("--- TEST 4: Search Keyword (e.g. 'Vikram' or 'DECISION') ---");
  const resSearch = await fetch(`${baseUrl}/api/audit-events?search=DECISION`, { headers: authHeaders });
  const dataSearch = await resSearch.json();
  console.log(`Search 'DECISION' returned ${dataSearch.data.length} matches`);
  if (!dataSearch.success || dataSearch.data.length === 0) {
    throw new Error("Test 4 Failed: Search failed to find matching records");
  }
  console.log("✓ Test 4 Passed: Search filtering works.\n");

  // Test 5: Get Single Audit Event by ID
  console.log("--- TEST 5: GET /api/audit-events/:id ---");
  const firstId = data1.data[0].id;
  const resSingle = await fetch(`${baseUrl}/api/audit-events/${firstId}`, { headers: authHeaders });
  const dataSingle = await resSingle.json();
  console.log(`Fetched ID: ${dataSingle.data?.id}, Event Type: ${dataSingle.data?.eventType}, Actor: ${dataSingle.data?.actor}`);
  if (!dataSingle.success || dataSingle.data?.id !== firstId) {
    throw new Error("Test 5 Failed: Single audit event lookup failed");
  }
  console.log("✓ Test 5 Passed: Single audit event endpoint works.\n");

  // Test 6: Non-existent ID (404 Error handling)
  console.log("--- TEST 6: GET /api/audit-events/non-existent-id (404 Test) ---");
  const res404 = await fetch(`${baseUrl}/api/audit-events/non-existent-id`, { headers: authHeaders });
  console.log(`Status code: ${res404.status}`);
  if (res404.status !== 404) {
    throw new Error(`Test 6 Failed: Expected 404 but got ${res404.status}`);
  }
  console.log("✓ Test 6 Passed: 404 returned gracefully.\n");

  // Test 7: Verify No Side Effects (Read-only guarantee)
  console.log("--- TEST 7: Verifying Database Immutability (Read-Only Guarantee) ---");
  const countBefore = await prisma.auditEvent.count();
  await fetch(`${baseUrl}/api/audit-events?limit=100`, { headers: authHeaders });
  await fetch(`${baseUrl}/api/audit-events/${firstId}`, { headers: authHeaders });
  const countAfter = await prisma.auditEvent.count();
  console.log(`Audit records before: ${countBefore}, after: ${countAfter}`);
  if (countBefore !== countAfter) {
    throw new Error("Test 7 Failed: Audit records changed after read operation!");
  }
  console.log("✓ Test 7 Passed: No side-effects detected during read queries.\n");

  console.log("=================================================");
  console.log("    ALL AUDIT API ENDPOINT TESTS PASSED! 🛡️      ");
  console.log("=================================================");

  await prisma.$disconnect();
}

runAuditTests().catch(async (err) => {
  console.error("❌ Audit test failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
