import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import type { ToolDefinition } from "./tool.types.js";
import { formatINR } from "./customer.tool.js";

// =============================================================================
// 1. TOOL: project-search
// =============================================================================

export const projectSearchInputSchema = z.object({
  query: z
    .string()
    .optional()
    .describe("Search term matching project name, description, client company, delivery lead, or tech stack"),
  status: z
    .enum(["all", "active", "on_track", "at_risk", "delayed", "completed"])
    .optional()
    .describe("Optional filter by project status"),
  limit: z
    .number()
    .int()
    .positive()
    .max(50)
    .optional()
    .default(10)
    .describe("Maximum number of projects to return (1-50)"),
});

export const projectSearchOutputSchema = z.object({
  query: z.string().optional(),
  statusFilter: z.string().optional(),
  totalMatches: z.number(),
  projects: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      status: z.string(),
      healthScore: z.number(),
      deliveryLead: z.string(),
      techStack: z.array(z.string()),
      budget: z.string().nullable(),
      startDate: z.string(),
      targetDate: z.string(),
      clientName: z.string().optional(),
      clientCompany: z.string().optional(),
      milestoneCount: z.number(),
      openBlockerCount: z.number(),
    })
  ),
  message: z.string(),
});

export type ProjectSearchInput = z.infer<typeof projectSearchInputSchema>;
export type ProjectSearchOutput = z.infer<typeof projectSearchOutputSchema>;

export async function searchProjects(
  input: ProjectSearchInput
): Promise<ProjectSearchOutput> {
  const parsed = projectSearchInputSchema.parse(input);
  const normalizedQuery = parsed.query?.trim();

  const whereClause: any = {};

  if (parsed.status && parsed.status !== "all") {
    whereClause.status = parsed.status;
  }

  if (normalizedQuery) {
    whereClause.OR = [
      { id: { contains: normalizedQuery, mode: "insensitive" } },
      { name: { contains: normalizedQuery, mode: "insensitive" } },
      { description: { contains: normalizedQuery, mode: "insensitive" } },
      { deliveryLead: { contains: normalizedQuery, mode: "insensitive" } },
      { techStack: { has: normalizedQuery } },
      {
        customer: {
          OR: [
            { name: { contains: normalizedQuery, mode: "insensitive" } },
            { company: { contains: normalizedQuery, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  const rawProjects = await prisma.project.findMany({
    where: whereClause,
    include: {
      customer: true,
      milestones: true,
      blockers: {
        where: {
          status: { in: ["open", "in_progress"] },
        },
      },
    },
    take: parsed.limit,
    orderBy: { createdAt: "desc" },
  });

  const formattedProjects = rawProjects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    healthScore: p.healthScore,
    deliveryLead: p.deliveryLead,
    techStack: p.techStack,
    budget: p.budget,
    startDate: p.startDate,
    targetDate: p.targetDate,
    clientName: p.customer?.name,
    clientCompany: p.customer?.company,
    milestoneCount: p.milestones.length,
    openBlockerCount: p.blockers.length,
  }));

  const message =
    formattedProjects.length > 0
      ? `Found ${formattedProjects.length} matching software delivery project(s).`
      : `No software delivery projects matched the query.`;

  return {
    query: normalizedQuery,
    statusFilter: parsed.status,
    totalMatches: formattedProjects.length,
    projects: formattedProjects,
    message,
  };
}

export const projectSearchTool: ToolDefinition<
  ProjectSearchInput,
  ProjectSearchOutput
> = {
  id: "project-search",
  name: "Search Delivery Projects",
  description:
    "Search software delivery projects by name, description, client company, delivery lead, or tech stack.",
  category: "DeliveryOps",
  operationType: "READ_ONLY",
  risk: "LOW",
  requiresApproval: false,
  schema: projectSearchInputSchema,
  outputSchema: projectSearchOutputSchema,
  execute: searchProjects,
};

// =============================================================================
// 2. TOOL: project-summary
// =============================================================================

export const projectSummaryInputSchema = z.object({
  projectId: z
    .string()
    .trim()
    .min(1, "Project ID or project name search term is required"),
});

export const projectSummaryOutputSchema = z.object({
  found: z.boolean(),
  project: z
    .object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      status: z.string(),
      healthScore: z.number(),
      deliveryLead: z.string(),
      techStack: z.array(z.string()),
      budget: z.string().nullable(),
      startDate: z.string(),
      targetDate: z.string(),
      customer: z
        .object({
          id: z.string(),
          name: z.string(),
          company: z.string(),
          email: z.string(),
          status: z.string(),
          aiHealthScore: z.number(),
        })
        .nullable(),
      deliveryIndicators: z.object({
        milestoneProgressAvg: z.number(),
        totalMilestones: z.number(),
        completedMilestones: z.number(),
        delayedMilestones: z.number(),
        pendingMilestones: z.number(),
        openBlockersCount: z.number(),
        criticalBlockersCount: z.number(),
        highBlockersCount: z.number(),
        isDelayed: z.boolean(),
        isAtRisk: z.boolean(),
      }),
      milestones: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          description: z.string().nullable(),
          dueDate: z.string(),
          status: z.string(),
          progressPercent: z.number(),
          hasBlockers: z.boolean(),
        })
      ),
      openBlockers: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          severity: z.string(),
          status: z.string(),
          impact: z.string(),
          identifiedDate: z.string(),
          milestoneId: z.string().nullable(),
        })
      ),
    })
    .nullable(),
  message: z.string(),
});

export type ProjectSummaryInput = z.infer<typeof projectSummaryInputSchema>;
export type ProjectSummaryOutput = z.infer<typeof projectSummaryOutputSchema>;

