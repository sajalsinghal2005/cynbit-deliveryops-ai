import { z } from "zod";
import type { ToolDefinition } from "./tool.types.js";
import { prisma } from "../lib/prisma.js";
import { approvalStore } from "../data/approvals.js";
import { analyzeProjectRisk } from "./delivery.tool.js";

// =============================================================================
// INPUT & OUTPUT SCHEMAS
// =============================================================================

export const prepareClientFollowupInputSchema = z
  .object({
    customerId: z
      .string()
      .trim()
      .min(1, "Customer identifier is required")
      .max(100, "Customer identifier exceeds maximum length")
      .optional(),
    customer: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional(),
    projectId: z
      .string()
      .trim()
      .min(1, "Project identifier is required")
      .max(100, "Project identifier exceeds maximum length")
      .optional(),
    project: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional(),
    reason: z
      .string()
      .trim()
      .min(5, "Reason for follow-up is required (min 5 characters)")
      .max(1000, "Reason exceeds maximum length of 1000 characters"),
    subject: z
      .string()
      .trim()
      .min(3, "Subject line is required (min 3 characters)")
      .max(200, "Subject line exceeds maximum length of 200 characters"),
    message: z
      .string()
      .trim()
      .min(10, "Follow-up message body is required (min 10 characters)")
      .max(4000, "Message body exceeds maximum length of 4000 characters"),
    recipientEmail: z
      .string()
      .trim()
      .email("Invalid recipient email address")
      .optional(),
  })
  .refine((data) => Boolean(data.customerId || data.customer), {
    message: "Customer identifier (customerId or customer) is required",
    path: ["customerId"],
  })
  .refine((data) => Boolean(data.projectId || data.project), {
    message: "Project identifier (projectId or project) is required",
    path: ["projectId"],
  });

