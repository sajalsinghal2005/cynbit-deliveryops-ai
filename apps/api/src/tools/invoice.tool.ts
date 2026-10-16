import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import type { Invoice } from "../data/invoices.js";
import type { Customer } from "../data/customers.js";
import type { ToolDefinition } from "./tool.types.js";
import type { Prisma } from "@prisma/client";
import { formatINR } from "./customer.tool.js";

// Helper: parse human date strings like "Oct 7, 2026" or ISO strings into Date
export function parseDateString(dateStr: string): Date | null {
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// -------------------------------------------------------------
// 1. INVOICE SEARCH TOOL (Existing, preserved)
// -------------------------------------------------------------
export const invoiceSearchInputSchema = z.object({
  query: z
    .string()
    .optional()
    .describe("Search term matching invoice number, client name, or company"),
  status: z
    .enum(["all", "paid", "pending", "overdue", "unpaid"])
    .optional()
    .describe("Filter by payment status (all, paid, pending, overdue, unpaid)"),
  minAmount: z
    .number()
    .nonnegative()
    .optional()
    .describe("Optional minimum invoice amount in INR"),
  maxAmount: z
    .number()
    .nonnegative()
    .optional()
    .describe("Optional maximum invoice amount in INR"),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Optional limit for number of results returned"),
});

export type InvoiceSearchInput = z.infer<typeof invoiceSearchInputSchema>;

export interface InvoiceSearchResult {
  query?: string;
  filters: {
    status?: string;
    minAmount?: number;
    maxAmount?: number;
  };
  totalMatches: number;
  invoices: Invoice[];
  message: string;
}

export async function searchInvoices(
  input: InvoiceSearchInput,
): Promise<InvoiceSearchResult> {
  const parsed = invoiceSearchInputSchema.parse(input);
  const normalizedQuery = parsed.query?.trim();

  const whereConditions: Prisma.InvoiceWhereInput[] = [];

  // 1. Text filter
  if (normalizedQuery) {
    whereConditions.push({
      OR: [
        { invoiceNumber: { contains: normalizedQuery, mode: "insensitive" } },
        { clientName: { contains: normalizedQuery, mode: "insensitive" } },
        { clientCompany: { contains: normalizedQuery, mode: "insensitive" } },
        { id: { equals: normalizedQuery } },
      ],
    });
  }

  // 2. Status filter
  if (parsed.status && parsed.status !== "all") {
    if (parsed.status === "unpaid") {
      whereConditions.push({
        status: { in: ["pending", "overdue"] },
      });
    } else {
      whereConditions.push({
        status: parsed.status,
      });
    }
  }

  // 3. Amount range filters
  if (parsed.minAmount !== undefined) {
    whereConditions.push({
      rawAmount: { gte: parsed.minAmount },
    });
  }

  if (parsed.maxAmount !== undefined) {
    whereConditions.push({
      rawAmount: { lte: parsed.maxAmount },
    });
  }

  const whereClause: Prisma.InvoiceWhereInput =
    whereConditions.length > 0 ? { AND: whereConditions } : {};

  const matches = await prisma.invoice.findMany({
    where: whereClause,
    take: parsed.limit && parsed.limit > 0 ? parsed.limit : undefined,
    orderBy: { invoiceNumber: "asc" },
  });

  const formattedInvoices: Invoice[] = matches.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    clientName: inv.clientName,
    clientCompany: inv.clientCompany,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    amount: inv.amount,
    rawAmount: inv.rawAmount,
    currency: inv.currency,
    status: inv.status as "paid" | "pending" | "overdue",
    paidDate: inv.paidDate ?? undefined,
    autoRemind: inv.autoRemind,
  }));

  let summaryMsg = "";
  if (formattedInvoices.length === 0) {
    summaryMsg = "No invoices found matching the specified criteria.";
  } else {
    summaryMsg = `Found ${formattedInvoices.length} invoice(s) matching your criteria.`;
  }

  return {
    query: parsed.query,
    filters: {
      status: parsed.status,
      minAmount: parsed.minAmount,
      maxAmount: parsed.maxAmount,
    },
    totalMatches: formattedInvoices.length,
    invoices: formattedInvoices,
    message: summaryMsg,
  };
}