export async function getProjectSummary(
  input: ProjectSummaryInput
): Promise<ProjectSummaryOutput> {
  const parsed = projectSummaryInputSchema.parse(input);
  const identifier = parsed.projectId.trim();

  // Find by exact ID or case-insensitive name
  const project = await prisma.project.findFirst({
    where: {
      OR: [
        { id: { equals: identifier, mode: "insensitive" } },
        { name: { contains: identifier, mode: "insensitive" } },
      ],
    },
    include: {
      customer: true,
      milestones: {
        include: {
          blockers: {
            where: { status: { in: ["open", "in_progress"] } },
          },
        },
        orderBy: { dueDate: "asc" },
      },
      blockers: {
        where: { status: { in: ["open", "in_progress"] } },
        orderBy: { identifiedDate: "desc" },
      },
    },
  });

  if (!project) {
    return {
      found: false,
      project: null,
      message: `Software delivery project "${identifier}" was not found.`,
    };
  }

  const totalMilestones = project.milestones.length;
  const completedMilestones = project.milestones.filter(
    (m) => m.status === "completed"
  ).length;
  const delayedMilestones = project.milestones.filter(
    (m) => m.status === "delayed"
  ).length;
  const pendingMilestones = project.milestones.filter(
    (m) => m.status === "pending" || m.status === "in_progress"
  ).length;

  const milestoneProgressAvg =
    totalMilestones > 0
      ? Math.round(
          project.milestones.reduce((acc, m) => acc + m.progressPercent, 0) /
            totalMilestones
        )
      : 0;

  const criticalBlockersCount = project.blockers.filter(
    (b) => b.severity === "CRITICAL"
  ).length;
  const highBlockersCount = project.blockers.filter(
    (b) => b.severity === "HIGH"
  ).length;

  const deliveryIndicators = {
    milestoneProgressAvg,
    totalMilestones,
    completedMilestones,
    delayedMilestones,
    pendingMilestones,
    openBlockersCount: project.blockers.length,
    criticalBlockersCount,
    highBlockersCount,
    isDelayed: project.status === "delayed" || delayedMilestones > 0,
    isAtRisk: project.status === "at_risk" || highBlockersCount > 0,
  };

  const formattedMilestones = project.milestones.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    dueDate: m.dueDate,
    status: m.status,
    progressPercent: m.progressPercent,
    hasBlockers: m.blockers.length > 0,
  }));

  const formattedBlockers = project.blockers.map((b) => ({
    id: b.id,
    title: b.title,
    severity: b.severity,
    status: b.status,
    impact: b.impact,
    identifiedDate: b.identifiedDate,
    milestoneId: b.milestoneId,
  }));

  const clientInfo = project.customer
    ? `${project.customer.name} (${project.customer.company})`
    : "Unassigned Client";

  const message =
    `Project **${project.name}** (${project.id}) — Client: ${clientInfo}\n` +
    `• Status: **${project.status.toUpperCase()}** | Health Score: **${project.healthScore}/100** | Lead: ${project.deliveryLead}\n` +
    `• Milestone Progress: **${milestoneProgressAvg}%** (${completedMilestones}/${totalMilestones} completed, ${delayedMilestones} delayed)\n` +
    `• Open Blockers: **${project.blockers.length}** (${criticalBlockersCount} critical, ${highBlockersCount} high)\n` +
    `• Target Delivery Date: **${project.targetDate}**`;

  return {
    found: true,
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      healthScore: project.healthScore,
      deliveryLead: project.deliveryLead,
      techStack: project.techStack,
      budget: project.budget,
      startDate: project.startDate,
      targetDate: project.targetDate,
      customer: project.customer
        ? {
            id: project.customer.id,
            name: project.customer.name,
            company: project.customer.company,
            email: project.customer.email,
            status: project.customer.status,
            aiHealthScore: project.customer.aiHealthScore,
          }
        : null,
      deliveryIndicators,
      milestones: formattedMilestones,
      openBlockers: formattedBlockers,
    },
    message,
  };
}

export const projectSummaryTool: ToolDefinition<
  ProjectSummaryInput,
  ProjectSummaryOutput
> = {
  id: "project-summary",
  name: "Project Delivery Summary",
  description:
    "Retrieve comprehensive software delivery status, milestones progress, delivery lead, and open blockers for a project.",
  category: "DeliveryOps",
  operationType: "READ_ONLY",
  risk: "LOW",
  requiresApproval: false,
  schema: projectSummaryInputSchema,
  outputSchema: projectSummaryOutputSchema,
  execute: getProjectSummary,
};

// =============================================================================
// 3. TOOL: project-risk-analysis
// =============================================================================

export const projectRiskAnalysisInputSchema = z.object({
  projectId: z
    .string()
    .trim()
    .min(1, "Project ID cannot be an empty string")
    .optional()
    .describe(
      "Optional project ID (e.g. PRJ-101) or project name keyword. If omitted or 'all', analyzes and ranks all projects across the delivery portfolio."
    ),
});

export const projectRiskAnalysisOutputSchema = z.object({
  found: z.boolean(),
  isPortfolio: z.boolean().optional(),
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  clientCompany: z.string().optional(),
  overallRiskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  riskScore: z.number().optional(), // 0 to 100 where higher is riskier
  evidence: z.array(z.string()),
  breakdown: z
    .object({
      projectStatus: z.string(),
      healthScore: z.number(),
      milestones: z.object({
        total: z.number(),
        completed: z.number(),
        delayed: z.number(),
        inProgress: z.number(),
        pending: z.number(),
        avgProgress: z.number(),
      }),
      openBlockers: z.object({
        total: z.number(),
        critical: z.number(),
        high: z.number(),
        medium: z.number(),
        low: z.number(),
      }),
    })
    .optional(),
  portfolioRiskRanking: z
    .array(
      z.object({
        projectId: z.string(),
        projectName: z.string(),
        clientCompany: z.string(),
        overallRiskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
        riskScore: z.number(),
        healthScore: z.number(),
        status: z.string(),
        openBlockersCount: z.number(),
        criticalBlockersCount: z.number(),
        delayedMilestonesCount: z.number(),
        keyRiskDriver: z.string(),
      })
    )
    .optional(),
  recommendations: z.array(z.string()).optional(),
  message: z.string(),
});

