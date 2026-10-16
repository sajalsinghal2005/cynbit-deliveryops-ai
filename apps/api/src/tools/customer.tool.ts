import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import type { Customer } from "../data/customers.js";
import type { Invoice } from "../data/invoices.js";
import type { ToolDefinition } from "./tool.types.js";
export type { ToolDefinition } from "./tool.types.js";

// Utility: format INR amount
export function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

// -------------------------------------------------------------
// 1. CUSTOMER SEARCH TOOL (Existing, preserved)
// -------------------------------------------------------------
export const customerSearchInputSchema = z.object({
  query: z
    .string()
    .describe("Search term matching customer name, company name, email, or ID"),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Optional limit for number of results returned"),
});

export type CustomerSearchInput = z.infer<typeof customerSearchInputSchema>;

export interface CustomerSearchResult {
  query: string;
  totalMatches: number;
  customers: Customer[];
  message: string;
}

export async function searchCustomers(
  input: CustomerSearchInput,
): Promise<CustomerSearchResult> {
  const parsed = customerSearchInputSchema.parse(input);
  const normalizedQuery = parsed.query.trim();

  if (!normalizedQuery) {
    return {
      query: parsed.query,
      totalMatches: 0,
      customers: [],
      message: "Please provide a valid, non-empty search query.",
    };
  }

  const matches = await prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: normalizedQuery, mode: "insensitive" } },
        { company: { contains: normalizedQuery, mode: "insensitive" } },
        { email: { contains: normalizedQuery, mode: "insensitive" } },
        { id: { equals: normalizedQuery } },
      ],
    },
    take: parsed.limit && parsed.limit > 0 ? parsed.limit : undefined,
    orderBy: { id: "asc" },
  });

  const formattedCustomers: Customer[] = matches.map((c) => ({
    id: c.id,
    name: c.name,
    company: c.company,
    email: c.email,
    avatar: c.avatar,
    totalSpend: c.totalSpend,
    ordersCount: c.ordersCount,
    status: c.status as "active" | "inactive" | "lead",
    aiHealthScore: c.aiHealthScore,
    lastActive: c.lastActive,
  }));

  return {
    query: parsed.query,
    totalMatches: formattedCustomers.length,
    customers: formattedCustomers,
    message:
      formattedCustomers.length > 0
        ? `Found ${formattedCustomers.length} customer(s) matching "${parsed.query}".`
        : `No customers found matching "${parsed.query}".`,
  };
}

export const customerSearchTool: ToolDefinition<
  CustomerSearchInput,
  CustomerSearchResult
> = {
  id: "customer-search",
  name: "Search Customers",
  description: "Find customers using name, email, company, or customer ID.",
  category: "CRM",
  operationType: "READ_ONLY",
  risk: "LOW",
  requiresApproval: false,
  schema: customerSearchInputSchema,
  execute: (params: CustomerSearchInput) => searchCustomers(params),
};

// -------------------------------------------------------------
// 2. CUSTOMER SUMMARY TOOL (Advanced Profile & Financial Summary)
// -------------------------------------------------------------
export const customerSummaryInputSchema = z.object({
  query: z
    .string()
    .min(1, "Customer identifier is required")
    .describe("Customer name, company, email, or customer ID"),
});

export type CustomerSummaryInput = z.infer<typeof customerSummaryInputSchema>;

export interface CustomerFinancialSummary {
  totalInvoicesCount: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  totalBilledRaw: number;
  totalBilledFormatted: string;
  totalPaidRaw: number;
  totalPaidFormatted: string;
  totalPendingRaw: number;
  totalPendingFormatted: string;
  totalOverdueRaw: number;
  totalOverdueFormatted: string;
  totalOutstandingRaw: number;
  totalOutstandingFormatted: string;
}

export interface CustomerSummaryResult {
  found: boolean;
  query: string;
  customer?: Customer;
  financialSummary?: CustomerFinancialSummary;
  message: string;
}

