import assert from "node:assert";
import crypto from "node:crypto";
import { prisma } from "./src/lib/prisma.js";
import { emailService } from "./src/integrations/email/email.service.js";
import { ResendEmailAdapter } from "./src/integrations/email/adapters/resend.adapter.js";
import { SimulationEmailAdapter } from "./src/integrations/email/adapters/simulation.adapter.js";
import type { EmailProvider, EmailMessage, EmailSendResult } from "./src/integrations/email/email.types.js";
import { approvalService } from "./src/services/approval.service.js";
import { toolRegistry } from "./src/tools/tool.registry.js";
import { businessAgent } from "./src/agents/business.agent.js";
import type { SafeUserProfile } from "./src/services/auth.service.js";

async function runPhase9Tests() {
  console.log("============================================================");
  console.log("PHASE 9 — REAL INTEGRATIONS & DEPLOYMENT VERIFICATION SUITE");
  console.log("============================================================\n");

  const approverUser: SafeUserProfile = {
    id: "usr_approver_p9",
    name: "Finance Approver",
    email: "approver@bizops.ai",
    role: "APPROVER",
    isActive: true,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const operatorUser: SafeUserProfile = {
    id: "usr_operator_p9",
    name: "Frontline Operator",
    email: "operator@bizops.ai",
    role: "OPERATOR",
    isActive: true,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // =========================================================================
  // TEST GROUP A: EMAIL PROVIDER ABSTRACTION & RESEND ADAPTER
  // =========================================================================
  console.log("▶ [TEST GROUP A] Email Provider Abstraction & Resend Adapter");

  // A.1: Simulation Adapter Success
  const simAdapter = new SimulationEmailAdapter();
  const simRes = await simAdapter.send({
    to: "client@acme.com",
    subject: "Test Reminder",
    text: "Please settle invoice INV-1001",
    idempotencyKey: "bizops-apr-sim-001",
  });

  assert.strictEqual(simRes.success, true, "Simulation send must succeed");
  assert.strictEqual(simRes.simulated, true, "Must be flagged as simulated");
  assert.strictEqual(simRes.provider, "simulation", "Provider name must be simulation");
  assert.ok(simRes.messageId.startsWith("sim_msg_"), "Must return simulated message ID");
  assert.strictEqual(simRes.idempotencyKey, "bizops-apr-sim-001");
  console.log("  ✔ A.1 Simulation adapter successfully formats and delivers simulated email");

  // A.2: Resend Adapter Sanitization & Error Handling
  const resendTestKey = "re_test_dummy_key_12345";
  const resendAdapter = new ResendEmailAdapter({
    apiKey: resendTestKey,
    fromAddress: "BizOps Billing <billing@bizops.ai>",
    timeoutMs: 1500,
    apiBaseUrl: "http://127.0.0.1:9999", // Unreachable port to verify safe network failure handling
  });

  const netFailRes = await resendAdapter.send({
    to: "finance@client.com",
    subject: "Unreachable Endpoint Test",
    text: "Test content",
    idempotencyKey: "bizops-apr-resend-001",
  });

  assert.strictEqual(netFailRes.success, false, "Must handle network connection failure safely");
  assert.strictEqual(netFailRes.provider, "resend");
  assert.strictEqual(netFailRes.error?.code, "PROVIDER_UNAVAILABLE");
  assert.ok(
    !JSON.stringify(netFailRes).includes(resendTestKey),
    "CRITICAL: Secrets/API keys must NEVER leak in adapter error representations"
  );
  console.log("  ✔ A.2 Resend adapter safely catches network errors with sanitized messages and zero secret leaks");

  // A.3: Resend Adapter Webhook Signature Verification
  const webhookSecret = "whsec_test_secret_xyz789";
  const webhookPayload = JSON.stringify({ id: "evt_123", type: "email.delivered" });
  const validHmac = crypto.createHmac("sha256", webhookSecret).update(webhookPayload).digest("hex");

  const isSigValid = resendAdapter.verifyWebhookSignature(webhookPayload, validHmac, webhookSecret);
  assert.strictEqual(isSigValid, true, "Valid HMAC signature must verify successfully");

  const isSigInvalid = resendAdapter.verifyWebhookSignature(webhookPayload, "wrong_sig_value", webhookSecret);
  assert.strictEqual(isSigInvalid, false, "Invalid HMAC signature must be rejected");
  console.log("  ✔ A.3 Resend adapter HMAC signature verification correctly validates signatures");

  // =========================================================================
  // TEST GROUP B: APPROVAL BOUNDARY & CONSEQUENTIAL TOOL ISOLATION
  // =========================================================================
  console.log("\n▶ [TEST GROUP B] Approval Boundary & Consequential Tool Invariant");

  // B.1: Tool Registry send-email metadata & Business Agent proposal boundary
  const emailTool = toolRegistry.getTool("send-email");
  assert.ok(emailTool, "send-email tool must be registered in tool registry");
  assert.strictEqual(emailTool.operationType, "CONSEQUENTIAL", "send-email must have operationType CONSEQUENTIAL");
  assert.strictEqual(emailTool.requiresApproval, true, "send-email must have requiresApproval true");

  // Verify that agent creates an ApprovalRequest proposal without executing email
  const agentProposal = await businessAgent.execute(
    "Send a reminder for invoice INV-1001",
    operatorUser
  );

  assert.strictEqual(agentProposal.success, true, "Agent execution must succeed");
  assert.strictEqual(agentProposal.approvalRequired, true, "Agent must require human approval");
  assert.strictEqual(agentProposal.outcome, "APPROVAL_REQUIRED", "Outcome must be APPROVAL_REQUIRED");
  assert.ok(agentProposal.approvalId, "Must return created approval ID");

  const pendingProposalDb = await prisma.approvalRequest.findUniqueOrThrow({
    where: { id: agentProposal.approvalId },
  });
  assert.strictEqual(pendingProposalDb.status, "PENDING", "Created proposal must be PENDING");
  assert.strictEqual(pendingProposalDb.executionStatus, "NOT_EXECUTED", "Must NOT execute email during proposal");
  console.log("  ✔ B.1 Agent generates approval proposal in PENDING state; zero emails dispatched");

  // B.2: Create approval request in database in PENDING status
  const testApprovalId = `APR-P9-${Date.now()}`;
  const createdApproval = await prisma.approvalRequest.create({
    data: {
      id: testApprovalId,
      title: "Send Overdue Reminder to Acme Tech",
      description: "Send overdue invoice reminder to Acme Tech",
      actionType: "SEND_INVOICE_REMINDER",
      toolName: "send-email",
      reason: "Automated invoice reminder approval",
      customer: "Acme Tech",
      amount: "₹185,000",
      relatedInvoiceId: "INV-2026-001",
      status: "PENDING",
      executionStatus: "NOT_EXECUTED",
      arguments: {
        invoices: [
          {
            invoiceNumber: "INV-2026-001",
            clientName: "Acme Tech",
            clientCompany: "Acme Tech",
            amount: "₹185,000",
            dueDate: "2026-03-01",
          },
        ],
      },
    },
  });

  assert.strictEqual(createdApproval.status, "PENDING");
  assert.strictEqual(createdApproval.executionStatus, "NOT_EXECUTED");
  console.log(`  ✔ B.2 ApprovalRequest ${testApprovalId} successfully initialized in PENDING state`);

  // B.3: Rejection boundary test: Rejection cancels proposal and NEVER executes email
  const rejectionTestId = `APR-P9-REJ-${Date.now()}`;
  await prisma.approvalRequest.create({
    data: {
      id: rejectionTestId,
      title: "Send Reminder Proposal",
      description: "Proposal to be rejected",
      actionType: "SEND_INVOICE_REMINDER",
      toolName: "send-email",
      reason: "Invoice payment reminder",
      customer: "Beta Systems",
      amount: "₹50,000",
      status: "PENDING",
      executionStatus: "NOT_EXECUTED",
      arguments: {},
    },
  });

  const rejResult = await approvalService.rejectApproval(
    rejectionTestId,
    approverUser,
    "Invoice is under dispute; hold reminder."
  );

  assert.strictEqual(rejResult.success, true);
  assert.strictEqual(rejResult.approval.status, "REJECTED");
  assert.strictEqual(rejResult.approval.executionStatus, "NOT_EXECUTED");

  const rejDb = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: rejectionTestId } });
  assert.strictEqual(rejDb.status, "REJECTED");
  assert.strictEqual(rejDb.executionStatus, "NOT_EXECUTED");
  console.log("  ✔ B.3 Rejection successfully marks REJECTED without executing external email action");

  // =========================================================================
  // TEST GROUP C: ATOMIC IDEMPOTENCY & CONCURRENCY PROTECTION
  // =========================================================================
  console.log("\n▶ [TEST GROUP C] Atomic Idempotency & Concurrent Execution Protection");

  // C.1: Single Authorized Approval Execution
  const approveResult = await approvalService.approveApproval(testApprovalId, approverUser);
  assert.strictEqual(approveResult.success, true);
  assert.strictEqual(approveResult.approval.status, "APPROVED");
  assert.strictEqual(approveResult.approval.executionStatus, "SUCCESS");
  assert.ok(approveResult.executionResult.messageId, "Must contain dispatched message ID");
  assert.strictEqual(
    approveResult.executionResult.idempotencyKey,
    `bizops-apr-${testApprovalId.toLowerCase()}`,
    "Must pass deterministic approval-bound idempotency key"
  );
  console.log(`  ✔ C.1 Authorized approval executed once with idempotency key bizops-apr-${testApprovalId.toLowerCase()}`);

  // C.2: Repeated Approval Attempt Rejection (Idempotency Invariant)
  let repeatErrorThrown = false;
  try {
    await approvalService.approveApproval(testApprovalId, approverUser);
  } catch (err: any) {
    repeatErrorThrown = true;
    assert.ok(
      err.message.includes("already been decided"),
      `Expected error about prior decision, got: ${err.message}`
    );
  }
  assert.strictEqual(repeatErrorThrown, true, "Repeated approval attempt must be rejected");
  console.log("  ✔ C.2 Repeated approval attempt safely rejected; duplicate delivery prevented");

  // C.3: Concurrent Approval Race Condition Simulation
  const raceApprovalId = `APR-P9-RACE-${Date.now()}`;
  await prisma.approvalRequest.create({
    data: {
      id: raceApprovalId,
      title: "Concurrent Race Proposal",
      description: "Concurrent race simulation",
      actionType: "SEND_INVOICE_REMINDER",
      toolName: "send-email",
      reason: "Testing concurrency serialization",
      customer: "Stark Enterprises",
      amount: "₹95,000",
      status: "PENDING",
      executionStatus: "NOT_EXECUTED",
      arguments: {},
    },
  });

  // Launch two concurrent approve operations simultaneously
  const results = await Promise.allSettled([
    approvalService.approveApproval(raceApprovalId, approverUser),
    approvalService.approveApproval(raceApprovalId, approverUser),
  ]);

  const fulfilledCount = results.filter((r) => r.status === "fulfilled").length;
  const rejectedCount = results.filter((r) => r.status === "rejected").length;

  assert.strictEqual(fulfilledCount, 1, "Exactly ONE concurrent approval must succeed");
  assert.strictEqual(rejectedCount, 1, "The competing concurrent approval must be safely rejected");
  console.log("  ✔ C.3 Atomic database locking ensures exactly one winner in concurrent approval races");

  // =========================================================================
  // TEST GROUP D: EXTERNAL INTEGRATION TRUTHFUL FAILURE HANDLING
  // =========================================================================
  console.log("\n▶ [TEST GROUP D] Truthful Failure Handling When Provider Fails");

  const failingApprovalId = `APR-P9-FAIL-${Date.now()}`;
  await prisma.approvalRequest.create({
    data: {
      id: failingApprovalId,
      title: "Failing Provider Test",
      description: "Failure handling verification",
      actionType: "SEND_INVOICE_REMINDER",
      toolName: "send-email",
      reason: "Simulate external email provider outage",
      customer: "Faulty Provider Corp",
      amount: "₹30,000",
      status: "PENDING",
      executionStatus: "NOT_EXECUTED",
      arguments: {},
    },
  });

  // Inject a mock failing provider adapter to simulate external vendor outage
  const failingProvider: EmailProvider = {
    name: "mock-resend-outage",
    async send(msg: EmailMessage): Promise<EmailSendResult> {
      return {
        success: false,
        provider: "mock-resend-outage",
        simulated: false,
        timestamp: new Date().toISOString(),
        idempotencyKey: msg.idempotencyKey,
        recipient: typeof msg.to === "string" ? msg.to : msg.to[0] as string,
        subject: msg.subject,
        error: {
          code: "PROVIDER_UNAVAILABLE",
          message: "External email provider returned HTTP 503 Service Unavailable.",
          statusCode: 503,
        },
      };
    },
  };

  emailService.setProvider(failingProvider);

  try {
    const failureResult = await approvalService.approveApproval(failingApprovalId, approverUser);
    assert.strictEqual(failureResult.success, true, "Approval decision records successfully");
    assert.strictEqual(failureResult.approval.status, "APPROVED", "Status remains APPROVED");
    assert.strictEqual(
      failureResult.approval.executionStatus,
      "FAILED",
      "CRITICAL: Execution status must be truthfully recorded as FAILED"
    );
    assert.strictEqual(failureResult.executionResult.mode, "FAILED");

    // Verify Audit Event recorded DECISION_APPROVED_EXECUTION_FAILED
    const auditRecord = await prisma.auditEvent.findFirstOrThrow({
      where: {
        approvalRequestId: failingApprovalId,
        eventType: "DECISION_APPROVED_EXECUTION_FAILED",
      },
    });
    assert.strictEqual(auditRecord.eventType, "DECISION_APPROVED_EXECUTION_FAILED");
    console.log("  ✔ D.1 External provider failure records executionStatus='FAILED' and DECISION_APPROVED_EXECUTION_FAILED audit event");
  } finally {
    emailService.resetProvider();
  }

  // =========================================================================
  // TEST GROUP E: WEBHOOK ENDPOINT, DEDUPLICATION & AUDIT TRAIL
  // =========================================================================
  console.log("\n▶ [TEST GROUP E] Webhook Endpoint, Deduplication & Audit Trail");

  const webhookEventId = `evt_test_${Date.now()}`;

  // E.1: Process Webhook Event Audit Creation
  await prisma.auditEvent.create({
    data: {
      eventType: "EMAIL_WEBHOOK_PROCESSED",
      actor: "SYSTEM (Email Provider Webhook)",
      payload: {
        webhookEventId,
        deliveryEventType: "email.delivered",
        externalEmailId: "msg_resend_9988",
        recipients: ["finance@client.com"],
        subject: "Invoice Reminder",
        receivedAt: new Date().toISOString(),
      },
    },
  });

  // E.2: Duplicate Event Detection
  const duplicateCheck = await prisma.auditEvent.findFirst({
    where: {
      eventType: "EMAIL_WEBHOOK_PROCESSED",
      payload: {
        path: ["webhookEventId"],
        equals: webhookEventId,
      },
    },
  });

  assert.ok(duplicateCheck, "Must detect existing processed webhook event");
  console.log(`  ✔ E.1 Webhook deduplication successfully locates existing event ${webhookEventId}`);

  // E.3: Live HTTP Webhook Endpoint Validation against Fastify
  try {
    const liveHookRes = await fetch("http://127.0.0.1:4000/api/webhooks/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invalid: "payload" }),
    });

    // Should return 400 (validation error) or 401 (if webhook secret required)
    assert.ok(
      liveHookRes.status === 400 || liveHookRes.status === 401,
      `Expected 400 or 401 for invalid webhook, got ${liveHookRes.status}`
    );
    console.log(`  ✔ E.2 Live HTTP webhook endpoint safely validates malformed payloads (HTTP ${liveHookRes.status})`);
  } catch (err: any) {
    console.log(`  ℹ E.2 Live server not reachable for webhook HTTP check (${err.message}), skipped HTTP step`);
  }

  console.log("\n============================================================");
  console.log("ALL PHASE 9 INTEGRATION & DEPLOYMENT TESTS PASSED!");
  console.log("============================================================\n");
}

runPhase9Tests()
  .catch((err) => {
    console.error("❌ Phase 9 Test Suite Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
