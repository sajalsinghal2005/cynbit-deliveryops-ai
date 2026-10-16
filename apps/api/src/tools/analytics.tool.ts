import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import type { ToolDefinition } from "./tool.types.js";
import { formatINR } from "./customer.tool.js";

// -------------------------------------------------------------
// 1. BI: TOTAL OUTSTANDING REVENUE TOOL
// -------------------------------------------------------------
export const biOutstandingTotalInputSchema = z.object({});
export type BiOutstandingTotalInput = z.infer<
  typeof biOutstandingTotalInputSchema
>;

export interface BiOutstandingTotalResult {
  totalOutstandingRaw: number;
  totalOutstandingFormatted: string;
  pendingTotalRaw: number;
  pendingTotalFormatted: string;
  overdueTotalRaw: number;
  overdueTotalFormatted: string;
  totalOutstandingInvoicesCount: number;
  pendingInvoicesCount: number;
  overdueInvoicesCount: number;
  currency: string;
  message: string;
}

export async function getBiOutstandingTotal(
  _input: BiOutstandingTotalInput = {},
): Promise<BiOutstandingTotalResult> {
  const unpaidInvoices = await prisma.invoice.findMany({
    where: {
      status: { in: ["pending", "overdue"] },
    },
  });

  const pending = unpaidInvoices.filter((i) => i.status === "pending");
  const overdue = unpaidInvoices.filter((i) => i.status === "overdue");

  const pendingTotalRaw = pending.reduce((sum, inv) => sum + inv.rawAmount, 0);
  const overdueTotalRaw = overdue.reduce((sum, inv) => sum + inv.rawAmount, 0);
  const totalOutstandingRaw = pendingTotalRaw + overdueTotalRaw;

  const message =
    `Total outstanding business balance is **${formatINR(totalOutstandingRaw)}** ` +
    `across ${unpaidInvoices.length} unpaid invoice(s):\n` +
    `• Overdue Debt: ${formatINR(overdueTotalRaw)} (${overdue.length} overdue invoice${overdue.length === 1 ? "" : "s"})\n` +
    `• Pending Balance: ${formatINR(pendingTotalRaw)} (${pending.length} pending invoice${pending.length === 1 ? "" : "s"})`;

  return {
    totalOutstandingRaw,
    totalOutstandingFormatted: formatINR(totalOutstandingRaw),
    pendingTotalRaw,
    pendingTotalFormatted: formatINR(pendingTotalRaw),
    overdueTotalRaw,
    overdueTotalFormatted: formatINR(overdueTotalRaw),
    totalOutstandingInvoicesCount: unpaidInvoices.length,
    pendingInvoicesCount: pending.length,
    overdueInvoicesCount: overdue.length,
    currency: "INR",
    message,
  };
}

export const biOutstandingTotalTool: ToolDefinition<
  BiOutstandingTotalInput,
  BiOutstandingTotalResult
> = {
  id: "bi-outstanding-total",
  name: "BI: Outstanding Total Revenue",
  description: "Calculate deterministic total outstanding accounts receivable debt across pending and overdue invoices.",
  category: "Analytics",
  operationType: "READ_ONLY",
  risk: "LOW",
  requiresApproval: false,
  schema: biOutstandingTotalInputSchema,
  execute: (params: BiOutstandingTotalInput) => getBiOutstandingTotal(params),
};

// -------------------------------------------------------------
// 2. BI: OVERDUE INVOICE SUMMARY TOOL
// -------------------------------------------------------------
export const biOverdueSummaryInputSchema = z.object({});
export type BiOverdueSummaryInput = z.infer<typeof biOverdueSummaryInputSchema>;

export interface BiOverdueSummaryResult {
  totalOverdueCount: number;
  totalOverdueAmountRaw: number;
  totalOverdueAmountFormatted: string;
  averageOverdueAmountRaw: number;
  averageOverdueAmountFormatted: string;
  impactedClientsCount: number;
  impactedClients: string[];
  invoices: Array<{
    invoiceNumber: string;
    clientName: string;
    clientCompany: string;
    amount: string;
    rawAmount: number;
    dueDate: string;
  }>;
  message: string;
}