export async function getCustomerSummary(
  input: CustomerSummaryInput,
): Promise<CustomerSummaryResult> {
  const parsed = customerSummaryInputSchema.parse(input);
  const normalized = parsed.query.trim();

  // Find customer by ID, exact/contain name, company, or email
  const match = await prisma.customer.findFirst({
    where: {
      OR: [
        { id: { equals: normalized } },
        { name: { contains: normalized, mode: "insensitive" } },
        { company: { contains: normalized, mode: "insensitive" } },
        { email: { contains: normalized, mode: "insensitive" } },
      ],
    },
    include: {
      invoices: {
        orderBy: { dueDate: "desc" },
      },
    },
  });

  if (!match) {
    return {
      found: false,
      query: parsed.query,
      message: `No customer record found matching "${parsed.query}".`,
    };
  }

  const invoices = match.invoices;
  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const pendingInvoices = invoices.filter((i) => i.status === "pending");
  const overdueInvoices = invoices.filter((i) => i.status === "overdue");

  const totalBilledRaw = invoices.reduce((s, i) => s + i.rawAmount, 0);
  const totalPaidRaw = paidInvoices.reduce((s, i) => s + i.rawAmount, 0);
  const totalPendingRaw = pendingInvoices.reduce((s, i) => s + i.rawAmount, 0);
  const totalOverdueRaw = overdueInvoices.reduce((s, i) => s + i.rawAmount, 0);
  const totalOutstandingRaw = totalPendingRaw + totalOverdueRaw;

  const financialSummary: CustomerFinancialSummary = {
    totalInvoicesCount: invoices.length,
    paidCount: paidInvoices.length,
    pendingCount: pendingInvoices.length,
    overdueCount: overdueInvoices.length,
    totalBilledRaw,
    totalBilledFormatted: formatINR(totalBilledRaw),
    totalPaidRaw,
    totalPaidFormatted: formatINR(totalPaidRaw),
    totalPendingRaw,
    totalPendingFormatted: formatINR(totalPendingRaw),
    totalOverdueRaw,
    totalOverdueFormatted: formatINR(totalOverdueRaw),
    totalOutstandingRaw,
    totalOutstandingFormatted: formatINR(totalOutstandingRaw),
  };

  const customerObj: Customer = {
    id: match.id,
    name: match.name,
    company: match.company,
    email: match.email,
    avatar: match.avatar,
    totalSpend: match.totalSpend,
    ordersCount: match.ordersCount,
    status: match.status as "active" | "inactive" | "lead",
    aiHealthScore: match.aiHealthScore,
    lastActive: match.lastActive,
  };

  return {
    found: true,
    query: parsed.query,
    customer: customerObj,
    financialSummary,
    message:
      `Summary for ${match.name} (${match.company}): ` +
      `${invoices.length} total invoice(s), ${formatINR(totalOutstandingRaw)} outstanding ` +
      `(${overdueInvoices.length} overdue, ${pendingInvoices.length} pending). ` +
      `Account health score is ${match.aiHealthScore}/100.`,
  };
}

export const customerSummaryTool: ToolDefinition<
  CustomerSummaryInput,
  CustomerSummaryResult
> = {
  id: "customer-summary",
  name: "Customer Summary",
  description: "Retrieve comprehensive customer profile and aggregated invoice financial summary.",
  category: "CRM",
  operationType: "READ_ONLY",
  risk: "LOW",
  requiresApproval: false,
  schema: customerSummaryInputSchema,
  execute: (params: CustomerSummaryInput) => getCustomerSummary(params),
};

// -------------------------------------------------------------
// 3. CUSTOMER INVOICE HISTORY TOOL
// -------------------------------------------------------------
export const customerInvoiceHistoryInputSchema = z.object({
  query: z
    .string()
    .min(1, "Customer identifier is required")
    .describe("Customer name, company, email, or customer ID"),
  status: z
    .enum(["all", "paid", "pending", "overdue", "unpaid"])
    .optional()
    .describe("Filter invoices by status (all, paid, pending, overdue, unpaid)"),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Optional limit on number of invoices returned"),
});

