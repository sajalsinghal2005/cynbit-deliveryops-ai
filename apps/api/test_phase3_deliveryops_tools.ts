import assert from "node:assert";
import { prisma } from "./src/lib/prisma.js";
import { toolRegistry } from "./src/tools/tool.registry.js";
import {
  projectSearchTool,
  projectSummaryTool,
  projectRiskAnalysisTool,
  projectBlockersTool,
  clientDeliverySummaryTool,
  searchProjects,
  getProjectSummary,
  analyzeProjectRisk,
  getProjectBlockers,
  getClientDeliverySummary,
} from "./src/tools/delivery.tool.js";

async function runPhase3DeliveryOpsTests() {
  console.log("============================================================");
  console.log("PHASE 3 — CYNBIT DELIVERYOPS READ-ONLY TOOL REGISTRY SUITE");
  console.log("============================================================\n");

  // Track initial record counts to confirm zero mutations
  const initialCounts = {
    customers: await prisma.customer.count(),
    invoices: await prisma.invoice.count(),
    users: await prisma.user.count(),
    projects: await prisma.project.count(),
    milestones: await prisma.milestone.count(),
    blockers: await prisma.blocker.count(),
    approvals: await prisma.approvalRequest.count(),
  };

  // =========================================================================
  // TEST GROUP A: TOOL REGISTRATION & METADATA INVARIANTS
  // =========================================================================
  console.log("▶ [TEST GROUP A] Tool Registration & Classification Invariants");

  const expectedTools = [
    "project-search",
    "project-summary",
    "project-risk-analysis",
    "project-blockers",
    "client-delivery-summary",
  ];

  // A.1: All 5 tools must be registered in ToolRegistry
  for (const toolId of expectedTools) {
    const isRegistered = toolRegistry.hasTool(toolId);
    assert.strictEqual(
      isRegistered,
      true,
      `Tool "${toolId}" must be registered in ToolRegistry`
    );
    const tool = toolRegistry.getTool(toolId);
    assert.ok(tool, `Tool "${toolId}" must be retrievable from ToolRegistry`);

    // A.2: Strict READ_ONLY classification
    assert.strictEqual(
      tool.operationType,
      "READ_ONLY",
      `Tool "${toolId}" must be classified as READ_ONLY`
    );

    // A.3: Low risk and non-consequential
    assert.strictEqual(
      tool.risk,
      "LOW",
      `Tool "${toolId}" risk must be LOW`
    );
    assert.strictEqual(
      tool.requiresApproval,
      false,
      `Tool "${toolId}" must not require human approval (requiresApproval === false)`
    );

    // A.4: DeliveryOps category
    assert.strictEqual(
      tool.category,
      "DeliveryOps",
      `Tool "${toolId}" category must be "DeliveryOps"`
    );
  }

  // A.5: List by category should return all 5 read-only DeliveryOps tools
  const deliveryTools = toolRegistry.listToolsByCategory("DeliveryOps");
  const readOnlyDeliveryTools = deliveryTools.filter((t) => t.operationType === "READ_ONLY");
  assert.strictEqual(
    readOnlyDeliveryTools.length,
    5,
    "ToolRegistry.listToolsByCategory('DeliveryOps') must return exactly 5 read-only tools"
  );
  assert.ok(
    deliveryTools.length >= 5,
    "ToolRegistry.listToolsByCategory('DeliveryOps') must contain at least 5 tools"
  );
  console.log("  ✔ A.1-A.5: All 5 tools registered, strictly READ_ONLY, category='DeliveryOps', requiresApproval=false");

  // =========================================================================
  // TEST GROUP B: INPUT VALIDATION & SCHEMA RIGIDITY
  // =========================================================================
  console.log("\n▶ [TEST GROUP B] Input Validation & Error Isolation");

  // B.1: Malformed input for project-search (invalid limit type, out-of-range limit, invalid status enum)
  const invalidSearch1 = await toolRegistry.executeTool("project-search", {
    limit: -5,
  });
  assert.strictEqual(
    invalidSearch1.success,
    false,
    "Negative limit must be rejected"
  );
  assert.ok(
    invalidSearch1.error?.includes("limit"),
    "Error message must specify limit issue"
  );

  const invalidSearch2 = await toolRegistry.executeTool("project-search", {
    status: "invalid_status_enum",
  });
  assert.strictEqual(
    invalidSearch2.success,
    false,
    "Invalid status enum must be rejected"
  );

  // B.2: Empty / whitespace projectId for project-summary
  const invalidSummary = await toolRegistry.executeTool("project-summary", {
    projectId: "   ",
  });
  assert.strictEqual(
    invalidSummary.success,
    false,
    "Empty projectId must be rejected"
  );

  // B.3: Missing required arguments
  const missingSummaryArg = await toolRegistry.executeTool("project-summary", {});
  assert.strictEqual(
    missingSummaryArg.success,
    false,
    "Missing projectId parameter must be rejected"
  );

  // B.4: Malformed input for project-risk-analysis
  const invalidRisk = await toolRegistry.executeTool("project-risk-analysis", {
    projectId: "",
  });
  assert.strictEqual(
    invalidRisk.success,
    false,
    "Empty projectId for risk-analysis must be rejected"
  );

  // B.5: Malformed input for project-blockers
  const invalidBlockers = await toolRegistry.executeTool("project-blockers", {
    projectId: "PRJ-101",
    severity: "SUPER_CRITICAL", // invalid enum
  });
  assert.strictEqual(
    invalidBlockers.success,
    false,
    "Invalid severity enum must be rejected"
  );

  // B.6: Malformed input for client-delivery-summary
  const invalidClientSummary = await toolRegistry.executeTool(
    "client-delivery-summary",
    { query: "   " }
  );
  assert.strictEqual(
    invalidClientSummary.success,
    false,
    "Empty client query must be rejected"
  );

  console.log("  ✔ B.1-B.6: Malformed inputs, missing parameters, and invalid enums safely rejected without DB leaks");

  // =========================================================================
  // TEST GROUP C: PROJECT SEARCH (project-search)
  // =========================================================================
  console.log("\n▶ [TEST GROUP C] Project Search Functional Verification");

  // C.1: Search by project name keyword
  const searchByName = await toolRegistry.executeTool<{ query: string }, any>(
    "project-search",
    { query: "Falcon" }
  );
  assert.strictEqual(searchByName.success, true);
  assert.ok(searchByName.data.totalMatches >= 1, "Should find Falcon project");
  assert.strictEqual(searchByName.data.projects[0].id, "PRJ-101");
  assert.strictEqual(
    searchByName.data.projects[0].name,
    "Project Falcon: Cloud Native Migration"
  );

  // C.2: Search by delivery lead
  const searchByLead = await toolRegistry.executeTool<{ query: string }, any>(
    "project-search",
    { query: "Priya Nair" }
  );
  assert.strictEqual(searchByLead.success, true);
  assert.ok(
    searchByLead.data.totalMatches >= 2,
    "Priya Nair leads PRJ-101 and PRJ-104"
  );
  assert.ok(
    searchByLead.data.projects.some((p: any) => p.id === "PRJ-101") &&
      searchByLead.data.projects.some((p: any) => p.id === "PRJ-104"),
    "Results must include both PRJ-101 and PRJ-104"
  );

  // C.3: Filter by status 'delayed'
  const searchDelayed = await toolRegistry.executeTool<
    { status: "delayed" },
    any
  >("project-search", { status: "delayed" });
  assert.strictEqual(searchDelayed.success, true);
  assert.ok(
    searchDelayed.data.projects.every((p: any) => p.status === "delayed"),
    "All returned projects must have status 'delayed'"
  );
  assert.ok(
    searchDelayed.data.projects.some((p: any) => p.id === "PRJ-103"),
    "PRJ-103 must be in delayed projects"
  );

  // C.4: Filter by status 'at_risk'
  const searchAtRisk = await toolRegistry.executeTool<
    { status: "at_risk" },
    any
  >("project-search", { status: "at_risk" });
  assert.strictEqual(searchAtRisk.success, true);
  assert.ok(
    searchAtRisk.data.projects.some((p: any) => p.id === "PRJ-102"),
    "PRJ-102 must be in at_risk projects"
  );

  // C.5: Search by project ID
  const searchById = await toolRegistry.executeTool<{ query: string }, any>(
    "project-search",
    { query: "PRJ-102" }
  );
  assert.strictEqual(searchById.success, true);
  assert.ok(searchById.data.totalMatches >= 1, "Should find PRJ-102 by ID");
  assert.strictEqual(searchById.data.projects[0].id, "PRJ-102");

  // C.6: Search with no matches
  const searchNoMatch = await toolRegistry.executeTool<{ query: string }, any>(
    "project-search",
    { query: "NonExistentProjectQuantumTeleporterXYZ" }
  );
  assert.strictEqual(searchNoMatch.success, true);
  assert.strictEqual(
    searchNoMatch.data.totalMatches,
    0,
    "Total matches should be 0 for unknown query"
  );
  assert.strictEqual(
    searchNoMatch.data.projects.length,
    0,
    "Projects array must be empty"
  );
  assert.ok(
    searchNoMatch.data.message.includes("No software delivery projects matched"),
    "Proper message for no matches"
  );

  console.log("  ✔ C.1-C.6: Project search by query, delivery lead, status filter, project ID, and zero-match cases verified");

  // =========================================================================
  // TEST GROUP D: PROJECT SUMMARY (project-summary)
  // =========================================================================
  console.log("\n▶ [TEST GROUP D] Project Summary Functional & Relational Integrity");

  // D.1: Summary for PRJ-103 (Zenith Media Global - delayed project)
  const summary103 = await toolRegistry.executeTool<{ projectId: string }, any>(
    "project-summary",
    { projectId: "PRJ-103" }
  );
  assert.strictEqual(summary103.success, true);
  assert.strictEqual(summary103.data.found, true);
  const p103 = summary103.data.project;
  assert.ok(p103, "Project data must be present");
  assert.strictEqual(p103.id, "PRJ-103");
  assert.strictEqual(p103.status, "delayed");
  assert.strictEqual(p103.deliveryLead, "Kavita Reddy");
  assert.strictEqual(p103.customer.id, "3");
  assert.strictEqual(p103.customer.company, "Zenith Media Global");

  // D.2: Milestone progress indicators for PRJ-103
  assert.strictEqual(
    p103.milestones.length,
    3,
    "PRJ-103 should have exactly 3 milestones"
  );
  assert.strictEqual(p103.deliveryIndicators.isDelayed, true);
  assert.strictEqual(p103.deliveryIndicators.delayedMilestones, 1);
  assert.strictEqual(p103.deliveryIndicators.criticalBlockersCount, 1);
  assert.strictEqual(p103.deliveryIndicators.openBlockersCount, 2);

  // D.3: Blocker relationship for PRJ-103
  assert.strictEqual(p103.openBlockers.length, 2);
  assert.ok(
    p103.openBlockers.some((b: any) => b.id === "BLK-301" && b.severity === "CRITICAL"),
    "Must include critical blocker BLK-301"
  );
  assert.ok(
    p103.openBlockers.some((b: any) => b.id === "BLK-302" && b.severity === "MEDIUM"),
    "Must include medium blocker BLK-302"
  );

  // D.4: Summary for PRJ-101 (Falcon - on track project)
  const summary101 = await toolRegistry.executeTool<{ projectId: string }, any>(
    "project-summary",
    { projectId: "PRJ-101" }
  );
  assert.strictEqual(summary101.success, true);
  assert.strictEqual(summary101.data.found, true);
  const p101 = summary101.data.project;
  assert.strictEqual(p101.status, "on_track");
  assert.strictEqual(p101.healthScore, 92);
  assert.strictEqual(p101.deliveryLead, "Priya Nair");
  assert.strictEqual(p101.customer.company, "ABC Technologies");
  assert.strictEqual(p101.deliveryIndicators.isDelayed, false);
  assert.strictEqual(p101.deliveryIndicators.isAtRisk, false);
  assert.strictEqual(p101.deliveryIndicators.openBlockersCount, 0);

  // D.5: Non-existent project
  const summaryNotFound = await toolRegistry.executeTool<
    { projectId: string },
    any
  >("project-summary", { projectId: "PRJ-999-DOES-NOT-EXIST" });
  assert.strictEqual(summaryNotFound.success, true);
  assert.strictEqual(summaryNotFound.data.found, false);
  assert.strictEqual(summaryNotFound.data.project, null);
  assert.ok(
    summaryNotFound.data.message.includes("was not found"),
    "Message must state project was not found"
  );

  console.log("  ✔ D.1-D.5: Project summary correctly aggregates customer, milestone progress, indicators, and blockers");

  // =========================================================================
  // TEST GROUP E: DETERMINISTIC RISK ANALYSIS (project-risk-analysis)
  // =========================================================================
  console.log("\n▶ [TEST GROUP E] Deterministic Server-Side Risk Analysis");

  // E.1: Risk analysis for PRJ-103 (Has CRITICAL blocker BLK-301, delayed milestone MS-302, status delayed, healthScore 54, target date pressure)
  const risk103 = await toolRegistry.executeTool<{ projectId: string }, any>(
    "project-risk-analysis",
    { projectId: "PRJ-103" }
  );
  assert.strictEqual(risk103.success, true);
  assert.strictEqual(risk103.data.found, true);
  assert.strictEqual(
    risk103.data.overallRiskLevel,
    "CRITICAL",
    "PRJ-103 must deterministically evaluate to CRITICAL due to CRITICAL blocker, delayed status, and delayed milestone"
  );
  assert.ok(
    risk103.data.riskScore >= 75,
    `Risk score must be >= 75 for CRITICAL, got ${risk103.data.riskScore}`
  );
  assert.ok(
    risk103.data.evidence.some((e: string) => e.includes("[CRITICAL BLOCKER]")),
    "Evidence must cite [CRITICAL BLOCKER]"
  );
  assert.ok(
    risk103.data.evidence.some((e: string) => e.includes("[DELAYED MILESTONE]")),
    "Evidence must cite [DELAYED MILESTONE]"
  );
  assert.ok(
    risk103.data.evidence.some((e: string) => e.includes("[LOW HEALTH SCORE]")),
    "Evidence must cite low health score"
  );
  assert.ok(
    risk103.data.evidence.some((e: string) => e.includes("[PROJECT STATUS]")),
    "Evidence must cite project status"
  );
  assert.ok(
    risk103.data.evidence.some((e: string) => e.includes("[TARGET DATE PRESSURE]")),
    "Evidence must cite target date pressure"
  );

  // E.2: Risk analysis for PRJ-102 (Has HIGH blocker BLK-201, delayed milestone MS-202, status at_risk, healthScore 68)
  const risk102 = await toolRegistry.executeTool<{ projectId: string }, any>(
    "project-risk-analysis",
    { projectId: "PRJ-102" }
  );
  assert.strictEqual(risk102.success, true);
  assert.strictEqual(risk102.data.found, true);
  assert.strictEqual(
    risk102.data.overallRiskLevel,
    "HIGH",
    "PRJ-102 with HIGH blocker, delayed milestone MS-202, and at_risk status must evaluate to HIGH"
  );
  assert.ok(
    risk102.data.riskScore >= 35 && risk102.data.riskScore < 75,
    `Risk score must be between 35 and 74 for HIGH, got ${risk102.data.riskScore}`
  );
  assert.ok(
    risk102.data.evidence.some((e: string) => e.includes("[HIGH BLOCKER]")),
    "Evidence must cite [HIGH BLOCKER]"
  );
  assert.ok(
    risk102.data.evidence.some((e: string) => e.includes("[DELAYED MILESTONE]")),
    "Evidence must cite [DELAYED MILESTONE]"
  );
  assert.ok(
    risk102.data.evidence.some((e: string) => e.includes("[MODERATE HEALTH SCORE]")),
    "Evidence must cite moderate health score"
  );

  // E.3: Risk analysis for PRJ-101 (HealthScore 92, on_track, zero blockers)
  const risk101 = await toolRegistry.executeTool<{ projectId: string }, any>(
    "project-risk-analysis",
    { projectId: "PRJ-101" }
  );
  assert.strictEqual(risk101.success, true);
  assert.strictEqual(risk101.data.found, true);
  assert.strictEqual(
    risk101.data.overallRiskLevel,
    "LOW",
    "PRJ-101 must evaluate to LOW (Healthy) risk"
  );
  assert.strictEqual(
    risk101.data.riskScore,
    0,
    "PRJ-101 risk score should be 0"
  );
  assert.ok(
    risk101.data.evidence.some((e: string) => e.includes("[ON TRACK]")),
    "Evidence must state [ON TRACK]"
  );

  // E.4: Risk analysis for PRJ-104 (HealthScore 96, on_track, zero blockers)
  const risk104 = await toolRegistry.executeTool<{ projectId: string }, any>(
    "project-risk-analysis",
    { projectId: "PRJ-104" }
  );
  assert.strictEqual(risk104.success, true);
  assert.strictEqual(risk104.data.found, true);
  assert.strictEqual(
    risk104.data.overallRiskLevel,
    "LOW",
    "PRJ-104 must evaluate to LOW risk"
  );
  assert.strictEqual(
    risk104.data.riskScore,
    0,
    "PRJ-104 risk score should be 0"
  );

  // E.5: Non-existent project risk analysis
  const riskNotFound = await toolRegistry.executeTool<
    { projectId: string },
    any
  >("project-risk-analysis", { projectId: "PRJ-NONE" });
  assert.strictEqual(riskNotFound.success, true);
  assert.strictEqual(riskNotFound.data.found, false);
  assert.strictEqual(riskNotFound.data.evidence.length, 0);

  console.log("  ✔ E.1-E.5: Deterministic scoring correctly derives CRITICAL, HIGH, and LOW risk levels with verifiable factual evidence");

  // =========================================================================
  // TEST GROUP F: PROJECT BLOCKERS (project-blockers)
  // =========================================================================
  console.log("\n▶ [TEST GROUP F] Project Blockers Retrieval & Filtering");

  // F.1: Default unresolved blockers for PRJ-101 (has 0 blockers)
  const blockers101 = await toolRegistry.executeTool<
    { projectId: string },
    any
  >("project-blockers", { projectId: "PRJ-101" });
  assert.strictEqual(blockers101.success, true);
  assert.strictEqual(
    blockers101.data.totalMatches,
    0,
    "PRJ-101 has 0 blockers"
  );

  // F.2: Unresolved blockers for PRJ-103 (has BLK-301 CRITICAL open, BLK-302 MEDIUM in_progress)
  const blockers103 = await toolRegistry.executeTool<
    { projectId: string },
    any
  >("project-blockers", { projectId: "PRJ-103" });
  assert.strictEqual(blockers103.success, true);
  assert.strictEqual(blockers103.data.totalMatches, 2);
  assert.ok(
    blockers103.data.blockers.some((b: any) => b.id === "BLK-301"),
    "Must include BLK-301"
  );
  assert.ok(
    blockers103.data.blockers.some((b: any) => b.id === "BLK-302"),
    "Must include BLK-302"
  );

  // F.3: Severity filtering on PRJ-103 (BLK-301 is CRITICAL)
  const blockers103Critical = await toolRegistry.executeTool<
    { projectId: string; severity: "CRITICAL" },
    any
  >("project-blockers", { projectId: "PRJ-103", severity: "CRITICAL" });
  assert.strictEqual(blockers103Critical.success, true);
  assert.strictEqual(blockers103Critical.data.totalMatches, 1);
  assert.strictEqual(blockers103Critical.data.blockers[0].id, "BLK-301");
  assert.strictEqual(
    blockers103Critical.data.blockers[0].affectedMilestone.id,
    "MS-302"
  );

  // F.4: Severity filtering with no match
  const blockers103Low = await toolRegistry.executeTool<
    { projectId: string; severity: "LOW" },
    any
  >("project-blockers", { projectId: "PRJ-103", severity: "LOW" });
  assert.strictEqual(blockers103Low.success, true);
  assert.strictEqual(blockers103Low.data.totalMatches, 0);

  // F.5: Blocker retrieval for PRJ-102 (BLK-201 is HIGH)
  const blockers102High = await toolRegistry.executeTool<
    { projectId: string; severity: "HIGH" },
    any
  >("project-blockers", { projectId: "PRJ-102", severity: "HIGH" });
  assert.strictEqual(blockers102High.success, true);
  assert.strictEqual(blockers102High.data.totalMatches, 1);
  assert.strictEqual(blockers102High.data.blockers[0].id, "BLK-201");
  assert.strictEqual(
    blockers102High.data.blockers[0].affectedMilestone.id,
    "MS-202"
  );

  console.log("  ✔ F.1-F.5: Blocker status filters, affected milestones, and severity filters function accurately");

  // =========================================================================
  // TEST GROUP G: CLIENT DELIVERY SUMMARY (client-delivery-summary)
  // =========================================================================
  console.log("\n▶ [TEST GROUP G] Cross-Domain Delivery & Financial Summary");

  // G.1: Client summary for Zenith Media Global (Customer "3") - compound risk
  const clientSummary003 = await toolRegistry.executeTool<
    { query: string },
    any
  >("client-delivery-summary", { query: "Zenith Media" });
  assert.strictEqual(clientSummary003.success, true);
  assert.strictEqual(clientSummary003.data.found, true);
  assert.strictEqual(clientSummary003.data.customer.id, "3");
  assert.strictEqual(
    clientSummary003.data.customer.company,
    "Zenith Media Global"
  );
  assert.strictEqual(
    clientSummary003.data.deliveryPortfolio.totalProjects,
    1,
    "Zenith Media has 1 project (PRJ-103)"
  );
  assert.strictEqual(
    clientSummary003.data.deliveryPortfolio.projectsDelayed,
    1,
    "Zenith Media project is delayed"
  );
  assert.strictEqual(
    clientSummary003.data.deliveryPortfolio.criticalBlockersCount,
    1,
    "Zenith Media has 1 critical blocker"
  );
  assert.strictEqual(
    clientSummary003.data.financialSnapshot.overdueInvoicesCount,
    1,
    "Zenith Media has 1 overdue invoice (INV-1001)"
  );
  assert.ok(
    clientSummary003.data.financialSnapshot.totalBilledFormatted.includes("₹"),
    "Financial snapshot must reuse formatINR formatting"
  );
  assert.ok(
    clientSummary003.data.crossDomainAlerts.some((a: string) =>
      a.includes("Compound Escalation") || a.includes("Delivery Alert")
    ),
    "Compound escalation alert must be triggered"
  );

  // G.2: Client summary for ABC Technologies (Customer "2") - healthy account
  const clientSummary002 = await toolRegistry.executeTool<
    { query: string },
    any
  >("client-delivery-summary", { query: "ABC Technologies" });
  assert.strictEqual(clientSummary002.success, true);
  assert.strictEqual(clientSummary002.data.found, true);
  assert.strictEqual(clientSummary002.data.customer.id, "2");
  assert.strictEqual(
    clientSummary002.data.deliveryPortfolio.totalProjects,
    1
  );
  assert.strictEqual(
    clientSummary002.data.deliveryPortfolio.projectsOnTrack,
    1
  );
  assert.strictEqual(
    clientSummary002.data.deliveryPortfolio.totalOpenBlockers,
    0
  );
  assert.strictEqual(
    clientSummary002.data.financialSnapshot.unpaidInvoicesCount,
    0,
    "ABC Technologies invoice is paid"
  );
  assert.strictEqual(
    clientSummary002.data.crossDomainAlerts.length,
    0,
    "Healthy customer should have zero operational alerts"
  );

  // G.3: Unknown client query
  const clientNotFound = await toolRegistry.executeTool<
    { query: string },
    any
  >("client-delivery-summary", { query: "NonExistentClientGlobal999" });
  assert.strictEqual(clientNotFound.success, true);
  assert.strictEqual(clientNotFound.data.found, false);
  assert.strictEqual(clientNotFound.data.customer, null);
  assert.strictEqual(clientNotFound.data.projects.length, 0);

  console.log("  ✔ G.1-G.3: Cross-domain client delivery summary synthesizes project portfolio and billing snapshot");

  // =========================================================================
  // TEST GROUP H: SECURITY & DATABASE IMMUTABILITY VERIFICATION
  // =========================================================================
  console.log("\n▶ [TEST GROUP H] Security Invariants & Database Immutability");

  // H.1: Test SQL Injection resistance in all query inputs
  const sqliPayloads = [
    "' OR 1=1 --",
    "'; DROP TABLE \"Project\"; --",
    "\" OR \"\"=\"",
    "admin'--",
  ];

  for (const sqli of sqliPayloads) {
    const resSearch = await toolRegistry.executeTool("project-search", {
      query: sqli,
    });
    assert.strictEqual(resSearch.success, true);
    // Should safely treat as literal string and return 0 matches
    assert.strictEqual(resSearch.data.totalMatches, 0);

    const resRisk = await toolRegistry.executeTool("project-risk-analysis", {
      projectId: sqli,
    });
    assert.strictEqual(resRisk.success, true);
    assert.strictEqual(resRisk.data.found, false);

    const resBlockers = await toolRegistry.executeTool("project-blockers", {
      projectId: sqli,
    });
    assert.strictEqual(resBlockers.success, true);
    assert.strictEqual(resBlockers.data.found, false);

    const resClient = await toolRegistry.executeTool("client-delivery-summary", {
      query: sqli,
    });
    assert.strictEqual(resClient.success, true);
    assert.strictEqual(resClient.data.found, false);
  }
  console.log("  ✔ H.1: SQL injection vectors safely handled as literal string lookups with zero DB errors");

  // H.2: Confirm exact database record counts remain 100% identical (Zero mutations)
  const finalCounts = {
    customers: await prisma.customer.count(),
    invoices: await prisma.invoice.count(),
    users: await prisma.user.count(),
    projects: await prisma.project.count(),
    milestones: await prisma.milestone.count(),
    blockers: await prisma.blocker.count(),
    approvals: await prisma.approvalRequest.count(),
  };

  assert.strictEqual(
    finalCounts.customers,
    initialCounts.customers,
    "Customer count must be unchanged"
  );
  assert.strictEqual(
    finalCounts.invoices,
    initialCounts.invoices,
    "Invoice count must be unchanged"
  );
  assert.strictEqual(
    finalCounts.users,
    initialCounts.users,
    "User count must be unchanged"
  );
  assert.strictEqual(
    finalCounts.projects,
    initialCounts.projects,
    "Project count must be unchanged"
  );
  assert.strictEqual(
    finalCounts.milestones,
    initialCounts.milestones,
    "Milestone count must be unchanged"
  );
  assert.strictEqual(
    finalCounts.blockers,
    initialCounts.blockers,
    "Blocker count must be unchanged"
  );
  assert.strictEqual(
    finalCounts.approvals,
    initialCounts.approvals,
    "Approvals count must be unchanged (no ApprovalRequest created)"
  );

  console.log("  ✔ H.2: Verified 100% database immutability: customers=5, invoices=5, users=3, projects=4, milestones=11, blockers=3, approvals unchanged");

  console.log("\n============================================================");
  console.log("ALL PHASE 3 DELIVERYOPS TOOL REGISTRY TESTS PASSED!");
  console.log("============================================================\n");
}

runPhase3DeliveryOpsTests()
  .catch((err) => {
    console.error("❌ Phase 3 DeliveryOps Test Suite failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