export const prepareClientFollowupOutputSchema = z.object({
  action: z.literal("prepare-client-followup"),
  approvalId: z.string(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  executionStatus: z.enum(["NOT_EXECUTED", "SUCCESS", "FAILED"]),
  customer: z.string(),
  company: z.string(),
  project: z.string(),
  projectStatus: z.string(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  riskScore: z.number(),
  blockersCount: z.number(),
  proposedRecipient: z.string(),
  proposedSubject: z.string(),
  proposedMessage: z.string(),
  reason: z.string(),
  message: z.string(),
  approvalRequest: z.any().optional(),
});

export type PrepareClientFollowupInput = z.infer<
  typeof prepareClientFollowupInputSchema
>;
export type PrepareClientFollowupOutput = z.infer<
  typeof prepareClientFollowupOutputSchema
>;

// =============================================================================
// TOOL IMPLEMENTATION: prepare-client-followup
// =============================================================================

export async function prepareClientFollowup(
  input: PrepareClientFollowupInput,
  context?: { user?: any; requestId?: string; source?: string }
): Promise<PrepareClientFollowupOutput> {
  const parsed = prepareClientFollowupInputSchema.parse(input);

  // 1. Authoritative Customer Resolution from PostgreSQL
  const customerRaw = (parsed.customerId || parsed.customer)!.trim();
  const custNumMatch = customerRaw.match(/^(?:customer|client)\s*#?\s*([1-5])$/i);
  const cleanCustId = custNumMatch ? custNumMatch[1] : customerRaw;

  const customer = await prisma.customer.findFirst({
    where: {
      OR: [
        { id: { equals: cleanCustId } },
        { id: { equals: customerRaw } },
        { name: { contains: customerRaw, mode: "insensitive" } },
        { company: { contains: customerRaw, mode: "insensitive" } },
        { email: { contains: customerRaw, mode: "insensitive" } },
      ],
    },
    include: {
      projects: true,
      invoices: true,
    },
  });

  if (!customer) {
    throw new Error(
      `Customer "${customerRaw}" was not found in the database. Client follow-up proposal aborted.`
    );
  }

  if (!customer.email || !customer.email.includes("@")) {
    throw new Error(
      `Customer "${customer.name}" does not have a verified email address on record.`
    );
  }

  // 2. Authoritative Project Resolution from PostgreSQL
  const projectRaw = (parsed.projectId || parsed.project)!.trim();
  const project = await prisma.project.findFirst({
    where: {
      OR: [
        { id: { equals: projectRaw, mode: "insensitive" } },
        { name: { contains: projectRaw, mode: "insensitive" } },
      ],
    },
    include: {
      customer: true,
      milestones: true,
      blockers: {
        where: { status: { in: ["open", "in_progress"] } },
      },
    },
  });

  if (!project) {
    throw new Error(
      `Delivery project "${projectRaw}" was not found in the database. Client follow-up proposal aborted.`
    );
  }

  // 3. Deterministic Risk Grounding via Authoritative Delivery Risk Engine
  const riskAnalysis = await analyzeProjectRisk({ projectId: project.id });
  const riskLevel = riskAnalysis.overallRiskLevel || "MEDIUM";
  const riskScore = riskAnalysis.riskScore ?? 50;
  const evidence = riskAnalysis.evidence || [];

  // 4. Extract Real Blockers & Billing Context
  const openBlockers = project.blockers.map((b) => ({
    id: b.id,
    title: b.title,
    severity: b.severity,
    status: b.status,
    impact: b.impact,
  }));
  const overdueInvoices = customer.invoices.filter((i) => i.status === "overdue");

  // 5. Derive Authenticated Actor Identity (Strictly from Session context)
  const requestedBy = context?.user
    ? {
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
      }
    : undefined;

  const recipientEmail = parsed.recipientEmail || customer.email;

  // 6. Persist Pending ApprovalRequest in PostgreSQL
  const proposalTitle = `Client Follow-up: ${project.name} (${customer.company})`;
  const proposalDesc = `Follow-up proposal for ${customer.company} regarding ${project.name} (${project.status}, Risk: ${riskLevel}): "${parsed.subject}"`;

  const createdApproval = await approvalStore.create({
    title: proposalTitle,
    description: proposalDesc,
    actionType: "SEND_INVOICE_REMINDER",
    toolName: "prepare-client-followup",
    arguments: {
      recipientEmail,
      customer: `${customer.name} (${customer.company})`,
      customerId: customer.id,
      company: customer.company,
      projectId: project.id,
      projectName: project.name,
      projectStatus: project.status,
      healthScore: project.healthScore,
      targetDate: project.targetDate,
      overallRiskLevel: riskLevel,
      riskScore,
      evidence,
      openBlockersCount: openBlockers.length,
      openBlockers,
      overdueInvoicesCount: overdueInvoices.length,
      subject: parsed.subject,
      message: parsed.message,
      reason: parsed.reason,
      requestedBy,
    },
    reason: parsed.reason,
    customer: `${customer.name} (${customer.company})`,
    amount: overdueInvoices.length > 0 ? overdueInvoices[0].amount : undefined,
    risk: "MEDIUM",
    relatedCustomerId: customer.id,
    requestedBy,
  });

  // 7. Record Proposal Created Audit Trail
  try {
    const actorStr = context?.user
      ? `${context.user.name} (${context.user.email})`
      : "System / AI Agent";
    await prisma.auditEvent.create({
      data: {
        approvalRequestId: createdApproval.id,
        eventType: "PROPOSAL_CREATED",
        actor: actorStr,
        payload: {
          toolName: "prepare-client-followup",
          approvalId: createdApproval.id,
          customer: `${customer.name} (${customer.company})`,
          project: `${project.name} (${project.id})`,
          subject: parsed.subject,
          riskLevel,
          riskScore,
          recipientEmail,
          status: createdApproval.status,
          executionStatus: createdApproval.executionStatus,
        },
      },
    });
  } catch {
    // Non-blocking telemetry
  }

  return {
    action: "prepare-client-followup",
    approvalId: createdApproval.id,
    status: createdApproval.status as "PENDING",
    executionStatus: createdApproval.executionStatus as "NOT_EXECUTED",
    customer: `${customer.name} (${customer.company})`,
    company: customer.company,
    project: `${project.name} (${project.id})`,
    projectStatus: project.status,
    riskLevel,
    riskScore,
    blockersCount: openBlockers.length,
    proposedRecipient: recipientEmail,
    proposedSubject: parsed.subject,
    proposedMessage: parsed.message,
    reason: parsed.reason,
    message: `Client follow-up prepared and awaiting human approval (Approval ID: ${createdApproval.id}). Zero external emails have been sent.`,
    approvalRequest: createdApproval,
  };
}

export const prepareClientFollowupTool: ToolDefinition<
  PrepareClientFollowupInput,
  PrepareClientFollowupOutput
> = {
  id: "prepare-client-followup",
  name: "Prepare Client Follow-up",
  description:
    "Consequential: prepare a factual client follow-up notice regarding project health, risks, blockers, or delivery status (strictly requires human authorization before execution).",
  category: "DeliveryOps",
  operationType: "CONSEQUENTIAL",
  risk: "MEDIUM",
  requiresApproval: true,
  schema: prepareClientFollowupInputSchema,
  outputSchema: prepareClientFollowupOutputSchema,
  execute: prepareClientFollowup,
};
