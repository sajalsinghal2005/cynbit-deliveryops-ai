import { prisma } from "./src/lib/prisma.js";

async function runTests() {
  console.log("=================================================");
  console.log("   BIZOPS AI - POSTGRESQL + PRISMA TEST SUITE    ");
  console.log("=================================================\n");

  const baseUrl = "http://localhost:4000";

  // Login as ADMIN for authorized test operations
  const adminPassword = process.env.DEV_ADMIN_PASSWORD || "AdminDev@123!";
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
    body: JSON.stringify({ email: "admin@bizops.ai", password: adminPassword }),
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok || !loginData.success) {
    throw new Error(`Migration test login failed with HTTP ${loginRes.status}: ${JSON.stringify(loginData)}`);
  }
  const setCookie = loginRes.headers.get("set-cookie") || "";
  const sessionCookie = setCookie.match(/bizops_session=([^;]+)/)?.[0] || "";
  const csrfToken = setCookie.match(/bizops_csrf=([^;]+)/)?.[1] || loginData.csrfToken || "";

  console.log(`✓ Authenticated as: ${loginData.user?.name} (${loginData.user?.role})\n`);

  const authHeaders = {
    "Content-Type": "application/json",
    Cookie: `${sessionCookie}; bizops_csrf=${csrfToken}`,
    "X-CSRF-Token": csrfToken,
    Origin: "http://localhost:5173",
  };

  // Test 1: Verify PostgreSQL connection & tables
  console.log("--- TEST 1: Database Connectivity & Initial Counts ---");
  const customerCount = await prisma.customer.count();
  const invoiceCount = await prisma.invoice.count();
  const approvalCount = await prisma.approvalRequest.count();
  const auditCount = await prisma.auditEvent.count();

  console.log(`✓ PostgreSQL Connected:`);
  console.log(`  - Customers: ${customerCount}`);
  console.log(`  - Invoices: ${invoiceCount}`);
  console.log(`  - Approvals: ${approvalCount}`);
  console.log(`  - Audit Events: ${auditCount}`);

  if (customerCount === 0 || invoiceCount === 0) {
    throw new Error("Database tables are empty. Seed may be required.");
  }

  // Test 2: Customer Search via Agent API
  console.log("\n--- TEST 2: Customer Search via Agent ---");
  const custRes = await fetch(`${baseUrl}/api/agent`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ message: "Find customer ABC Technologies" }),
  });
  const custData = await custRes.json();
  console.log(`Status: ${custRes.status}, Success: ${custData.success}`);
  console.log(`Tool used: ${custData.toolUsed}`);
  console.log(`Message preview: ${custData.message.slice(0, 120)}...`);
  if (!custData.success || custData.toolUsed !== "customer-search") {
    throw new Error("Customer search test failed");
  }
  console.log("✓ Customer search test passed!");

  // Test 3: Invoice Search via Agent API
  console.log("\n--- TEST 3: Invoice Search (Overdue > ₹50,000) ---");
  const invRes = await fetch(`${baseUrl}/api/agent`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ message: "Find overdue invoices above ₹50,000" }),
  });
  const invData = await invRes.json();
  console.log(`Status: ${invRes.status}, Success: ${invData.success}`);
  console.log(`Tool used: ${invData.toolUsed}`);
  console.log(`Total Matches: ${invData.data?.totalMatches}`);
  if (!invData.success || invData.toolUsed !== "invoice-search") {
    throw new Error("Invoice search test failed");
  }
  console.log("✓ Invoice search test passed!");

  // Test 4: Approval Proposal Creation via Agent API
  console.log("\n--- TEST 4: Prepare Reminder Emails (Approval Proposal) ---");
  const propRes = await fetch(`${baseUrl}/api/agent`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      message: "Prepare reminder emails for overdue invoices above ₹50,000",
    }),
  });
  const propData = await propRes.json();
  console.log(`Status: ${propRes.status}, Success: ${propData.success}`);
  console.log(`Approval Required: ${propData.approvalRequired}`);
  const createdApprovalId = propData.data?.approvalRequest?.id;
  console.log(`Created Approval ID: ${createdApprovalId}`);
  if (!propData.approvalRequired || !createdApprovalId) {
    throw new Error("Approval proposal generation failed");
  }
  console.log("✓ Approval proposal creation passed!");

  // Verify created approval is in PostgreSQL
  const dbApproval = await prisma.approvalRequest.findUnique({
    where: { id: createdApprovalId },
  });
  if (!dbApproval) {
    throw new Error(`Approval ${createdApprovalId} was not found in PostgreSQL!`);
  }
  console.log(`✓ Verified Approval ${createdApprovalId} stored in PostgreSQL with status ${dbApproval.status}`);

  // Test 5: List Approvals API
  console.log("\n--- TEST 5: GET /api/approvals ---");
  const listRes = await fetch(`${baseUrl}/api/approvals`, {
    headers: authHeaders,
  });
  const listData = await listRes.json();
  console.log(`Status: ${listRes.status}, Count: ${listData.count}`);
  const foundInList = listData.approvals?.some((a: any) => a.id === createdApprovalId);
  if (!listData.success || !foundInList) {
    throw new Error("List approvals failed to return the created approval");
  }
  console.log("✓ List approvals endpoint passed!");

  // Test 6: Get Single Approval API
  console.log(`\n--- TEST 6: GET /api/approvals/${createdApprovalId} ---`);
  const getRes = await fetch(`${baseUrl}/api/approvals/${createdApprovalId}`, {
    headers: authHeaders,
  });
  const getData = await getRes.json();
  console.log(`Status: ${getRes.status}, Success: ${getData.success}, Title: ${getData.approval?.title}`);
  if (!getData.success || getData.approval?.id !== createdApprovalId) {
    throw new Error("Get single approval failed");
  }
  console.log("✓ Get single approval endpoint passed!");

  // Test 7: Approve the Proposal
  console.log(`\n--- TEST 7: POST /api/approvals/${createdApprovalId}/approve ---`);
  const approveRes = await fetch(`${baseUrl}/api/approvals/${createdApprovalId}/approve`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({}),
  });
  const approveData = await approveRes.json();
  console.log(`Status: ${approveRes.status}, Success: ${approveData.success}`);
  console.log(`Decision Status: ${approveData.approval?.status}`);
  console.log(`Execution Status: ${approveData.approval?.executionStatus}`);
  console.log(`Simulated: ${approveData.executionResult?.simulated}`);
  if (
    !approveData.success ||
    approveData.approval?.status !== "APPROVED" ||
    approveData.approval?.executionStatus !== "SUCCESS"
  ) {
    throw new Error("Approve proposal failed");
  }
  console.log("✓ Approval decision passed!");

  // Test 8: Duplicate Concurrent Decision Protection (Atomic Concurrency Guard)
  console.log("\n--- TEST 8: Duplicate / Already-Decided Concurrency Guard ---");
  const dupRes = await fetch(`${baseUrl}/api/approvals/${createdApprovalId}/approve`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({}),
  });
  const dupData = await dupRes.json();
  console.log(`Duplicate Request Status: ${dupRes.status} (Expected: 400)`);
  console.log(`Response message: ${dupData.message}`);
  if (dupRes.status !== 400 || dupData.success === true) {
    throw new Error("Duplicate decision guard failed to block duplicate approval!");
  }
  console.log("✓ Concurrency & duplicate decision guard passed!");

  // Test 9: Reject a pending request
  console.log("\n--- TEST 9: Reject Request ---");
  const pendingApproval = await prisma.approvalRequest.findFirst({
    where: { status: "PENDING" },
  });

  if (pendingApproval) {
    const rejectRes = await fetch(`${baseUrl}/api/approvals/${pendingApproval.id}/reject`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        reason: "Discounts must not exceed standard threshold",
      }),
    });
    const rejectData = await rejectRes.json();
    console.log(`Status: ${rejectRes.status}, Status: ${rejectData.approval?.status}`);
    if (!rejectData.success || rejectData.approval?.status !== "REJECTED") {
      throw new Error(`Rejection test failed for ${pendingApproval.id}`);
    }
    console.log(`✓ Rejection test passed for ${pendingApproval.id}!`);
  } else {
    console.log("No pending approval found to test rejection.");
  }

  // Test 10: Verify Audit Events in PostgreSQL
  console.log("\n--- TEST 10: Verify PostgreSQL Audit Trail ---");
  const auditEvents = await prisma.auditEvent.findMany({
    orderBy: { timestamp: "desc" },
    take: 5,
  });
  console.log(`Found ${auditEvents.length} recent audit events in PostgreSQL:`);
  for (const event of auditEvents) {
    console.log(`  - [${event.eventType}] by ${event.actor} (approval: ${event.approvalRequestId}): ${JSON.stringify(event.payload)}`);
  }
  if (auditEvents.length === 0) {
    throw new Error("No audit events recorded in PostgreSQL!");
  }
  console.log("✓ Audit event persistence passed!");

  console.log("\n=================================================");
  console.log("       ALL 10 MIGRATION TESTS PASSED! 🎉         ");
  console.log("=================================================");

  await prisma.$disconnect();
}

runTests().catch(async (err) => {
  console.error("❌ Test failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