export const invoiceSearchTool: ToolDefinition<
  InvoiceSearchInput,
  InvoiceSearchResult
> = {
  id: "invoice-search",
  name: "Search Invoices",
  description: "Find invoices by client, company, invoice number, status, or amount range.",
  category: "Finance",
  operationType: "READ_ONLY",
  risk: "LOW",
  requiresApproval: false,
  schema: invoiceSearchInputSchema,
  execute: (params: InvoiceSearchInput) => searchInvoices(params),
};

// -------------------------------------------------------------
// 2. INVOICE SUMMARY TOOL (Detailed Invoice Breakdown)
// -------------------------------------------------------------
export const invoiceSummaryInputSchema = z.object({
  invoiceNumber: z
    .string()
    .min(1, "Invoice identifier is required")
    .describe("Invoice number (e.g. INV-1001) or invoice ID"),
});

export type InvoiceSummaryInput = z.infer<typeof invoiceSummaryInputSchema>;

export interface InvoiceSummaryResult {
  found: boolean;
  query: string;
  invoice?: Invoice;
  customer?: {
    id: string;
    name: string;
    company: string;
    email: string;
    status: string;
    aiHealthScore: number;
  };
  dueDateStatus?: {
    dueDate: string;
    isOverdue: boolean;
    daysOverdue?: number;
    daysUntilDue?: number;
  };
  message: string;
}

export async function getInvoiceSummary(
  input: InvoiceSummaryInput,
): Promise<InvoiceSummaryResult> {
  const parsed = invoiceSummaryInputSchema.parse(input);
  const normalized = parsed.invoiceNumber.trim();

  const match = await prisma.invoice.findFirst({
    where: {
      OR: [
        { invoiceNumber: { equals: normalized, mode: "insensitive" } },
        { id: { equals: normalized } },
      ],
    },
    include: {
      customer: true,
    },
  });

  if (!match) {
    return {
      found: false,
      query: parsed.invoiceNumber,
      message: `Invoice "${parsed.invoiceNumber}" was not found. Please verify the invoice number (e.g. INV-1001, INV-2048).`,
    };
  }

  // Calculate due date status
  let dueDateStatus: InvoiceSummaryResult["dueDateStatus"] = undefined;
  const parsedDueDate = parseDateString(match.dueDate);
  if (parsedDueDate) {
    const today = new Date();
    // Normalize to midnight UTC for clean calendar day differences
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dueZero = new Date(
      parsedDueDate.getFullYear(),
      parsedDueDate.getMonth(),
      parsedDueDate.getDate(),
    );
    const diffMs = todayZero.getTime() - dueZero.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      dueDateStatus = {
        dueDate: match.dueDate,
        isOverdue: true,
        daysOverdue: diffDays,
      };
    } else {
      dueDateStatus = {
        dueDate: match.dueDate,
        isOverdue: false,
        daysUntilDue: Math.abs(diffDays),
      };
    }
  }

  const invoiceObj: Invoice = {
    id: match.id,
    invoiceNumber: match.invoiceNumber,
    clientName: match.clientName,
    clientCompany: match.clientCompany,
    issueDate: match.issueDate,
    dueDate: match.dueDate,
    amount: match.amount,
    rawAmount: match.rawAmount,
    currency: match.currency,
    status: match.status as "paid" | "pending" | "overdue",
    paidDate: match.paidDate ?? undefined,
    autoRemind: match.autoRemind,
  };

  const statusLabel =
    match.status.charAt(0).toUpperCase() + match.status.slice(1);

  let timingText = "";
  if (match.status === "paid" && match.paidDate) {
    timingText = `Paid on ${match.paidDate}.`;
  } else if (match.status === "overdue" && dueDateStatus?.daysOverdue) {
    timingText = `Overdue by ${dueDateStatus.daysOverdue} day(s) (due ${match.dueDate}).`;
  } else {
    timingText = `Due on ${match.dueDate}.`;
  }

  return {
    found: true,
    query: parsed.invoiceNumber,
    invoice: invoiceObj,
    customer: match.customer
      ? {
          id: match.customer.id,
          name: match.customer.name,
          company: match.customer.company,
          email: match.customer.email,
          status: match.customer.status,
          aiHealthScore: match.customer.aiHealthScore,
        }
      : undefined,
    dueDateStatus,
    message:
      `Invoice **${match.invoiceNumber}** for ${match.clientName} (${match.clientCompany}): ` +
      `Amount: ${match.amount} | Status: **${statusLabel}** | ${timingText}`,
  };
}

