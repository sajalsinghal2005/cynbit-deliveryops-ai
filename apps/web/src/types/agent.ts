export type AgentOutcomeType =
  | "READ_ONLY_RESULT"
  | "APPROVAL_REQUIRED"
  | "UNSUPPORTED_REQUEST"
  | "INVALID_REQUEST"
  | "TOOL_EXECUTION_FAILURE"
  | "INTERNAL_FAILURE";

export interface AgentCustomerItem {
  id: string;
  name: string;
  company: string;
  email: string;
  avatar?: string;
  totalSpend?: string;
  ordersCount?: number;
  status: "active" | "inactive" | "lead";
  aiHealthScore?: number;
  lastActive?: string;
}

export interface AgentInvoiceItem {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientCompany: string;
  issueDate: string;
  dueDate: string;
  amount: string;
  rawAmount?: number;
  currency?: string;
  status: "paid" | "pending" | "overdue";
  paidDate?: string;
  autoRemind?: boolean;
}

export interface AgentCustomerData {
  query: string;
  totalMatches: number;
  customers: AgentCustomerItem[];
  message: string;
}

export interface AgentCustomerSummaryData {
  found: boolean;
  query: string;
  customer?: AgentCustomerItem;
  financialSummary?: {
    totalInvoicesCount: number;
    paidCount: number;
    pendingCount: number;
    overdueCount: number;
    totalBilledFormatted: string;
    totalPaidFormatted: string;
    totalPendingFormatted: string;
    totalOverdueFormatted: string;
    totalOutstandingFormatted: string;
  };
  message: string;
}

export interface AgentCustomerBalanceData {
  found: boolean;
  query: string;
  customer?: {
    id: string;
    name: string;
    company: string;
    email: string;
  };
  hasOutstanding: boolean;
  totalOutstandingFormatted: string;
  pendingAmountFormatted: string;
  overdueAmountFormatted: string;
  unpaidInvoiceCount: number;
  unpaidInvoices: AgentInvoiceItem[];
  message: string;
}

export interface AgentCustomersWithOutstandingData {
  totalCustomersWithBalance: number;
  totalOutstandingPortfolioFormatted: string;
  customers: Array<{
    id: string;
    name: string;
    company: string;
    email: string;
    outstandingAmountFormatted: string;
    overdueAmountFormatted: string;
    pendingAmountFormatted: string;
    unpaidInvoiceCount: number;
    overdueInvoiceCount: number;
  }>;
  message: string;
}

export interface AgentInvoiceSummaryData {
  found: boolean;
  query: string;
  invoice?: AgentInvoiceItem;
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

export interface AgentInvoiceData {
  query?: string;
  filters?: {
    status?: string;
    minAmount?: number;
    maxAmount?: number;
  };
  totalMatches: number;
  invoices: AgentInvoiceItem[];
  message: string;
  approvalRequest?: {
    id: string;
    title: string;
    description: string;
    actionType: string;
    customer: string;
    amount?: string;
    risk: string;
    status: string;
    executionStatus: string;
  };
}

export interface AgentStatusBreakdownItem {
  count: number;
  formattedAmount: string;
  percentageOfCount: number;
  percentageOfAmount: number;
}

export interface AgentInvoiceStatusSummaryData {
  totalInvoices: number;
  totalBilledFormatted: string;
  statusBreakdown: {
    paid: AgentStatusBreakdownItem;
    pending: AgentStatusBreakdownItem;
    overdue: AgentStatusBreakdownItem;
  };
  collectionRatePercent: number;
  message: string;
}

export interface AgentBiOutstandingData {
  totalOutstandingRaw: number;
  totalOutstandingFormatted: string;
  pendingTotalFormatted: string;
  overdueTotalFormatted: string;
  totalOutstandingInvoicesCount: number;
  pendingInvoicesCount: number;
  overdueInvoicesCount: number;
  currency: string;
  message: string;
}

export interface AgentBiOverdueData {
  totalOverdueCount: number;
  totalOverdueAmountFormatted: string;
  averageOverdueAmountFormatted: string;
  impactedClientsCount: number;
  impactedClients: string[];
  invoices: Array<{
    invoiceNumber: string;
    clientName: string;
    clientCompany: string;
    amount: string;
    dueDate: string;
  }>;
  message: string;
}

export interface AgentBiTopCustomersData {
  totalDebtPortfolioFormatted: string;
  rankedCustomers: Array<{
    rank: number;
    customerId: string;
    name: string;
    company: string;
    email: string;
    totalOutstandingFormatted: string;
    overdueAmountFormatted: string;
    pendingAmountFormatted: string;
    overdueCount: number;
    pendingCount: number;
    aiHealthScore: number;
  }>;
  message: string;
}

export interface AgentBiRevenueData {
  totalInvoicesCount: number;
  totalBilledFormatted: string;
  totalCollectedFormatted: string;
  totalOutstandingFormatted: string;
  collectionRatePercent: number;
  activeCustomersCount: number;
  message: string;
}

export interface AgentResponse {
  success: boolean;
  outcome: AgentOutcomeType;
  message: string;
  approvalRequired: boolean;
  approvalId?: string;
  toolUsed?: string;
  data?: any;
  mode?: "LLM" | "DETERMINISTIC_FALLBACK";
  provider?: string;
  model?: string;
  reasoningSummary?: string;
}

export interface AgentConversationItem {
  id: string;
  timestamp: string;
  userMessage: string;
  response?: AgentResponse;
  error?: string;
  isProcessing?: boolean;
}