export type ProjectRiskAnalysisInput = z.infer<
  typeof projectRiskAnalysisInputSchema
>;
export type ProjectRiskAnalysisOutput = z.infer<
  typeof projectRiskAnalysisOutputSchema
>;

/**
 * Deterministically computes evidence-backed risk indicators for a single project record.
 */
function computeSingleProjectRisk(project: any) {
  const evidence: string[] = [];
  let computedRiskScore = 0;

  // 1. Blocker Analysis
  const openBlockers = project.blockers.filter(
    (b: any) => b.status === "open" || b.status === "in_progress"
  );
  const criticalBlockers = openBlockers.filter((b: any) => b.severity === "CRITICAL");
  const highBlockers = openBlockers.filter((b: any) => b.severity === "HIGH");
  const mediumBlockers = openBlockers.filter((b: any) => b.severity === "MEDIUM");
  const lowBlockers = openBlockers.filter((b: any) => b.severity === "LOW");

  for (const b of criticalBlockers) {
    computedRiskScore += 40;
    const msTitle = b.milestone ? ` on milestone "${b.milestone.title}"` : "";
    evidence.push(
      `[CRITICAL BLOCKER] ${b.title}${msTitle}: ${b.impact} (Identified: ${b.identifiedDate})`
    );
  }

  for (const b of highBlockers) {
    computedRiskScore += 25;
    const msTitle = b.milestone ? ` on milestone "${b.milestone.title}"` : "";
    evidence.push(
      `[HIGH BLOCKER] ${b.title}${msTitle}: ${b.impact} (Identified: ${b.identifiedDate})`
    );
  }

  for (const b of mediumBlockers) {
    computedRiskScore += 10;
    evidence.push(`[MEDIUM BLOCKER] ${b.title}: ${b.impact}`);
  }

  for (const b of lowBlockers) {
    computedRiskScore += 5;
  }

  // 2. Milestone Schedule & Due Date Analysis
  const delayedMilestones = project.milestones.filter(
    (m: any) => m.status === "delayed"
  );
  const completedMilestones = project.milestones.filter(
    (m: any) => m.status === "completed"
  );
  const inProgressMilestones = project.milestones.filter(
    (m: any) => m.status === "in_progress"
  );
  const pendingMilestones = project.milestones.filter(
    (m: any) => m.status === "pending"
  );

  for (const m of delayedMilestones) {
    computedRiskScore += 15;
    evidence.push(
      `[DELAYED MILESTONE] "${m.title}" is delayed (Due: ${m.dueDate}, Progress: ${m.progressPercent}%)`
    );
  }

  const nowMs = Date.now();

  for (const m of project.milestones) {
    if (m.status !== "completed" && m.status !== "delayed") {
      const dueTimestamp = Date.parse(m.dueDate);
      if (!isNaN(dueTimestamp) && dueTimestamp < nowMs) {
        computedRiskScore += 10;
        evidence.push(
          `[OVERDUE MILESTONE] "${m.title}" due date (${m.dueDate}) has elapsed with status "${m.status}" and ${m.progressPercent}% progress.`
        );
      }
    }
  }

  for (const m of inProgressMilestones) {
    const dueTimestamp = Date.parse(m.dueDate);
    if (!isNaN(dueTimestamp)) {
      const daysUntilDue = (dueTimestamp - nowMs) / (1000 * 60 * 60 * 24);
      if (daysUntilDue >= 0 && daysUntilDue <= 14 && m.progressPercent < 50) {
        computedRiskScore += 10;
        evidence.push(
          `[LOW PROGRESS MILESTONE] "${m.title}" is due in ${Math.round(daysUntilDue)} days (${m.dueDate}) but is only ${m.progressPercent}% complete.`
        );
      }
    }
  }

  const avgProgress =
    project.milestones.length > 0
      ? Math.round(
          project.milestones.reduce((acc: number, m: any) => acc + m.progressPercent, 0) /
            project.milestones.length
        )
      : 0;

  // 3. Target Date Pressure Analysis
  if (project.targetDate && project.status !== "completed") {
    const targetTimestamp = Date.parse(project.targetDate);
    if (!isNaN(targetTimestamp)) {
      const daysUntilTarget = Math.round(
        (targetTimestamp - nowMs) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilTarget < 0) {
        computedRiskScore += 25;
        evidence.push(
          `[OVERDUE TARGET DATE] Project target delivery date was ${project.targetDate} (${Math.abs(daysUntilTarget)} days overdue) with incomplete delivery.`
        );
      } else if (daysUntilTarget <= 30 && avgProgress < 75) {
        computedRiskScore += 15;
        evidence.push(
          `[TARGET DATE PRESSURE] Target delivery date is in ${daysUntilTarget} days (${project.targetDate}) while average milestone progress is only ${avgProgress}%.`
        );
      }
    }
  }

  // 4. Project Status & Health Score
  if (project.status === "delayed") {
    computedRiskScore += 20;
    evidence.push(
      `[PROJECT STATUS] Delivery project is formally marked as 'delayed' in delivery registry.`
    );
  } else if (project.status === "at_risk") {
    computedRiskScore += 15;
    evidence.push(
      `[PROJECT STATUS] Delivery project is marked as 'at_risk' requiring active management attention.`
    );
  }

  if (project.healthScore < 60) {
    computedRiskScore += 20;
    evidence.push(
      `[LOW HEALTH SCORE] Delivery health score is ${project.healthScore}/100, significantly below acceptable delivery threshold (80).`
    );
  } else if (project.healthScore < 80) {
    computedRiskScore += 10;
    evidence.push(
      `[MODERATE HEALTH SCORE] Delivery health score is ${project.healthScore}/100.`
    );
  }

  const normalizedRiskScore = Math.min(100, Math.max(0, computedRiskScore));

  let overallRiskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  if (criticalBlockers.length > 0 || normalizedRiskScore >= 75) {
    overallRiskLevel = "CRITICAL";
  } else if (
    highBlockers.length > 0 ||
    delayedMilestones.length > 0 ||
    project.status === "delayed" ||
    normalizedRiskScore >= 35
  ) {
    overallRiskLevel = "HIGH";
  } else if (
    project.status === "at_risk" ||
    mediumBlockers.length > 0 ||
    project.healthScore < 80 ||
    normalizedRiskScore >= 20
  ) {
    overallRiskLevel = "MEDIUM";
  } else {
    overallRiskLevel = "LOW";
  }

  if (evidence.length === 0) {
    evidence.push(
      "[ON TRACK] Zero active blockers, milestones progressing on schedule, delivery health score is nominal."
    );
  }

  let keyRiskDriver = "Nominal Delivery";
  if (criticalBlockers.length > 0) {
    keyRiskDriver = `${criticalBlockers.length} Critical Blocker(s)`;
  } else if (highBlockers.length > 0) {
    keyRiskDriver = `${highBlockers.length} High Blocker(s)`;
  } else if (delayedMilestones.length > 0) {
    keyRiskDriver = `${delayedMilestones.length} Delayed Milestone(s)`;
  } else if (project.status === "delayed" || project.status === "at_risk") {
    keyRiskDriver = `Project Status: ${project.status}`;
  } else if (project.healthScore < 80) {
    keyRiskDriver = `Low Health Score (${project.healthScore}/100)`;
  }

  return {
    projectId: project.id,
    projectName: project.name,
    clientCompany: project.customer?.company || "Direct Client",
    overallRiskLevel,
    riskScore: normalizedRiskScore,
    healthScore: project.healthScore,
    status: project.status,
    evidence,
    breakdown: {
      projectStatus: project.status,
      healthScore: project.healthScore,
      milestones: {
        total: project.milestones.length,
        completed: completedMilestones.length,
        delayed: delayedMilestones.length,
        inProgress: inProgressMilestones.length,
        pending: pendingMilestones.length,
        avgProgress,
      },
      openBlockers: {
        total: openBlockers.length,
        critical: criticalBlockers.length,
        high: highBlockers.length,
        medium: mediumBlockers.length,
        low: lowBlockers.length,
      },
    },
    keyRiskDriver,
  };
}