export const invoiceSummaryTool: ToolDefinition<
  InvoiceSummaryInput,
  InvoiceSummaryResult
> = {
  id: "invoice-summary",
  name: "Invoice Summary",
  description: "Retrieve comprehensive details for a specific invoice, including linked customer and due status.",
  category: "Finance",
  operationType: "READ_ONLY",
  risk: "LOW",
  requiresApproval: false,
  schema: invoiceSummaryInputSchema,
  execute: (params: InvoiceSummaryInput) => getInvoiceSummary(params),
};

// -------------------------------------------------------------
// 3. OVERDUE INVOICES TOOL
// -------------------------------------------------------------
export const overdueInvoicesInputSchema = z.object({
  minAmount: z
    .number()
    .nonnegative()
    .optional()
    .describe("Optional minimum invoice amount in INR"),
  maxAmount: z
    .number()
    .nonnegative()
    .optional()
    .describe("Optional maximum invoice amount in INR"),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Optional limit for number of results returned"),
});

export type OverdueInvoicesInput = z.infer<typeof overdueInvoicesInputSchema>;

export interface OverdueInvoicesResult {
  totalOverdueCount: number;
  totalOverdueAmountRaw: number;
  totalOverdueAmountFormatted: string;
  invoices: Invoice[];
  message: string;
}

export async function getOverdueInvoices(
  input: OverdueInvoicesInput = {},
): Promise<OverdueInvoicesResult> {
  const parsed = overdueInvoicesInputSchema.parse(input);

  const whereConditions: Prisma.InvoiceWhereInput[] = [
    { status: "overdue" },
  ];

  if (parsed.minAmount !== undefined) {
    whereConditions.push({ rawAmount: { gte: parsed.minAmount } });
  }

  if (parsed.maxAmount !== undefined) {
    whereConditions.push({ rawAmount: { lte: parsed.maxAmount } });
  }

  const matches = await prisma.invoice.findMany({
    where: { AND: whereConditions },
    orderBy: { rawAmount: "desc" },
    take: parsed.limit && parsed.limit > 0 ? parsed.limit : undefined,
  });

  const totalOverdueAmountRaw = matches.reduce((s, i) => s + i.rawAmount, 0);

  const formattedInvoices: Invoice[] = matches.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    clientName: inv.clientName,
    clientCompany: inv.clientCompany,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    amount: inv.amount,
    rawAmount: inv.rawAmount,
    currency: inv.currency,
    status: inv.status as "paid" | "pending" | "overdue",
    paidDate: inv.paidDate ?? undefined,
    autoRemind: inv.autoRemind,
  }));

  const msg =
    matches.length > 0
      ? `Found ${matches.length} overdue invoice(s) totalling ${formatINR(totalOverdueAmountRaw)}.`
      : "No overdue invoices found matching your criteria.";

  return {
    totalOverdueCount: matches.length,
    totalOverdueAmountRaw,
    totalOverdueAmountFormatted: formatINR(totalOverdueAmountRaw),
    invoices: formattedInvoices,
    message: msg,
  };
}

export const overdueInvoicesTool: ToolDefinition<
  OverdueInvoicesInput,
  OverdueInvoicesResult
> = {
  id: "overdue-invoices",
  name: "Overdue Invoices",
  description: "Find all overdue customer invoices with aggregated overdue debt amounts.",
  category: "Finance",
  operationType: "READ_ONLY",
  risk: "LOW",
  requiresApproval: false,
  schema: overdueInvoicesInputSchema,
  execute: (params: OverdueInvoicesInput) => getOverdueInvoices(params),
};