export async function getBiOverdueSummary(
  _input: BiOverdueSummaryInput = {},
): Promise<BiOverdueSummaryResult> {
  const overdueInvoices = await prisma.invoice.findMany({
    where: { status: "overdue" },
    orderBy: { rawAmount: "desc" },
  });

  const totalOverdueCount = overdueInvoices.length;
  const totalOverdueAmountRaw = overdueInvoices.reduce(
    (sum, inv) => sum + inv.rawAmount,
    0,
  );
  const averageOverdueAmountRaw =
    totalOverdueCount > 0
      ? Math.round(totalOverdueAmountRaw / totalOverdueCount)
      : 0;

  const uniqueClients = Array.from(
    new Set(overdueInvoices.map((inv) => `${inv.clientName} (${inv.clientCompany})`)),
  );

  const formattedInvoices = overdueInvoices.map((inv) => ({
    invoiceNumber: inv.invoiceNumber,
    clientName: inv.clientName,
    clientCompany: inv.clientCompany,
    amount: inv.amount,
    rawAmount: inv.rawAmount,
    dueDate: inv.dueDate,
  }));

  let message = "";
  if (totalOverdueCount === 0) {
    message = "There are currently no overdue invoices. All accounts are up-to-date.";
  } else {
    message =
      `Overdue Invoices Summary: **${formatINR(totalOverdueAmountRaw)}** across ${totalOverdueCount} invoice(s) ` +
      `affecting ${uniqueClients.length} client(s). Average overdue ticket: ${formatINR(averageOverdueAmountRaw)}.\n\n` +
      formattedInvoices
        .map(
          (inv) =>
            `• **${inv.invoiceNumber}**: ${inv.amount} — ${inv.clientName} (${inv.clientCompany}), Due: ${inv.dueDate}`,
        )
        .join("\n");
  }

  return {
    totalOverdueCount,
    totalOverdueAmountRaw,
    totalOverdueAmountFormatted: formatINR(totalOverdueAmountRaw),
    averageOverdueAmountRaw,
    averageOverdueAmountFormatted: formatINR(averageOverdueAmountRaw),
    impactedClientsCount: uniqueClients.length,
    impactedClients: uniqueClients,
    invoices: formattedInvoices,
    message,
  };
}

export const biOverdueSummaryTool: ToolDefinition<
  BiOverdueSummaryInput,
  BiOverdueSummaryResult
> = {
  id: "bi-overdue-summary",
  name: "BI: Overdue Invoices Intelligence",
  description: "Comprehensive deterministic metrics on overdue debt, impacted accounts, and risk distribution.",
  category: "Analytics",
  operationType: "READ_ONLY",
  risk: "LOW",
  requiresApproval: false,
  schema: biOverdueSummaryInputSchema,
  execute: (params: BiOverdueSummaryInput) => getBiOverdueSummary(params),
};

// -------------------------------------------------------------
// 3. BI: TOP OUTSTANDING CUSTOMERS TOOL
// -------------------------------------------------------------
export const biTopOutstandingCustomersInputSchema = z.object({
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Maximum number of top customers to return (default 5)"),
});

export type BiTopOutstandingCustomersInput = z.infer<
  typeof biTopOutstandingCustomersInputSchema
>;

export interface RankedCustomerDebtItem {
  rank: number;
  customerId: string;
  name: string;
  company: string;
  email: string;
  totalOutstandingRaw: number;
  totalOutstandingFormatted: string;
  overdueAmountRaw: number;
  overdueAmountFormatted: string;
  pendingAmountRaw: number;
  pendingAmountFormatted: string;
  overdueCount: number;
  pendingCount: number;
  aiHealthScore: number;
}

export interface BiTopOutstandingCustomersResult {
  totalDebtPortfolioRaw: number;
  totalDebtPortfolioFormatted: string;
  rankedCustomers: RankedCustomerDebtItem[];
  message: string;
}

export async function getBiTopOutstandingCustomers(
  input: BiTopOutstandingCustomersInput = {},
): Promise<BiTopOutstandingCustomersResult> {
  const parsed = biTopOutstandingCustomersInputSchema.parse(input);
  const maxLimit = parsed.limit && parsed.limit > 0 ? parsed.limit : 5;

  const customers = await prisma.customer.findMany({
    include: {
      invoices: {
        where: { status: { in: ["pending", "overdue"] } },
      },
    },
  });

  const ranked: Omit<RankedCustomerDebtItem, "rank">[] = [];
  let totalPortfolioDebt = 0;

  for (const c of customers) {
    if (c.invoices.length === 0) continue;

    const pending = c.invoices.filter((i) => i.status === "pending");
    const overdue = c.invoices.filter((i) => i.status === "overdue");

    const pendingSum = pending.reduce((sum, inv) => sum + inv.rawAmount, 0);
    const overdueSum = overdue.reduce((sum, inv) => sum + inv.rawAmount, 0);
    const totalOut = pendingSum + overdueSum;

    totalPortfolioDebt += totalOut;

    ranked.push({
      customerId: c.id,
      name: c.name,
      company: c.company,
      email: c.email,
      totalOutstandingRaw: totalOut,
      totalOutstandingFormatted: formatINR(totalOut),
      overdueAmountRaw: overdueSum,
      overdueAmountFormatted: formatINR(overdueSum),
      pendingAmountRaw: pendingSum,
      pendingAmountFormatted: formatINR(pendingSum),
      overdueCount: overdue.length,
      pendingCount: pending.length,
      aiHealthScore: c.aiHealthScore,
    });
  }

  // Sort descending by outstanding amount
  ranked.sort((a, b) => b.totalOutstandingRaw - a.totalOutstandingRaw);

  const topRanked: RankedCustomerDebtItem[] = ranked
    .slice(0, maxLimit)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  let message = "";
  if (topRanked.length === 0) {
    message = "No customers currently have outstanding balances.";
  } else {
    message =
      `Top ${topRanked.length} Customer(s) by Outstanding Balance (Total Portfolio Debt: ${formatINR(totalPortfolioDebt)}):\n\n` +
      topRanked
        .map(
          (c) =>
            `${c.rank}. **${c.name}** (${c.company}) — **${c.totalOutstandingFormatted}** ` +
            `(${c.overdueCount > 0 ? `${formatINR(c.overdueAmountRaw)} overdue` : "0 overdue"}, ${c.pendingCount} pending)`,
        )
        .join("\n");
  }

  return {
    totalDebtPortfolioRaw: totalPortfolioDebt,
    totalDebtPortfolioFormatted: formatINR(totalPortfolioDebt),
    rankedCustomers: topRanked,
    message,
  };
}