/**
 * Deterministically calculates evidence-backed project risk indicators based on
 * database facts: status, healthScore, delayed milestones, blocker severities, and target dates.
 */
export async function analyzeProjectRisk(
  input: ProjectRiskAnalysisInput
): Promise<ProjectRiskAnalysisOutput> {
  const parsed = projectRiskAnalysisInputSchema.parse(input);
  const identifier = parsed.projectId?.trim();

  // 1. Specific Project Risk Analysis
  if (
    identifier &&
    !["all", "portfolio", "highest", "all projects", "entire portfolio"].includes(
      identifier.toLowerCase()
    )
  ) {
    const project = await prisma.project.findFirst({
      where: {
        OR: [
          { id: { equals: identifier, mode: "insensitive" } },
          { name: { contains: identifier, mode: "insensitive" } },
        ],
      },
      include: {
        customer: true,
        milestones: true,
        blockers: {
          include: {
            milestone: true,
          },
        },
      },
    });

    if (!project) {
      return {
        found: false,
        evidence: [],
        message: `Project "${identifier}" not found. Risk analysis cannot be performed.`,
      };
    }

    const calculated = computeSingleProjectRisk(project);

    // AI Decision Support Recommendations (clearly distinguished from facts)
    const recommendations: string[] = [];
    if (calculated.overallRiskLevel === "CRITICAL") {
      recommendations.push(
        `Executive Attention: Schedule an immediate mitigation review with Delivery Lead ${project.deliveryLead}.`
      );
      recommendations.push(
        `Client Follow-up Proposal: Prepare a formal delivery update for ${calculated.clientCompany} addressing critical blocker resolutions.`
      );
    } else if (calculated.overallRiskLevel === "HIGH") {
      recommendations.push(
        `Delivery Lead Review: Request an updated milestone catch-up plan from ${project.deliveryLead}.`
      );
    } else {
      recommendations.push(
        `Routine Governance: Project is tracking nominally. Continue standard bi-weekly milestone check-ins.`
      );
    }

    const message =
      `Deterministic Risk Assessment for **${calculated.projectName}** (${calculated.projectId}):\n` +
      `• Overall Risk Level: **${calculated.overallRiskLevel}** (Risk Score: ${calculated.riskScore}/100)\n` +
      `• Client: ${calculated.clientCompany} | Lead: ${project.deliveryLead}\n` +
      `• Factual Evidence (${calculated.evidence.length} factor(s)):\n` +
      calculated.evidence.map((e, idx) => `  ${idx + 1}. ${e}`).join("\n") +
      `\n\n[AI RECOMMENDATION]\n` +
      recommendations.map((r) => `• ${r}`).join("\n");

    return {
      found: true,
      projectId: calculated.projectId,
      projectName: calculated.projectName,
      clientCompany: calculated.clientCompany,
      overallRiskLevel: calculated.overallRiskLevel,
      riskScore: calculated.riskScore,
      evidence: calculated.evidence,
      breakdown: calculated.breakdown,
      recommendations,
      message,
    };
  }

  // 2. Portfolio-wide Risk Analysis
  const allProjects = await prisma.project.findMany({
    include: {
      customer: true,
      milestones: true,
      blockers: {
        include: {
          milestone: true,
        },
      },
    },
  });

  const evaluated = allProjects.map((p) => computeSingleProjectRisk(p));
  evaluated.sort((a, b) => b.riskScore - a.riskScore); // Ranked descending by risk

  const criticalCount = evaluated.filter((p) => p.overallRiskLevel === "CRITICAL").length;
  const highCount = evaluated.filter((p) => p.overallRiskLevel === "HIGH").length;
  const mediumCount = evaluated.filter((p) => p.overallRiskLevel === "MEDIUM").length;
  const lowCount = evaluated.filter((p) => p.overallRiskLevel === "LOW").length;

  const portfolioRiskRanking = evaluated.map((p) => ({
    projectId: p.projectId,
    projectName: p.projectName,
    clientCompany: p.clientCompany,
    overallRiskLevel: p.overallRiskLevel,
    riskScore: p.riskScore,
    healthScore: p.healthScore,
    status: p.status,
    openBlockersCount: p.breakdown.openBlockers.total,
    criticalBlockersCount: p.breakdown.openBlockers.critical,
    delayedMilestonesCount: p.breakdown.milestones.delayed,
    keyRiskDriver: p.keyRiskDriver,
  }));

  const recommendations: string[] = [];
  if (evaluated.length > 0 && evaluated[0].riskScore > 30) {
    recommendations.push(
      `Priority Intervention: Direct operational review to ${evaluated[0].projectName} (${evaluated[0].clientCompany}), ranked highest risk (${evaluated[0].riskScore}/100) due to ${evaluated[0].keyRiskDriver}.`
    );
    recommendations.push(
      `Client Alignment: Prepare a governed client follow-up proposal for ${evaluated[0].clientCompany} to review revised delivery commitments.`
    );
  }

  const message =
    `Delivery Portfolio Risk Analysis (Ranked by Server Risk Engine):\n` +
    `Evaluated ${evaluated.length} active project(s): ${criticalCount} CRITICAL, ${highCount} HIGH, ${mediumCount} MEDIUM, ${lowCount} LOW.\n\n` +
    `Portfolio Risk Ranking:\n` +
    evaluated
      .map(
        (p, idx) =>
          `  ${idx + 1}. **${p.projectName}** (${p.projectId}) — **${p.overallRiskLevel}** (Risk Score: ${p.riskScore}/100, Health: ${p.healthScore}/100)\n` +
          `     Client: ${p.clientCompany} | Primary Driver: ${p.keyRiskDriver} (${p.breakdown.openBlockers.total} blocker(s), ${p.breakdown.milestones.delayed} delayed milestone(s))`
      )
      .join("\n") +
    (recommendations.length > 0
      ? `\n\n[AI RECOMMENDATION]\n` + recommendations.map((r) => `• ${r}`).join("\n")
      : "");

  const consolidatedEvidence = evaluated.flatMap((p) =>
    p.overallRiskLevel === "CRITICAL" || p.overallRiskLevel === "HIGH"
      ? [`${p.projectName}: ${p.overallRiskLevel} (${p.keyRiskDriver})`]
      : []
  );

  return {
    found: true,
    isPortfolio: true,
    evidence: consolidatedEvidence,
    portfolioRiskRanking,
    recommendations,
    message,
  };
}