// -------------------------------------------------------------
// 4. OUTSTANDING INVOICES TOOL (Pending + Overdue)
// -------------------------------------------------------------
export const outstandingInvoicesInputSchema = z.object({
  minAmount: z
    .number()
    .nonnegative()
    .optional()
    .describe("Optional minimum invoice amount in INR"),
  maxAmount: z
    .number()
    .nonnegative()
    .optional()
    .describe("Optional maximum invoice amount in INR"),
  sortBy: z
    .enum(["amount_desc", "amount_asc", "due_date_asc", "due_date_desc"])
    .optional()
    .describe("Sorting order for outstanding invoices"),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Optional limit on number of invoices returned"),
});

export type OutstandingInvoicesInput = z.infer<
  typeof outstandingInvoicesInputSchema
>;

export interface OutstandingInvoicesResult {
  totalOutstandingCount: number;
  totalOutstandingAmountRaw: number;
  totalOutstandingAmountFormatted: string;
  pendingCount: number;
  pendingAmountRaw: number;
  pendingAmountFormatted: string;
  overdueCount: number;
  overdueAmountRaw: number;
  overdueAmountFormatted: string;
  invoices: Invoice[];
  message: string;
}

export async function getOutstandingInvoices(
  input: OutstandingInvoicesInput = {},
): Promise<OutstandingInvoicesResult> {
  const parsed = outstandingInvoicesInputSchema.parse(input);

  const whereConditions: Prisma.InvoiceWhereInput[] = [
    { status: { in: ["pending", "overdue"] } },
  ];

  if (parsed.minAmount !== undefined) {
    whereConditions.push({ rawAmount: { gte: parsed.minAmount } });
  }

  if (parsed.maxAmount !== undefined) {
    whereConditions.push({ rawAmount: { lte: parsed.maxAmount } });
  }

  let orderBy: Prisma.InvoiceOrderByWithRelationInput = { rawAmount: "desc" };
  if (parsed.sortBy === "amount_asc") {
    orderBy = { rawAmount: "asc" };
  } else if (parsed.sortBy === "due_date_asc") {
    orderBy = { dueDate: "asc" };
  } else if (parsed.sortBy === "due_date_desc") {
    orderBy = { dueDate: "desc" };
  }

  const matches = await prisma.invoice.findMany({
    where: { AND: whereConditions },
    orderBy,
    take: parsed.limit && parsed.limit > 0 ? parsed.limit : undefined,
  });

  const pending = matches.filter((i) => i.status === "pending");
  const overdue = matches.filter((i) => i.status === "overdue");

  const pendingSum = pending.reduce((s, i) => s + i.rawAmount, 0);
  const overdueSum = overdue.reduce((s, i) => s + i.rawAmount, 0);
  const totalSum = pendingSum + overdueSum;

  const formattedInvoices: Invoice[] = matches.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    clientName: inv.clientName,
    clientCompany: inv.clientCompany,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    amount: inv.amount,
    rawAmount: inv.rawAmount,
    currency: inv.currency,
    status: inv.status as "paid" | "pending" | "overdue",
    paidDate: inv.paidDate ?? undefined,
    autoRemind: inv.autoRemind,
  }));

  const msg =
    matches.length > 0
      ? `Found ${matches.length} outstanding invoice(s) totalling ${formatINR(totalSum)} ` +
        `(${overdue.length} overdue = ${formatINR(overdueSum)}, ${pending.length} pending = ${formatINR(pendingSum)}).`
      : "No outstanding invoices found matching your criteria.";

  return {
    totalOutstandingCount: matches.length,
    totalOutstandingAmountRaw: totalSum,
    totalOutstandingAmountFormatted: formatINR(totalSum),
    pendingCount: pending.length,
    pendingAmountRaw: pendingSum,
    pendingAmountFormatted: formatINR(pendingSum),
    overdueCount: overdue.length,
    overdueAmountRaw: overdueSum,
    overdueAmountFormatted: formatINR(overdueSum),
    invoices: formattedInvoices,
    message: msg,
  };
}

export const outstandingInvoicesTool: ToolDefinition<
  OutstandingInvoicesInput,
  OutstandingInvoicesResult