export const biTopOutstandingCustomersTool: ToolDefinition<
  BiTopOutstandingCustomersInput,
  BiTopOutstandingCustomersResult
> = {
  id: "bi-top-outstanding-customers",
  name: "BI: Top Outstanding Customers Ranking",
  description: "Rank customers with the largest outstanding invoice balances across pending and overdue accounts.",
  category: "Analytics",
  operationType: "READ_ONLY",
  risk: "LOW",
  requiresApproval: false,
  schema: biTopOutstandingCustomersInputSchema,
  execute: (params: BiTopOutstandingCustomersInput) =>
    getBiTopOutstandingCustomers(params),
};

// -------------------------------------------------------------
// 4. BI: REVENUE & FINANCIAL PERFORMANCE METRICS TOOL
// -------------------------------------------------------------
export const biRevenueMetricsInputSchema = z.object({});
export type BiRevenueMetricsInput = z.infer<typeof biRevenueMetricsInputSchema>;

export interface BiRevenueMetricsResult {
  totalInvoicesCount: number;
  totalBilledRaw: number;
  totalBilledFormatted: string;
  totalCollectedRaw: number;
  totalCollectedFormatted: string;
  totalOutstandingRaw: number;
  totalOutstandingFormatted: string;
  collectionRatePercent: number;
  activeCustomersCount: number;
  paidInvoicesCount: number;
  pendingInvoicesCount: number;
  overdueInvoicesCount: number;
  currency: string;
  message: string;
}

export async function getBiRevenueMetrics(
  _input: BiRevenueMetricsInput = {},
): Promise<BiRevenueMetricsResult> {
  const [invoices, customerCount] = await Promise.all([
    prisma.invoice.findMany(),
    prisma.customer.count({ where: { status: "active" } }),
  ]);

  const totalInvoicesCount = invoices.length;
  const totalBilledRaw = invoices.reduce((s, i) => s + i.rawAmount, 0);

  const paid = invoices.filter((i) => i.status === "paid");
  const pending = invoices.filter((i) => i.status === "pending");
  const overdue = invoices.filter((i) => i.status === "overdue");

  const totalCollectedRaw = paid.reduce((s, i) => s + i.rawAmount, 0);
  const pendingSum = pending.reduce((s, i) => s + i.rawAmount, 0);
  const overdueSum = overdue.reduce((s, i) => s + i.rawAmount, 0);
  const totalOutstandingRaw = pendingSum + overdueSum;

  const collectionRatePercent =
    totalBilledRaw > 0
      ? Math.round((totalCollectedRaw / totalBilledRaw) * 1000) / 10
      : 0;

  const message =
    `Financial Revenue & Collections Performance:\n` +
    `• Total Billed: ${formatINR(totalBilledRaw)} (${totalInvoicesCount} invoices)\n` +
    `• Total Collected (Paid): ${formatINR(totalCollectedRaw)} (${paid.length} invoices)\n` +
    `• Total Outstanding: ${formatINR(totalOutstandingRaw)} (${pending.length} pending, ${overdue.length} overdue)\n` +
    `• Collection Realization Rate: **${collectionRatePercent}%**\n` +
    `• Active Client Base: ${customerCount} active accounts`;

  return {
    totalInvoicesCount,
    totalBilledRaw,
    totalBilledFormatted: formatINR(totalBilledRaw),
    totalCollectedRaw,
    totalCollectedFormatted: formatINR(totalCollectedRaw),
    totalOutstandingRaw,
    totalOutstandingFormatted: formatINR(totalOutstandingRaw),
    collectionRatePercent,
    activeCustomersCount: customerCount,
    paidInvoicesCount: paid.length,
    pendingInvoicesCount: pending.length,
    overdueInvoicesCount: overdue.length,
    currency: "INR",
    message,
  };
}

export const biRevenueMetricsTool: ToolDefinition<
  BiRevenueMetricsInput,
  BiRevenueMetricsResult
> = {
  id: "bi-revenue-metrics",
  name: "BI: Revenue & Collections Metrics",
  description: "Executive-level revenue performance indicators: total billed, collections, collection rate, and debt load.",
  category: "Analytics",
  operationType: "READ_ONLY",
  risk: "LOW",
  requiresApproval: false,
  schema: biRevenueMetricsInputSchema,
  execute: (params: BiRevenueMetricsInput) => getBiRevenueMetrics(params),
};