export const projectRiskAnalysisTool: ToolDefinition<
  ProjectRiskAnalysisInput,
  ProjectRiskAnalysisOutput
> = {
  id: "project-risk-analysis",
  name: "Analyze Project Delivery Risk",
  description:
    "Produces deterministic, evidence-backed software delivery risk indicators based on delayed milestones, open blockers, and health metrics. Supports individual projects or portfolio-wide rankings.",
  category: "DeliveryOps",
  operationType: "READ_ONLY",
  risk: "LOW",
  requiresApproval: false,
  schema: projectRiskAnalysisInputSchema,
  outputSchema: projectRiskAnalysisOutputSchema,
  execute: analyzeProjectRisk,
};

// =============================================================================
// 4. TOOL: project-blockers
// =============================================================================

export const projectBlockersInputSchema = z.object({
  projectId: z
    .string()
    .trim()
    .optional()
    .describe(
      "Optional project ID or project name search term. If omitted or 'all', returns blockers across all projects."
    ),
  status: z
    .enum(["all", "open", "in_progress", "resolved", "unresolved"])
    .optional()
    .default("unresolved")
    .describe(
      "Filter blockers by status. 'unresolved' (default) returns open and in_progress blockers."
    ),
  severity: z
    .enum(["all", "LOW", "MEDIUM", "HIGH", "CRITICAL"])
    .optional()
    .default("all")
    .describe("Filter blockers by severity rating"),
});

export const projectBlockersOutputSchema = z.object({
  found: z.boolean(),
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  totalMatches: z.number(),
  blockers: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      severity: z.string(),
      status: z.string(),
      impact: z.string(),
      identifiedDate: z.string(),
      resolvedDate: z.string().nullable(),
      affectedMilestone: z
        .object({
          id: z.string(),
          title: z.string(),
          dueDate: z.string(),
          status: z.string(),
        })
        .nullable(),
      projectName: z.string().optional(),
      projectId: z.string().optional(),
    })
  ),
  message: z.string(),
});