export type CustomerInvoiceHistoryInput = z.infer<
  typeof customerInvoiceHistoryInputSchema
>;

export interface CustomerInvoiceHistoryResult {
  found: boolean;
  query: string;
  customer?: {
    id: string;
    name: string;
    company: string;
    email: string;
  };
  totalInvoices: number;
  invoices: Invoice[];
  message: string;
}

export async function getCustomerInvoiceHistory(
  input: CustomerInvoiceHistoryInput,
): Promise<CustomerInvoiceHistoryResult> {
  const parsed = customerInvoiceHistoryInputSchema.parse(input);
  const normalized = parsed.query.trim();

  // Find customer first
  const customer = await prisma.customer.findFirst({
    where: {
      OR: [
        { id: { equals: normalized } },
        { name: { contains: normalized, mode: "insensitive" } },
        { company: { contains: normalized, mode: "insensitive" } },
        { email: { contains: normalized, mode: "insensitive" } },
      ],
    },
  });

  if (!customer) {
    return {
      found: false,
      query: parsed.query,
      totalInvoices: 0,
      invoices: [],
      message: `No customer record found matching "${parsed.query}".`,
    };
  }

  // Build where clause for invoices linked to this customer
  const whereConditions: any = {
    OR: [
      { customerId: customer.id },
      { clientCompany: { contains: customer.company, mode: "insensitive" } },
    ],
  };

  if (parsed.status && parsed.status !== "all") {
    if (parsed.status === "unpaid") {
      whereConditions.status = { in: ["pending", "overdue"] };
    } else {
      whereConditions.status = parsed.status;
    }
  }

  const invoices = await prisma.invoice.findMany({
    where: whereConditions,
    orderBy: { invoiceNumber: "desc" },
    take: parsed.limit && parsed.limit > 0 ? parsed.limit : undefined,
  });

  const formattedInvoices: Invoice[] = invoices.map((inv) => ({
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

  return {
    found: true,
    query: parsed.query,
    customer: {
      id: customer.id,
      name: customer.name,
      company: customer.company,
      email: customer.email,
    },
    totalInvoices: formattedInvoices.length,
    invoices: formattedInvoices,
    message:
      formattedInvoices.length > 0
        ? `Found ${formattedInvoices.length} invoice(s) for ${customer.name} (${customer.company}).`
        : `No matching invoices found for ${customer.name} (${customer.company}).`,
  };
}

export const customerInvoiceHistoryTool: ToolDefinition<
  CustomerInvoiceHistoryInput,
  CustomerInvoiceHistoryResult
> = {
  id: "customer-invoice-history",
  name: "Customer Invoice History",
  description: "Retrieve complete invoice transaction history for a specific customer.",
  category: "CRM",
  operationType: "READ_ONLY",
  risk: "LOW",
  requiresApproval: false,
  schema: customerInvoiceHistoryInputSchema,
  execute: (params: CustomerInvoiceHistoryInput) =>
    getCustomerInvoiceHistory(params),
};

// -------------------------------------------------------------
// 4. CUSTOMER OUTSTANDING BALANCE TOOL
// -------------------------------------------------------------
export const customerOutstandingBalanceInputSchema = z.object({
  query: z
    .string()
    .min(1, "Customer identifier is required")
    .describe("Customer name, company, email, or customer ID"),
});

export type CustomerOutstandingBalanceInput = z.infer<
  typeof customerOutstandingBalanceInputSchema
>;

export interface CustomerOutstandingBalanceResult {
  found: boolean;
  query: string;
  customer?: {
    id: string;
    name: string;
    company: string;
    email: string;
  };
  hasOutstanding: boolean;
  totalOutstandingRaw: number;
  totalOutstandingFormatted: string;
  pendingAmountRaw: number;
  pendingAmountFormatted: string;
  overdueAmountRaw: number;
  overdueAmountFormatted: string;
  unpaidInvoiceCount: number;
  unpaidInvoices: Invoice[];
  message: string;
}

export async function getCustomerOutstandingBalance(
  input: CustomerOutstandingBalanceInput,
): Promise<CustomerOutstandingBalanceResult> {
  const parsed = customerOutstandingBalanceInputSchema.parse(input);
  const normalized = parsed.query.trim();

  const customer = await prisma.customer.findFirst({
    where: {
      OR: [
        { id: { equals: normalized } },
        { name: { contains: normalized, mode: "insensitive" } },
        { company: { contains: normalized, mode: "insensitive" } },
        { email: { contains: normalized, mode: "insensitive" } },
      ],
    },
    include: {
      invoices: {
        where: {
          status: { in: ["pending", "overdue"] },
        },
        orderBy: { dueDate: "asc" },
      },
    },
  });

  if (!customer) {
    return {
      found: false,
      query: parsed.query,
      hasOutstanding: false,
      totalOutstandingRaw: 0,
      totalOutstandingFormatted: formatINR(0),
      pendingAmountRaw: 0,
      pendingAmountFormatted: formatINR(0),
      overdueAmountRaw: 0,
      overdueAmountFormatted: formatINR(0),
      unpaidInvoiceCount: 0,
      unpaidInvoices: [],
      message: `No customer record found matching "${parsed.query}".`,
    };
  }

  const unpaid = customer.invoices;
  const pendingInvoices = unpaid.filter((i) => i.status === "pending");
  const overdueInvoices = unpaid.filter((i) => i.status === "overdue");

  const pendingAmountRaw = pendingInvoices.reduce((s, i) => s + i.rawAmount, 0);
  const overdueAmountRaw = overdueInvoices.reduce((s, i) => s + i.rawAmount, 0);
  const totalOutstandingRaw = pendingAmountRaw + overdueAmountRaw;

  const formattedInvoices: Invoice[] = unpaid.map((inv) => ({
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

  const hasOutstanding = totalOutstandingRaw > 0;
  let summaryMessage = "";

  if (!hasOutstanding) {
    summaryMessage = `${customer.name} (${customer.company}) has no outstanding balance. All invoices are settled.`;
  } else {
    summaryMessage =
      `${customer.name} (${customer.company}) has an outstanding balance of ${formatINR(totalOutstandingRaw)} ` +
      `across ${unpaid.length} unpaid invoice(s) ` +
      `(${formatINR(overdueAmountRaw)} overdue in ${overdueInvoices.length} invoice(s), ` +
      `${formatINR(pendingAmountRaw)} pending in ${pendingInvoices.length} invoice(s)).`;
  }

  return {
    found: true,
    query: parsed.query,
    customer: {
      id: customer.id,
      name: customer.name,
      company: customer.company,
      email: customer.email,
    },
    hasOutstanding,
    totalOutstandingRaw,
    totalOutstandingFormatted: formatINR(totalOutstandingRaw),
    pendingAmountRaw,
    pendingAmountFormatted: formatINR(pendingAmountRaw),
    overdueAmountRaw,
    overdueAmountFormatted: formatINR(overdueAmountRaw),
    unpaidInvoiceCount: unpaid.length,
    unpaidInvoices: formattedInvoices,
    message: summaryMessage,
  };
}

export const customerOutstandingBalanceTool: ToolDefinition<
  CustomerOutstandingBalanceInput,
  CustomerOutstandingBalanceResult
> = {
  id: "customer-outstanding-balance",
  name: "Customer Outstanding Balance",
  description: "Calculate exact outstanding and overdue invoice balance for a customer.",
  category: "CRM",
  operationType: "READ_ONLY",
  risk: "LOW",
  requiresApproval: false,
  schema: customerOutstandingBalanceInputSchema,
  execute: (params: CustomerOutstandingBalanceInput) =>
    getCustomerOutstandingBalance(params),
};

// -------------------------------------------------------------
// 5. CUSTOMERS WITH OUTSTANDING INVOICES TOOL
// -------------------------------------------------------------
export const customersWithOutstandingInputSchema = z.object({
  minBalance: z
    .number()
    .nonnegative()
    .optional()
    .describe("Optional minimum outstanding balance filter in INR"),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Optional limit for number of customers returned"),
});

export type CustomersWithOutstandingInput = z.infer<
  typeof customersWithOutstandingInputSchema
>;

export interface CustomerWithBalanceItem {
  id: string;
  name: string;
  company: string;
  email: string;
  outstandingAmountRaw: number;
  outstandingAmountFormatted: string;
  overdueAmountRaw: number;
  overdueAmountFormatted: string;
  pendingAmountRaw: number;
  pendingAmountFormatted: string;
  unpaidInvoiceCount: number;
  overdueInvoiceCount: number;
}

export interface CustomersWithOutstandingResult {
  totalCustomersWithBalance: number;
  totalOutstandingPortfolioRaw: number;
  totalOutstandingPortfolioFormatted: string;
  customers: CustomerWithBalanceItem[];
  message: string;
}

export async function getCustomersWithOutstanding(
  input: CustomersWithOutstandingInput = {},
): Promise<CustomersWithOutstandingResult> {
  const parsed = customersWithOutstandingInputSchema.parse(input);

  const customers = await prisma.customer.findMany({
    include: {
      invoices: {
        where: {
          status: { in: ["pending", "overdue"] },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const items: CustomerWithBalanceItem[] = [];
  let portfolioSum = 0;

  for (const c of customers) {
    if (c.invoices.length === 0) continue;

    const pending = c.invoices.filter((i) => i.status === "pending");
    const overdue = c.invoices.filter((i) => i.status === "overdue");

    const pendingSum = pending.reduce((s, i) => s + i.rawAmount, 0);
    const overdueSum = overdue.reduce((s, i) => s + i.rawAmount, 0);
    const totalOut = pendingSum + overdueSum;

    if (parsed.minBalance !== undefined && totalOut < parsed.minBalance) {
      continue;
    }

    portfolioSum += totalOut;
    items.push({
      id: c.id,
      name: c.name,
      company: c.company,
      email: c.email,
      outstandingAmountRaw: totalOut,
      outstandingAmountFormatted: formatINR(totalOut),
      overdueAmountRaw: overdueSum,
      overdueAmountFormatted: formatINR(overdueSum),
      pendingAmountRaw: pendingSum,
      pendingAmountFormatted: formatINR(pendingSum),
      unpaidInvoiceCount: c.invoices.length,
      overdueInvoiceCount: overdue.length,
    });
  }

  // Sort descending by highest outstanding balance
  items.sort((a, b) => b.outstandingAmountRaw - a.outstandingAmountRaw);

  const finalItems =
    parsed.limit && parsed.limit > 0 ? items.slice(0, parsed.limit) : items;

  return {
    totalCustomersWithBalance: items.length,
    totalOutstandingPortfolioRaw: portfolioSum,
    totalOutstandingPortfolioFormatted: formatINR(portfolioSum),
    customers: finalItems,
    message:
      items.length > 0
        ? `Found ${items.length} customer(s) with outstanding invoice balances totalling ${formatINR(portfolioSum)}.`
        : "No customers found with outstanding balances matching your criteria.",
  };
}

export const customersWithOutstandingTool: ToolDefinition<
  CustomersWithOutstandingInput,
  CustomersWithOutstandingResult
> = {
  id: "customers-with-outstanding",
  name: "Customers With Outstanding Invoices",
  description: "Identify all customers with unpaid (pending or overdue) invoices ranked by balance.",
  category: "CRM",
  operationType: "READ_ONLY",
  risk: "LOW",
  requiresApproval: false,
  schema: customersWithOutstandingInputSchema,
  execute: (params: CustomersWithOutstandingInput) =>
    getCustomersWithOutstanding(params),
};