> = {
  id: "outstanding-invoices",
  name: "Outstanding Invoices",
  description: "Retrieve all unsettled invoices (pending and overdue) with financial breakdown.",
  category: "Finance",
  operationType: "READ_ONLY",
  risk: "LOW",
  requiresApproval: false,
  schema: outstandingInvoicesInputSchema,
  execute: (params: OutstandingInvoicesInput) =>
    getOutstandingInvoices(params),
};

// -------------------------------------------------------------
// 5. INVOICE STATUS SUMMARY TOOL
// -------------------------------------------------------------
export const invoiceStatusSummaryInputSchema = z.object({});

export type InvoiceStatusSummaryInput = z.infer<
  typeof invoiceStatusSummaryInputSchema
>;

export interface StatusBreakdown {
  count: number;
  totalRawAmount: number;
  formattedAmount: string;
  percentageOfCount: number;
  percentageOfAmount: number;
}

export interface InvoiceStatusSummaryResult {
  totalInvoices: number;
  totalBilledRaw: number;
  totalBilledFormatted: string;
  statusBreakdown: {
    paid: StatusBreakdown;
    pending: StatusBreakdown;
    overdue: StatusBreakdown;
  };
  collectionRatePercent: number;
  message: string;
}

export async function getInvoiceStatusSummary(
  _input: InvoiceStatusSummaryInput = {},
): Promise<InvoiceStatusSummaryResult> {
  const allInvoices = await prisma.invoice.findMany();

  const totalInvoices = allInvoices.length;
  const totalBilledRaw = allInvoices.reduce((s, i) => s + i.rawAmount, 0);

  const paid = allInvoices.filter((i) => i.status === "paid");
  const pending = allInvoices.filter((i) => i.status === "pending");
  const overdue = allInvoices.filter((i) => i.status === "overdue");

  const paidSum = paid.reduce((s, i) => s + i.rawAmount, 0);
  const pendingSum = pending.reduce((s, i) => s + i.rawAmount, 0);
  const overdueSum = overdue.reduce((s, i) => s + i.rawAmount, 0);

  const collectionRatePercent =
    totalBilledRaw > 0
      ? Math.round((paidSum / totalBilledRaw) * 1000) / 10
      : 0;

  const buildBreakdown = (count: number, sum: number): StatusBreakdown => ({
    count,
    totalRawAmount: sum,
    formattedAmount: formatINR(sum),
    percentageOfCount:
      totalInvoices > 0 ? Math.round((count / totalInvoices) * 100) : 0,
    percentageOfAmount:
      totalBilledRaw > 0 ? Math.round((sum / totalBilledRaw) * 100) : 0,
  });

  const breakdown = {
    paid: buildBreakdown(paid.length, paidSum),
    pending: buildBreakdown(pending.length, pendingSum),
    overdue: buildBreakdown(overdue.length, overdueSum),
  };

  const message =
    `Invoice Portfolio Status (${totalInvoices} total invoices, ${formatINR(totalBilledRaw)} total billed):\n` +
    `• Paid: ${paid.length} invoices (${formatINR(paidSum)}, ${breakdown.paid.percentageOfAmount}%)\n` +
    `• Pending: ${pending.length} invoices (${formatINR(pendingSum)}, ${breakdown.pending.percentageOfAmount}%)\n` +
    `• Overdue: ${overdue.length} invoices (${formatINR(overdueSum)}, ${breakdown.overdue.percentageOfAmount}%)\n` +
    `• Overall Collection Rate: ${collectionRatePercent}%`;

  return {
    totalInvoices,
    totalBilledRaw,
    totalBilledFormatted: formatINR(totalBilledRaw),
    statusBreakdown: breakdown,
    collectionRatePercent,
    message,
  };
}

export const invoiceStatusSummaryTool: ToolDefinition<
  InvoiceStatusSummaryInput,
  InvoiceStatusSummaryResult
> = {
  id: "invoice-status-summary",
  name: "Invoice Status Summary",
  description: "Aggregated status breakdown of all invoices: counts, totals, and collection rate.",
  category: "Finance",
  operationType: "READ_ONLY",
  risk: "LOW",
  requiresApproval: false,
  schema: invoiceStatusSummaryInputSchema,
  execute: (params: InvoiceStatusSummaryInput) =>
    getInvoiceStatusSummary(params),
};