export type ProjectBlockersInput = z.infer<typeof projectBlockersInputSchema>;
export type ProjectBlockersOutput = z.infer<typeof projectBlockersOutputSchema>;

export async function getProjectBlockers(
  input: ProjectBlockersInput
): Promise<ProjectBlockersOutput> {
  const parsed = projectBlockersInputSchema.parse(input);
  const identifier = parsed.projectId?.trim();

  // 1. Single Project Blockers
  if (identifier && identifier.toLowerCase() !== "all") {
    const project = await prisma.project.findFirst({
      where: {
        OR: [
          { id: { equals: identifier, mode: "insensitive" } },
          { name: { contains: identifier, mode: "insensitive" } },
        ],
      },
      include: {
        blockers: {
          include: {
            milestone: true,
          },
          orderBy: { identifiedDate: "desc" },
        },
      },
    });

    if (!project) {
      return {
        found: false,
        totalMatches: 0,
        blockers: [],
        message: `Project "${identifier}" was not found.`,
      };
    }

    let filteredBlockers = project.blockers;

    if (parsed.status === "unresolved") {
      filteredBlockers = filteredBlockers.filter(
        (b) => b.status === "open" || b.status === "in_progress"
      );
    } else if (parsed.status !== "all") {
      filteredBlockers = filteredBlockers.filter(
        (b) => b.status === parsed.status
      );
    }

    if (parsed.severity !== "all") {
      filteredBlockers = filteredBlockers.filter(
        (b) => b.severity === parsed.severity
      );
    }

    const formattedBlockers = filteredBlockers.map((b) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      severity: b.severity,
      status: b.status,
      impact: b.impact,
      identifiedDate: b.identifiedDate,
      resolvedDate: b.resolvedDate,
      affectedMilestone: b.milestone
        ? {
            id: b.milestone.id,
            title: b.milestone.title,
            dueDate: b.milestone.dueDate,
            status: b.milestone.status,
          }
        : null,
      projectName: project.name,
      projectId: project.id,
    }));

    const message =
      formattedBlockers.length > 0
        ? `Found ${formattedBlockers.length} blocker(s) for **${project.name}** (${project.id}):\n` +
          formattedBlockers
            .map(
              (b, idx) =>
                `  ${idx + 1}. [${b.severity}] **${b.title}** (${b.status})\n     Impact: ${b.impact}`
            )
            .join("\n")
        : `No matching blockers found for **${project.name}** (${project.id}).`;

    return {
      found: true,
      projectId: project.id,
      projectName: project.name,
      totalMatches: formattedBlockers.length,
      blockers: formattedBlockers,
      message,
    };
  }

  // 2. Portfolio-wide Blockers Across All Projects
  const blockerWhere: any = {};
  if (parsed.status === "unresolved") {
    blockerWhere.status = { in: ["open", "in_progress"] };
  } else if (parsed.status !== "all") {
    blockerWhere.status = parsed.status;
  }

  if (parsed.severity !== "all") {
    blockerWhere.severity = parsed.severity;
  }

  const allBlockers = await prisma.blocker.findMany({
    where: blockerWhere,
    include: {
      project: {
        include: { customer: true },
      },
      milestone: true,
    },
    orderBy: { identifiedDate: "desc" },
  });

  const formattedBlockers = allBlockers.map((b) => ({
    id: b.id,
    title: b.title,
    description: b.description,
    severity: b.severity,
    status: b.status,
    impact: b.impact,
    identifiedDate: b.identifiedDate,
    resolvedDate: b.resolvedDate,
    affectedMilestone: b.milestone
      ? {
          id: b.milestone.id,
          title: b.milestone.title,
          dueDate: b.milestone.dueDate,
          status: b.milestone.status,
        }
      : null,
    projectName: b.project?.name,
    projectId: b.project?.id,
  }));

  const message =
    formattedBlockers.length > 0
      ? `Found ${formattedBlockers.length} active delivery blocker(s) across projects:\n` +
        formattedBlockers
          .map(
            (b, idx) =>
              `  ${idx + 1}. [${b.severity}] **${b.title}** (${b.projectName || b.projectId})\n     Status: ${b.status} | Impact: ${b.impact}`
          )
          .join("\n")
      : "No active delivery blockers found across projects.";

  return {
    found: true,
    totalMatches: formattedBlockers.length,
    blockers: formattedBlockers,
    message,
  };
}

export const projectBlockersTool: ToolDefinition<
  ProjectBlockersInput,
  ProjectBlockersOutput
> = {
  id: "project-blockers",
  name: "List Project Blockers",
  description:
    "List open, in-progress, or resolved delivery blockers for a specific project or across all projects, including severity, impact, and affected milestones.",
  category: "DeliveryOps",
  operationType: "READ_ONLY",
  risk: "LOW",
  requiresApproval: false,
  schema: projectBlockersInputSchema,
  outputSchema: projectBlockersOutputSchema,
  execute: getProjectBlockers,
};

// =============================================================================
// 5. TOOL: client-delivery-summary
// =============================================================================

export const clientDeliverySummaryInputSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Client query cannot be empty if provided")
    .optional()
    .describe(
      "Customer ID (e.g. 1, 2, 3), name, or company keyword. If omitted or 'all', analyzes cross-domain risk across all accounts."
    ),
});

export const clientDeliverySummaryOutputSchema = z.object({
  found: z.boolean(),
  isPortfolio: z.boolean().optional(),
  customer: z
    .object({
      id: z.string(),
      name: z.string(),
      company: z.string(),
      email: z.string(),
      status: z.string(),
      aiHealthScore: z.number(),
    })
    .nullable(),
  deliveryPortfolio: z
    .object({
      totalProjects: z.number(),
      projectsOnTrack: z.number(),
      projectsAtRisk: z.number(),
      projectsDelayed: z.number(),
      totalOpenBlockers: z.number(),
      criticalBlockersCount: z.number(),
      highBlockersCount: z.number(),
    })
    .optional(),
  projects: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      status: z.string(),
      healthScore: z.number(),
      deliveryLead: z.string(),
      targetDate: z.string(),
      milestonesProgressAvg: z.number(),
      openBlockersCount: z.number(),
    })
  ),
  financialSnapshot: z
    .object({
      totalBilledFormatted: z.string(),
      totalPaidFormatted: z.string(),
      totalOutstandingFormatted: z.string(),
      totalOverdueFormatted: z.string(),
      unpaidInvoicesCount: z.number(),
      overdueInvoicesCount: z.number(),
    })
    .optional(),
  crossDomainAlerts: z.array(z.string()),
  compoundRiskAccounts: z
    .array(
      z.object({
        customerId: z.string(),
        name: z.string(),
        company: z.string(),
        delayedProjectsCount: z.number(),
        criticalBlockersCount: z.number(),
        overdueInvoicesCount: z.number(),
        totalOverdueFormatted: z.string(),
        summary: z.string(),
      })
    )
    .optional(),
  message: z.string(),
});

export type ClientDeliverySummaryInput = z.infer<
  typeof clientDeliverySummaryInputSchema
>;
export type ClientDeliverySummaryOutput = z.infer<
  typeof clientDeliverySummaryOutputSchema
>;

/**
 * Cross-domain query combining client account profile, software delivery projects,
 * delivery blockers, and billing/invoice health.
 */
export async function getClientDeliverySummary(
  input: ClientDeliverySummaryInput
): Promise<ClientDeliverySummaryOutput> {
  const parsed = clientDeliverySummaryInputSchema.parse(input);
  const normalizedQuery = parsed.query?.trim().replace(/[?.!]+$/, "");

  // 1. Single Client Summary
  if (normalizedQuery && normalizedQuery.toLowerCase() !== "all") {
    const custNumMatch = normalizedQuery.match(/^(?:customer|client)\s*#?\s*([1-5])$/i);
    const cleanId = custNumMatch ? custNumMatch[1] : normalizedQuery;

    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { id: { equals: cleanId } },
          { id: { equals: normalizedQuery } },
          { name: { contains: normalizedQuery, mode: "insensitive" } },
          { company: { contains: normalizedQuery, mode: "insensitive" } },
          { email: { contains: normalizedQuery, mode: "insensitive" } },
        ],
      },
      include: {
        projects: {
          include: {
            milestones: true,
            blockers: {
              where: { status: { in: ["open", "in_progress"] } },
            },
          },
        },
        invoices: true,
      },
    });

    if (!customer) {
      return {
        found: false,
        customer: null,
        projects: [],
        crossDomainAlerts: [],
        message: `Client "${normalizedQuery}" was not found.`,
      };
    }

    const projects = customer.projects;
    let totalOpenBlockers = 0;
    let criticalBlockersCount = 0;
    let highBlockersCount = 0;

    const formattedProjects = projects.map((p) => {
      const totalMs = p.milestones.length;
      const progressAvg =
        totalMs > 0
          ? Math.round(
              p.milestones.reduce((acc, m) => acc + m.progressPercent, 0) /
                totalMs
            )
          : 0;

      const openCount = p.blockers.length;
      totalOpenBlockers += openCount;
      criticalBlockersCount += p.blockers.filter(
        (b) => b.severity === "CRITICAL"
      ).length;
      highBlockersCount += p.blockers.filter(
        (b) => b.severity === "HIGH"
      ).length;

      return {
        id: p.id,
        name: p.name,
        status: p.status,
        healthScore: p.healthScore,
        deliveryLead: p.deliveryLead,
        targetDate: p.targetDate,
        milestonesProgressAvg: progressAvg,
        openBlockersCount: openCount,
      };
    });

    const projectsOnTrack = projects.filter(
      (p) => p.status === "on_track" || p.status === "completed"
    ).length;
    const projectsAtRisk = projects.filter((p) => p.status === "at_risk").length;
    const projectsDelayed = projects.filter((p) => p.status === "delayed").length;

    let totalBilledRaw = 0;
    let totalPaidRaw = 0;
    let totalOutstandingRaw = 0;
    let totalOverdueRaw = 0;
    let unpaidInvoicesCount = 0;
    let overdueInvoicesCount = 0;

    for (const inv of customer.invoices) {
      totalBilledRaw += inv.rawAmount;
      if (inv.status === "paid") {
        totalPaidRaw += inv.rawAmount;
      } else {
        totalOutstandingRaw += inv.rawAmount;
        unpaidInvoicesCount++;
        if (inv.status === "overdue") {
          totalOverdueRaw += inv.rawAmount;
          overdueInvoicesCount++;
        }
      }
    }

    const financialSnapshot = {
      totalBilledFormatted: formatINR(totalBilledRaw),
      totalPaidFormatted: formatINR(totalPaidRaw),
      totalOutstandingFormatted: formatINR(totalOutstandingRaw),
      totalOverdueFormatted: formatINR(totalOverdueRaw),
      unpaidInvoicesCount,
      overdueInvoicesCount,
    };

    const crossDomainAlerts: string[] = [];

    if (projectsDelayed > 0) {
      crossDomainAlerts.push(
        `Delivery Alert: Customer has ${projectsDelayed} delayed delivery project(s).`
      );
    }
    if (criticalBlockersCount > 0) {
      crossDomainAlerts.push(
        `Delivery Risk: ${criticalBlockersCount} CRITICAL delivery blocker(s) impacting client deliverables.`
      );
    }
    if (overdueInvoicesCount > 0) {
      crossDomainAlerts.push(
        `Billing Alert: Customer has ${overdueInvoicesCount} overdue invoice(s) totalling ${formatINR(totalOverdueRaw)}.`
      );
    }
    if (projectsDelayed > 0 && overdueInvoicesCount > 0) {
      crossDomainAlerts.push(
        `Compound Escalation: Combined delivery delay and overdue billing balance detected for this account.`
      );
    }

    const message =
      `Cross-Domain Delivery & Account Summary for **${customer.name}** (${customer.company}):\n` +
      `• Projects: **${projects.length}** (${projectsOnTrack} on track, ${projectsAtRisk} at risk, ${projectsDelayed} delayed)\n` +
      `• Open Blockers: **${totalOpenBlockers}** (${criticalBlockersCount} critical, ${highBlockersCount} high)\n` +
      `• Financial Snapshot: Outstanding: **${formatINR(totalOutstandingRaw)}** (${overdueInvoicesCount} overdue: ${formatINR(totalOverdueRaw)})\n` +
      (crossDomainAlerts.length > 0
        ? `• Operational Alerts:\n` +
          crossDomainAlerts.map((a) => `  - ⚠️ ${a}`).join("\n")
        : `• Account Status: Healthy with zero active alerts.`);

    return {
      found: true,
      customer: {
        id: customer.id,
        name: customer.name,
        company: customer.company,
        email: customer.email,
        status: customer.status,
        aiHealthScore: customer.aiHealthScore,
      },
      deliveryPortfolio: {
        totalProjects: projects.length,
        projectsOnTrack,
        projectsAtRisk,
        projectsDelayed,
        totalOpenBlockers,
        criticalBlockersCount,
        highBlockersCount,
      },
      projects: formattedProjects,
      financialSnapshot,
      crossDomainAlerts,
      message,
    };
  }

  // 2. Cross-Domain Portfolio Analysis Across All Clients
  const allCustomers = await prisma.customer.findMany({
    include: {
      projects: {
        include: {
          blockers: {
            where: { status: { in: ["open", "in_progress"] } },
          },
        },
      },
      invoices: true,
    },
  });

  const compoundRiskAccounts: any[] = [];

  for (const c of allCustomers) {
    const delayedProjects = c.projects.filter((p) => p.status === "delayed");
    const atRiskProjects = c.projects.filter((p) => p.status === "at_risk");
    const overdueInvoices = c.invoices.filter((i) => i.status === "overdue");
    const criticalBlockers = c.projects.flatMap((p) =>
      p.blockers.filter((b) => b.severity === "CRITICAL")
    );

    const hasDeliveryRisk = delayedProjects.length > 0 || atRiskProjects.length > 0 || criticalBlockers.length > 0;
    const hasOverdueInvoices = overdueInvoices.length > 0;

    if (hasDeliveryRisk && hasOverdueInvoices) {
      const overdueTotal = overdueInvoices.reduce((sum, inv) => sum + inv.rawAmount, 0);
      compoundRiskAccounts.push({
        customerId: c.id,
        name: c.name,
        company: c.company,
        delayedProjectsCount: delayedProjects.length,
        criticalBlockersCount: criticalBlockers.length,
        overdueInvoicesCount: overdueInvoices.length,
        totalOverdueFormatted: formatINR(overdueTotal),
        summary: `Has ${delayedProjects.length} delayed project(s), ${criticalBlockers.length} critical blocker(s), and ${overdueInvoices.length} overdue invoice(s) totalling ${formatINR(overdueTotal)}.`,
      });
    }
  }

  const message =
    compoundRiskAccounts.length > 0
      ? `Cross-Domain Risk Analysis: Found ${compoundRiskAccounts.length} customer account(s) with compound delivery risk and overdue invoices:\n\n` +
        compoundRiskAccounts
          .map(
            (acc, idx) =>
              `  ${idx + 1}. **${acc.name}** (${acc.company}) — Customer ID: ${acc.customerId}\n` +
              `     • Delivery: ${acc.delayedProjectsCount} delayed project(s), ${acc.criticalBlockersCount} critical blocker(s)\n` +
              `     • Invoices: ${acc.overdueInvoicesCount} overdue invoice(s) totalling ${acc.totalOverdueFormatted}\n` +
              `     • Status: **HIGH COMPOUND ESCALATION TARGET**`
          )
          .join("\n") +
        `\n\n[AI RECOMMENDATION]\n` +
        `• Schedule high-priority cross-functional account review for ${compoundRiskAccounts.map((a) => a.company).join(", ")}.\n` +
        `• Prepare governed client follow-up to address milestone adjustments alongside payment plan reconciliation.`
      : "No accounts currently exhibit combined delivery delays and overdue invoices.";

  return {
    found: true,
    isPortfolio: true,
    customer: null,
    projects: [],
    crossDomainAlerts: compoundRiskAccounts.map((a) => `${a.company}: ${a.summary}`),
    compoundRiskAccounts,
    message,
  };
}

export const clientDeliverySummaryTool: ToolDefinition<
  ClientDeliverySummaryInput,
  ClientDeliverySummaryOutput
> = {
  id: "client-delivery-summary",
  name: "Client Cross-Domain Delivery Summary",
  description:
    "Provides a unified, cross-domain summary combining software delivery projects, milestone progress, open blockers, and billing/invoice health for a specific client or across all clients exhibiting compound risk.",
  category: "DeliveryOps",
  operationType: "READ_ONLY",
  risk: "LOW",
  requiresApproval: false,
  schema: clientDeliverySummaryInputSchema,
  outputSchema: clientDeliverySummaryOutputSchema,
  execute: getClientDeliverySummary,
};

