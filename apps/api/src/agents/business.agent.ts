import { toolRegistry } from "../tools/tool.registry.js";
import { approvalStore, type ApprovalRequest } from "../data/approvals.js";
import type {
  CustomerSearchResult,
  CustomerSummaryResult,
  CustomerInvoiceHistoryResult,
  CustomerOutstandingBalanceResult,
  CustomersWithOutstandingResult,
} from "../tools/customer.tool.js";
import type {
  InvoiceSearchResult,
  InvoiceSummaryResult,
  OverdueInvoicesResult,
  OutstandingInvoicesResult,
  InvoiceStatusSummaryResult,
} from "../tools/invoice.tool.js";
import type {
  BiOutstandingTotalResult,
  BiOverdueSummaryResult,
  BiTopOutstandingCustomersResult,
  BiRevenueMetricsResult,
} from "../tools/analytics.tool.js";
import type {
  ProjectSearchOutput,
  ProjectSummaryOutput,
  ProjectRiskAnalysisOutput,
  ProjectBlockersOutput,
  ClientDeliverySummaryOutput,
} from "../tools/delivery.tool.js";
import type { Customer } from "../data/customers.js";
import type { Invoice } from "../data/invoices.js";
import type { SafeUserProfile } from "../services/auth.service.js";

export type AgentOutcomeType =
  | "READ_ONLY_RESULT"
  | "APPROVAL_REQUIRED"
  | "UNSUPPORTED_REQUEST"
  | "INVALID_REQUEST"
  | "TOOL_EXECUTION_FAILURE"
  | "INTERNAL_FAILURE"
  | "CLARIFICATION"
  | "REFUSAL";

export interface AgentProcessResult {
  success: boolean;
  outcome: AgentOutcomeType;
  message: string;
  approvalRequired: boolean;
  approvalId?: string;
  toolUsed?: string;
  data?: any;
}

type AgentIntent =
  // Consequential
  | {
      type: "invoice_reminder_proposal";
      query?: string;
      status?: "all" | "paid" | "pending" | "overdue" | "unpaid";
      minAmount?: number;
      maxAmount?: number;
    }
  // Negative reminder cancellation
  | {
      type: "negative_reminder_intent";
      message: string;
    }
  // Customer
  | {
      type: "customer_search";
      query: string;
    }
  | {
      type: "customer_summary";
      query: string;
    }
  | {
      type: "customer_invoice_history";
      query: string;
      status?: "all" | "paid" | "pending" | "overdue" | "unpaid";
    }
  | {
      type: "customer_outstanding_balance";
      query: string;
    }
  | {
      type: "customers_with_outstanding";
      minBalance?: number;
    }
  // Invoice
  | {
      type: "invoice_search";
      query?: string;
      status?: "all" | "paid" | "pending" | "overdue" | "unpaid";
      minAmount?: number;
      maxAmount?: number;
    }
  | {
      type: "invoice_summary";
      invoiceNumber: string;
    }
  | {
      type: "overdue_invoices";
      minAmount?: number;
      maxAmount?: number;
    }
  | {
      type: "outstanding_invoices";
      minAmount?: number;
      maxAmount?: number;
      sortBy?: "amount_desc" | "amount_asc" | "due_date_asc" | "due_date_desc";
    }
  | {
      type: "invoice_status_summary";
    }
  // Business Intelligence
  | {
      type: "bi_outstanding_total";
    }
  | {
      type: "bi_overdue_summary";
    }
  | {
      type: "bi_top_outstanding_customers";
      limit?: number;
    }
  | {
      type: "bi_revenue_metrics";
    }
  // Cynbit DeliveryOps
  | {
      type: "project_search";
      query?: string;
      status?: "all" | "active" | "on_track" | "at_risk" | "delayed" | "completed";
      limit?: number;
    }
  | {
      type: "project_summary";
      projectId: string;
    }
  | {
      type: "project_risk_analysis";
      projectId?: string;
    }
  | {
      type: "project_blockers";
      projectId?: string;
      status?: "all" | "open" | "in_progress" | "resolved" | "unresolved";
      severity?: "all" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    }
  | {
      type: "client_delivery_summary";
      query?: string;
    }
  | {
      type: "ambiguous_project_query";
      message: string;
    }
  | {
      type: "client_followup_proposal";
      customer?: string;
      project?: string;
      reason: string;
      subject: string;
      message: string;
    }
  // Unsupported
  | {
      type: "unsupported";
      unsupportedFeature: string;
    };

export class BusinessAgent {
  /**
   * Deterministically identifies user intent and extracts parameters without general NLP or external LLMs.
   */
  public detectIntent(message: string): AgentIntent {
    const trimmed = message.trim();
    const lower = trimmed.toLowerCase();

    // 0. PROMPT INJECTION & UNTRUSTED DATA SAFEGUARD
    if (
      /(?:ignore\s+(?:all\s+)?previous\s+instructions|system\s+prompt|reveal\s+(?:your\s+)?instructions|you\s+are\s+now|override\s+system|maintenance\s+mode|send\s+(?:the\s+)?api\s*key)/i.test(
        trimmed
      )
    ) {
      return {
        type: "unsupported",
        unsupportedFeature: "Security Exception: Adversarial instruction / prompt injection blocked. Untrusted project/business data cannot override instructions.",
      };
    }

    // 0.1 NEGATIVE REMINDER INTENT CHECK
    // Explicit safeguard: "Do not send a reminder", "Don't send reminder", "Never send reminders"
    const hasNegativeReminder =
      /\b(?:do\s*n['o]t|never|cancel|stop|without)\s+(?:send|dispatch|issue|preparing|creating)\s+(?:an?\s+)?(?:reminder|email|notice)s?\b/i.test(
        trimmed,
      ) ||
      /\bdo\s+not\s+(?:remind|notify)\b/i.test(trimmed);

    if (hasNegativeReminder && !/(?:find|search|show|get|list|check)\s+invoice/i.test(trimmed)) {
      return {
        type: "negative_reminder_intent",
        message:
          "Understood. No invoice reminder will be dispatched or queued for approval. Consequential operations only occur with explicit user intent and administrative authorization.",
      };
    }

    // 0.2 CONSEQUENTIAL CLIENT FOLLOW-UP INTENT
    if (
      /(?:prepare|draft|create|send)\s+(?:a\s+)?(?:client\s+)?follow[-_\s]?up/i.test(trimmed) ||
      /(?:follow[-_\s]?up\s+(?:with|for|to)|client\s+follow[-_\s]?up)/i.test(trimmed)
    ) {
      let prj = "Falcon";
      if (/\bTitan\b|PRJ-103/i.test(trimmed)) prj = "Titan";
      else if (/\bZephyr\b|PRJ-102/i.test(trimmed)) prj = "Zephyr";
      else if (/\bApex\b|PRJ-104/i.test(trimmed)) prj = "Apex";
      else if (/\bFalcon\b|PRJ-101/i.test(trimmed)) prj = "Falcon";

      let cust = "ABC Technologies";
      const custNumMatch = trimmed.match(/(?:customer|client)\s+([1-5])\b/i);
      if (custNumMatch) cust = custNumMatch[1];
      else if (/Zenith\s*Media/i.test(trimmed)) cust = "Zenith Media";
      else if (/ABC\s*Tech/i.test(trimmed)) cust = "ABC Technologies";
      else if (/Sharma\s*Infotech/i.test(trimmed)) cust = "Sharma Infotech";
      else if (/Global\s*Logistics/i.test(trimmed)) cust = "Global Logistics";
      else if (prj === "Titan") cust = "Zenith Media";
      else if (prj === "Zephyr") cust = "Sharma Infotech";
      else if (prj === "Apex") cust = "Global Logistics";

      return {
        type: "client_followup_proposal",
        customer: cust,
        project: prj,
        reason: `Project ${prj} delivery risk escalation follow-up`,
        subject: `Follow-up: Delivery Status and Milestone Review for ${prj}`,
        message: `Dear Client,\n\nWe are following up regarding ${prj} delivery milestones, active blockers, and upcoming release timelines.\n\nBest regards,\nDelivery Operations Team`,
      };
    }

    // 1. CONSEQUENTIAL INVOICE REMINDER INTENT
    const hasPositiveReminder =
      /(?:(?:send|dispatch|issue|prepare)\s+(?:an?\s+)?(?:(?:overdue|payment|invoice)\s+)*(?:reminder|email|notice)s?)|(?:\b(?:remind|notify)\s+(?:client|customer|overdue|debtor))\b|(?:payment\s+reminder)/i.test(
        trimmed,
      );

    if (hasPositiveReminder && !hasNegativeReminder) {
      let status: "all" | "paid" | "pending" | "overdue" | "unpaid" | undefined =
        undefined;
      let minAmount: number | undefined = undefined;
      let query: string | undefined = undefined;

      // Extract invoice number: e.g. "INV-1001", "INV-2048"
      const invNumberMatch = trimmed.match(/\b(inv-\d+)\b/i);
      if (invNumberMatch && invNumberMatch[1]) {
        query = invNumberMatch[1].toUpperCase();
      }

      // Check if status is explicitly specified
      if (lower.includes("overdue")) {
        status = "overdue";
      } else if (
        lower.includes("unpaid") ||
        lower.includes("outstanding") ||
        lower.includes("pending")
      ) {
        status = "unpaid";
      } else if (!query) {
        status = "overdue"; // Default reminder target is overdue if no specific invoice was given
      }

      // Extract amount filter
      const amountMatch = trimmed.match(
        /(?:above|greater\s+than|>|more\s+than|exceeding|over)\s*(?:₹|rs\.?|inr)?\s*([0-9,]+)/i,
      );
      if (amountMatch && amountMatch[1]) {
        const parsedNum = parseFloat(amountMatch[1].replace(/,/g, ""));
        if (!isNaN(parsedNum)) {
          minAmount = parsedNum;
        }
      }

      // Extract company/client name if pattern is "for <Name/Company>"
      if (!query) {
        const clientMatch = trimmed.match(
          /(?:reminder(?:s)?\s+(?:for|to)|remind)\s+["']?([^"'?.!]+)["']?/i,
        );
        if (clientMatch && clientMatch[1]) {
          const rawClient = clientMatch[1].trim();
          if (
            !/(?:above|greater|>|overdue|unpaid|all|invoices?|emails?)/i.test(
              rawClient,
            )
          ) {
            query = rawClient;
          }
        }
      }

      return {
        type: "invoice_reminder_proposal",
        query,
        status,
        minAmount,
      };
    }

    // =============================================================
    // 1.5 CYNBIT DELIVERYOPS INTENTS
    // =============================================================
    // 1.5.1 Destructive project mutations
    if (
      /(?:delete|drop|destroy|truncate|remove)\s+(?:the\s+)?(?:delayed\s+)?(?:project|milestone|blocker|database|table)s?/i.test(
        trimmed
      )
    ) {
      return {
        type: "unsupported",
        unsupportedFeature: "Project and Database Mutation Operations (all DeliveryOps tools are strictly read-only)",
      };
    }

    // 1.5.2 Ambiguous Project Inquiry
    if (
      /^(?:tell\s+me\s+about\s+(?:the\s+)?project|show\s+(?:me\s+)?(?:the\s+)?project|what\s+is\s+(?:the\s+)?project|status\s+of\s+(?:the\s+)?project)[?.!]?$/i.test(
        trimmed
      ) ||
      /^(?:tell\s+me\s+about|show\s+me|what\s+is|inspect)\s+(?:the\s+)?projects?[?.!]?$/i.test(trimmed)
    ) {
      return {
        type: "ambiguous_project_query",
        message:
          "Could you please clarify and specify which project you would like information on (for example: Project Falcon, Project Zephyr, Project Titan, or Project Apex)?",
      };
    }

    // 1.5.3 Cross-Domain Client Delivery + Billing Summary
    if (
      /(?:delivery\s+(?:and|&|\+)\s+(?:billing|invoices?|account)|clients?\s+have\s+delivery\s+problems|delivery\s+and\s+billing\s+health|client\s+delivery\s+summary|both\s+delivery\s+risk\s+and\s+overdue)/i.test(
        trimmed
      ) ||
      (/(?:delivery|project)/i.test(trimmed) &&
        /(?:invoice|billing|overdue|debt|account|unpaid)/i.test(trimmed) &&
        /(?:client|customer)/i.test(trimmed))
    ) {
      let custId: string | undefined = undefined;
      const custNumMatch = trimmed.match(/(?:customer|client)\s+([1-5])\b/i);
      if (custNumMatch) custId = custNumMatch[1];
      else if (/Zenith\s*Media/i.test(trimmed)) custId = "Zenith Media";
      else if (/ABC\s*Tech/i.test(trimmed)) custId = "ABC Technologies";
      else if (/Sharma\s*Infotech/i.test(trimmed)) custId = "Sharma Infotech";
      else if (/Global\s*Logistics/i.test(trimmed)) custId = "Global Logistics";

      return {
        type: "client_delivery_summary",
        query: custId || "all",
      };
    }

    // 1.5.4 Project Blockers
    if (
      /(?:what\s+is\s+blocking|blockers?\s+(?:exist\s+)?(?:for|on|in)|blocking\s+["']?([A-Za-z0-9_-]+)|show\s+(?:all\s+)?blockers|list\s+blockers|active\s+blockers|projects?\s+have\s+active\s+blockers)/i.test(
        trimmed
      )
    ) {
      let prj: string | undefined = undefined;
      if (/\bFalcon\b|PRJ-101/i.test(trimmed)) prj = "Falcon";
      else if (/\bZephyr\b|PRJ-102/i.test(trimmed)) prj = "Zephyr";
      else if (/\bTitan\b|PRJ-103/i.test(trimmed)) prj = "Titan";
      else if (/\bApex\b|PRJ-104/i.test(trimmed)) prj = "Apex";

      return {
        type: "project_blockers",
        projectId: prj,
        status: "unresolved",
      };
    }

    // 1.5.5 Portfolio Highest Risk Ranking & Immediate Attention
    if (
      /(?:highest\s+risk|highest\s+delivery\s+risk|most\s+at\s+risk|which\s+projects?\s+(?:are|is)\s+(?:currently\s+)?at\s+risk|projects?\s+(?:are|is)\s+(?:currently\s+)?(?:at\s+)?(?:highest\s+)?risk|projects?\s+need\s+immediate\s+attention|immediate\s+attention|which\s+projects?\s+(?:are|is)\s+high\s+risk)/i.test(
        trimmed
      )
    ) {
      return {
        type: "project_risk_analysis",
        projectId: "all",
      };
    }

    // 1.5.6 Specific Project Risk Analysis
    if (
      /(?:why\s+is\s+.*(?:at\s+risk|delayed|risky)|is\s+.*(?:at\s+risk|delayed|risky)|risk\s+assessment|risk\s+analysis|project\s+risk)/i.test(
        trimmed
      )
    ) {
      let prj = "Falcon";
      if (/\bFalcon\b|PRJ-101/i.test(trimmed)) prj = "Falcon";
      else if (/\bZephyr\b|PRJ-102/i.test(trimmed)) prj = "Zephyr";
      else if (/\bTitan\b|PRJ-103/i.test(trimmed)) prj = "Titan";
      else if (/\bApex\b|PRJ-104/i.test(trimmed)) prj = "Apex";

      return {
        type: "project_risk_analysis",
        projectId: prj,
      };
    }

    // 1.5.7 Delivery Operations Summary
    if (
      /(?:summary\s+of\s+(?:current\s+)?delivery\s+operations|delivery\s+operations\s+summary|overview\s+of\s+delivery\s+operations)/i.test(
        trimmed
      )
    ) {
      return {
        type: "project_search",
        status: "all",
        limit: 10,
      };
    }

    // 1.5.8 Project Status / Summary
    if (
      /(?:status\s+(?:update\s+)?(?:of|for)\s+(?:project\s+)?|project\s+summary|project\s+delivery\s+summary|give\s+me\s+(?:the\s+)?(?:project\s+)?(?:delivery\s+)?summary|summary\s+of\s+(?:project\s+)?|overview\s+of\s+(?:project\s+)?|details\s+(?:for|of)\s+(?:project\s+)?|milestones?\s+(?:for|of|in|progress)|delayed\s+milestones)/i.test(
        trimmed
      ) &&
      /(?:Falcon|Zephyr|Titan|Apex|PRJ-\d+)/i.test(trimmed)
    ) {
      let prj = "Falcon";
      if (/\bFalcon\b|PRJ-101/i.test(trimmed)) prj = "Falcon";
      else if (/\bZephyr\b|PRJ-102/i.test(trimmed)) prj = "Zephyr";
      else if (/\bTitan\b|PRJ-103/i.test(trimmed)) prj = "Titan";
      else if (/\bApex\b|PRJ-104/i.test(trimmed)) prj = "Apex";

      return {
        type: "project_summary",
        projectId: prj,
      };
    }

    // 1.5.9 Project Search
    if (
      /(?:(?:find|search|show|list|get)\s+(?:all\s+)?(?:[a-z_-\s]+\s+)?projects?|projects?\s+using\s+|projects?\s+led\s+by|which\s+projects?\s+(?:are|is)\s+at\s+risk|projects?\s+with\s+lead)/i.test(
        trimmed
      )
    ) {
      let queryTerm: string | undefined = undefined;
      let statusFilter: any = undefined;

      if (/which\s+projects?\s+(?:are|is)\s+at\s+risk|at_risk|at\s+risk/i.test(trimmed)) statusFilter = "at_risk";
      else if (/delayed/i.test(trimmed)) statusFilter = "delayed";
      else if (/on_track|on\s+track/i.test(trimmed)) statusFilter = "on_track";

      const termMatch = trimmed.match(/(?:using|with|stack|lead|by|named|for)\s+["']?([^"'?.!]+)["']?/i);
      if (termMatch && termMatch[1]) {
        queryTerm = termMatch[1].trim();
      }

      return {
        type: "project_search",
        query: queryTerm,
        status: statusFilter,
      };
    }

    // 2. BUSINESS INTELLIGENCE INTENTS
    // 2.1 Total Outstanding Debt / AR Portfolio
    if (
      /(?:how\s+much\s+(?:money\s+)?is\s+outstanding|total\s+outstanding(?:\s+balance|\s+debt|\s+revenue|\s+total)?|outstanding\s+total|total\s+unpaid\s+balance|what\s+is\s+(?:the\s+)?outstanding\s+(?:amount|balance|total|debt)|how\s+much\s+money\s+is\s+owed)/i.test(
        trimmed,
      )
    ) {
      return { type: "bi_outstanding_total" };
    }

    // 2.2 Overdue Summary Intelligence
    if (
      /(?:overdue\s+summary|overdue\s+intelligence|overdue\s+breakdown|summary\s+of\s+overdue|how\s+much\s+(?:money\s+)?is\s+overdue|what\s+is\s+overdue|overdue\s+report|overdue\s+debt\s+summary)/i.test(
        trimmed,
      )
    ) {
      return { type: "bi_overdue_summary" };
    }

    // 2.3 Top Outstanding Customers / Debtors
    if (
      /(?:top\s+outstanding\s+customers?|highest\s+outstanding\s+balances?|highest\s+debt\s+customers?|top\s+debtors?|customers?\s+with\s+(?:the\s+)?highest\s+(?:outstanding|unpaid|debt)|who\s+owes\s+(?:the\s+)?most(?:\s+money)?|which\s+customer\s+owes\s+(?:the\s+)?most(?:\s+money)?|top\s+unpaid\s+clients?)/i.test(
        trimmed,
      )
    ) {
      return { type: "bi_top_outstanding_customers", limit: 5 };
    }

    // 2.4 Revenue & Collections Metrics
    if (
      /(?:revenue\s+metrics|collection\s+rate|financial\s+performance|collections?\s+performance|overall\s+billing\s+status|financial\s+health\s+metrics|total\s+collected|total\s+revenue)/i.test(
        trimmed,
      )
    ) {
      return { type: "bi_revenue_metrics" };
    }

    // 2.5 Customers With Outstanding Invoices
    if (
      /(?:customers?\s+with\s+outstanding\s+invoices?|customers?\s+with\s+unpaid\s+invoices?|who\s+has\s+outstanding\s+invoices?|who\s+owes\s+money|list\s+customers?\s+with\s+(?:unpaid|outstanding))/i.test(
        trimmed,
      )
    ) {
      return { type: "customers_with_outstanding" };
    }

    // 2.6 Invoice Status Breakdown / Summary
    if (
      /(?:invoice\s+status\s+summary|status\s+summary\s+of\s+invoices?|invoice\s+counts?\s+by\s+status|how\s+many\s+invoices\s+are\s+paid|breakdown\s+of\s+invoices?\s+by\s+status|status\s+breakdown\s+of\s+invoices?|give\s+me\s+an\s+invoice\s+status\s+summary)/i.test(
        trimmed,
      )
    ) {
      return { type: "invoice_status_summary" };
    }

    // 3. ADVANCED CUSTOMER INTENTS
    // 3.1 Customer Outstanding Balance: e.g. "Outstanding balance for ABC Technologies", "How much does Ananya Iyer owe?"
    const custBalanceMatch = trimmed.match(
      /(?:(?:outstanding|unpaid)\s+balance\s+(?:for|of)|how\s+much\s+does\s+["']?([^"'?.!]+)["']?\s+owe|balance\s+owed\s+by\s+["']?([^"'?.!]+)["']?)\s*["']?([^"'?.!]+)?["']?/i,
    );
    if (custBalanceMatch) {
      const candidate = (
        custBalanceMatch[1] ||
        custBalanceMatch[2] ||
        custBalanceMatch[3] ||
        ""
      ).trim();
      if (candidate && !/(?:all|total|portfolio|everyone)/i.test(candidate)) {
        return {
          type: "customer_outstanding_balance",
          query: candidate,
        };
      }
    }

    // 3.2 Customer Invoice History: e.g. "Invoice history for ABC Technologies", "Invoices belonging to Rahul Sharma"
    const custHistoryMatch = trimmed.match(
      /(?:invoice\s+history\s+(?:for|of)|past\s+invoices\s+(?:for|of)|past\s+invoices\s+of|invoices\s+(?:for|of|belonging\s+to)|invoices\s+under\s+customer)\s+["']?([^"'?.!]+)["']?/i,
    );
    if (custHistoryMatch && custHistoryMatch[1]?.trim()) {
      const candidate = custHistoryMatch[1].trim();
      if (!/(?:above|greater|>|overdue|unpaid|all|recent)/i.test(candidate)) {
        return {
          type: "customer_invoice_history",
          query: candidate,
        };
      }
    }

    // 3.3 Customer Summary: e.g. "Customer summary for ABC Technologies", "Summarize customer Rahul"
    const custSummaryMatch = trimmed.match(
      /(?:customer\s+summary\s+(?:for|of)|summarize\s+customer|overview\s+(?:for|of)\s+customer|profile\s+(?:for|of)\s+customer)\s+["']?([^"'?.!]+)["']?/i,
    );
    if (custSummaryMatch && custSummaryMatch[1]?.trim()) {
      return {
        type: "customer_summary",
        query: custSummaryMatch[1].trim(),
      };
    }

    // 3.4 Account Status Check (preserves Phase 6.1 baseline customer-search lookup)
    const statusPattern =
      /(?:check(?:\s+the)?\s+(?:current\s+)?(?:account|customer)\s+status\s+(?:of|for)|what\s+is\s+(?:the\s+)?(?:account|customer)\s+status\s+(?:of|for)|account\s+status\s+(?:of|for)|check\s+status\s+(?:of|for))\s+["']?([^"'?.!]+)["']?/i;
    const statusMatch = trimmed.match(statusPattern);
    if (statusMatch && statusMatch[1]?.trim()) {
      return {
        type: "customer_search",
        query: statusMatch[1].trim(),
      };
    }

    // 3.5 General Customer Search (e.g. "Find customer ABC Technologies", "Search customer Rahul")
    const customerSearchPattern =
      /(?:find|search(?:\s+for)?|lookup|get)\s+(?:all\s+)?(?:customers?|clients?)(?:\s+details|\s+info|\s+record|\s+profile)?\s+(?:named\s+|for\s+|with\s+(?:name\s+)?|matching\s+|called\s+)?["']?([^"'?.!]+)["']?/i;
    const searchMatch = trimmed.match(customerSearchPattern);
    if (searchMatch && searchMatch[1]?.trim()) {
      return {
        type: "customer_search",
        query: searchMatch[1].trim(),
      };
    }

    // 4. ADVANCED INVOICE INTENTS
    // 4.1 Single Invoice Summary (e.g. "Invoice summary for INV-1001", "Details of invoice INV-2048", "Summarize invoice INV-1001")
    const invSummaryMatch = trimmed.match(
      /(?:invoice\s+summary\s+(?:for|of)?\s*|summarize\s+invoice\s*|details\s+of\s+invoice\s*|inspect\s+invoice\s*|status\s+of\s+invoice\s*)\s*(?:#\s*)?(inv-\d+)/i,
    );
    if (invSummaryMatch && invSummaryMatch[1]) {
      return {
        type: "invoice_summary",
        invoiceNumber: invSummaryMatch[1].toUpperCase(),
      };
    }

    // 4.2 Overdue Invoices Tool: "Which invoices are overdue?", "Show overdue invoices"
    if (
      /(?:which\s+invoices\s+are\s+overdue|show\s+overdue\s+invoices?|list\s+overdue\s+invoices?|find\s+overdue\s+invoices?)/i.test(
        trimmed,
      ) &&
      !/(?:above|greater|>|send|remind)/i.test(trimmed)
    ) {
      return { type: "overdue_invoices" };
    }

    // 4.3 General Invoice Search (Preserves Phase 6.1 baseline behavior for "Show unpaid invoices", "Find invoice INV-1001", amount queries)
    const isInvoiceRelated =
      /(?:invoice|invoices|unpaid|overdue|\binv-\d+|\bbill\b|\bbills\b)/i.test(
        trimmed,
      );

    if (isInvoiceRelated) {
      let status: "all" | "paid" | "pending" | "overdue" | "unpaid" | undefined =
        undefined;
      let minAmount: number | undefined = undefined;
      let query: string | undefined = undefined;

      if (lower.includes("overdue")) {
        status = "overdue";
      } else if (
        lower.includes("unpaid") ||
        lower.includes("outstanding") ||
        lower.includes("pending")
      ) {
        status = "unpaid";
      } else if (lower.includes("paid") && !lower.includes("unpaid")) {
        status = "paid";
      }

      const amountMatch = trimmed.match(
        /(?:above|greater\s+than|>|more\s+than|exceeding|over)\s*(?:₹|rs\.?|inr)?\s*([0-9,]+)/i,
      );
      if (amountMatch && amountMatch[1]) {
        const parsedNum = parseFloat(amountMatch[1].replace(/,/g, ""));
        if (!isNaN(parsedNum)) {
          minAmount = parsedNum;
        }
      }

      const invNumberMatch = trimmed.match(/\b(inv-\d+)\b/i);
      if (invNumberMatch && invNumberMatch[1]) {
        query = invNumberMatch[1].toUpperCase();
      }

      if (!query) {
        const clientMatch = trimmed.match(
          /(?:invoices?\s+(?:for|of|from|belonging\s+to)|invoices?\s+under)\s+["']?([^"'?.!]+)["']?/i,
        );
        if (clientMatch && clientMatch[1]) {
          const rawClient = clientMatch[1].trim();
          if (!/(?:above|greater|>|overdue|unpaid)/i.test(rawClient)) {
            query = rawClient;
          }
        }
      }

      if (!query && !status && minAmount === undefined) {
        const searchInvMatch = trimmed.match(
          /(?:search(?:\s+for)?|find|lookup|get|show)\s+(?:all\s+)?invoices?\s*(?:#\s*|for\s+|with\s+)?["']?([^"'?.!]+)["']?/i,
        );
        if (searchInvMatch && searchInvMatch[1]) {
          const candidate = searchInvMatch[1].trim();
          if (
            candidate &&
            !/(?:above|greater|>|overdue|unpaid|all|recent)/i.test(candidate)
          ) {
            query = candidate;
          }
        }
      }

      return {
        type: "invoice_search",
        query,
        status,
        minAmount,
      };
    }

    // 5. Fallback General Customer Search: e.g. "Find Acme", "who is Ananya"
    const generalSearchPattern =
      /^(?:find|search(?:\s+for)?|lookup|who\s+is)\s+["']?([^"'?.!]+)["']?$/i;
    const generalMatch = trimmed.match(generalSearchPattern);
    if (generalMatch && generalMatch[1]?.trim()) {
      const candidate = generalMatch[1].trim();
      if (
        !candidate.toLowerCase().includes("invoice") &&
        !candidate.toLowerCase().includes("report") &&
        !candidate.toLowerCase().includes("order") &&
        !candidate.toLowerCase().includes("balance")
      ) {
        return {
          type: "customer_search",
          query: candidate,
        };
      }
    }

    // 6. CATEGORIZE UNSUPPORTED BUSINESS REQUESTS
    if (/(?:order|orders|cancel\s+order|shipment|tracking)/i.test(trimmed)) {
      return {
        type: "unsupported",
        unsupportedFeature: "Order Management & Shipment Tracking",
      };
    }

    if (/(?:payment\s+gateway|stripe|razorpay|bank\s+transfer|wire)/i.test(trimmed)) {
      return {
        type: "unsupported",
        unsupportedFeature: "Direct Banking & Payment Gateway Execution",
      };
    }

    if (/(?:payroll|salary|employee|hr)/i.test(trimmed)) {
      return {
        type: "unsupported",
        unsupportedFeature: "Payroll & Human Resources Management",
      };
    }

    return {
      type: "unsupported",
      unsupportedFeature: "General Task Automation",
    };
  }

  /**
   * Main agent execution pipeline.
   */
  public async execute(
    message: string,
    user?: SafeUserProfile,
  ): Promise<AgentProcessResult> {
    const intent = this.detectIntent(message);

    // -------------------------------------------------------------
    // Negative Reminder Acknowledgment
    // -------------------------------------------------------------
    if (intent.type === "negative_reminder_intent") {
      return {
        success: true,
        outcome: "READ_ONLY_RESULT",
        message: intent.message,
        approvalRequired: false,
      };
    }

    // -------------------------------------------------------------
    // Ambiguous Project Query Clarification
    // -------------------------------------------------------------
    if (intent.type === "ambiguous_project_query") {
      return {
        success: true,
        outcome: "READ_ONLY_RESULT",
        message: intent.message,
        approvalRequired: false,
      };
    }

    // -------------------------------------------------------------
    // Consequential DeliveryOps Client Follow-up Proposal
    // -------------------------------------------------------------
    if (intent.type === "client_followup_proposal") {
      const execResult = await toolRegistry.executeTool(
        "prepare-client-followup",
        {
          customer: intent.customer,
          project: intent.project,
          reason: intent.reason,
          subject: intent.subject,
          message: intent.message,
        },
        { user, source: "AI_AGENT" }
      );

      if (!execResult.success || !execResult.data) {
        return {
          success: false,
          outcome: "TOOL_EXECUTION_FAILURE",
          message: execResult.error || "Failed to prepare client follow-up proposal.",
          approvalRequired: false,
          toolUsed: "prepare-client-followup",
        };
      }

      return {
        success: true,
        outcome: "APPROVAL_REQUIRED",
        message: execResult.data.message,
        approvalRequired: true,
        approvalId: execResult.data.approvalId,
        toolUsed: "prepare-client-followup",
        data: execResult.data,
      };
    }

    // -------------------------------------------------------------
    // 1. Consequential Invoice Reminder Proposal
    // -------------------------------------------------------------
    if (intent.type === "invoice_reminder_proposal") {
      const executionResult = await toolRegistry.executeTool<
        {
          query?: string;
          status?: "all" | "paid" | "pending" | "overdue" | "unpaid";
          minAmount?: number;
          maxAmount?: number;
        },
        InvoiceSearchResult
      >("invoice-search", {
        query: intent.query,
        status: intent.status,
        minAmount: intent.minAmount,
        maxAmount: intent.maxAmount,
      });

      if (!executionResult.success || !executionResult.data) {
        return {
          success: false,
          outcome: "TOOL_EXECUTION_FAILURE",
          message: `Failed to search invoices for reminder: ${executionResult.error || "Unknown tool execution error."}`,
          approvalRequired: false,
          toolUsed: "invoice-search",
        };
      }

      const matchingInvoices = executionResult.data.invoices;

      if (matchingInvoices.length === 0) {
        return {
          success: true,
          outcome: "READ_ONLY_RESULT",
          message: `No overdue invoices matching the criteria were found. No reminder proposal was created.`,
          approvalRequired: false,
          toolUsed: "invoice-search",
          data: executionResult.data,
        };
      }

      // Calculate total amount safely
      const totalAmountRaw = matchingInvoices.reduce(
        (sum, inv) => sum + inv.rawAmount,
        0,
      );
      const totalAmountFormatted = `₹${totalAmountRaw.toLocaleString("en-IN")}`;

      // Create an approval request proposal (strictly pending execution)
      const createdApproval = await approvalStore.create({
        title: `Send overdue invoice reminder${matchingInvoices.length > 1 ? "s" : ""}`,
        description: `Dispatch email reminders for ${matchingInvoices.map((i) => i.invoiceNumber).join(", ")}`,
        actionType: "SEND_INVOICE_REMINDER",
        toolName: "send-email",
        arguments: {
          template: "overdue_invoice_reminder",
          invoices: matchingInvoices.map((inv) => ({
            invoiceNumber: inv.invoiceNumber,
            clientName: inv.clientName,
            clientCompany: inv.clientCompany,
            amount: inv.amount,
            dueDate: inv.dueDate,
          })),
        },
        reason: `User requested reminders for ${matchingInvoices.length} overdue invoice(s) totalling ${totalAmountFormatted}. Sending external emails requires human approval.`,
        customer:
          matchingInvoices.length === 1
            ? `${matchingInvoices[0].clientName} (${matchingInvoices[0].clientCompany})`
            : `${matchingInvoices.length} Clients (${matchingInvoices.map((i) => i.clientCompany).join(", ")})`,
        amount: totalAmountFormatted,
        risk: "MEDIUM",
        relatedInvoiceId:
          matchingInvoices.length === 1
            ? matchingInvoices[0].invoiceNumber
            : undefined,
        requestedBy: user
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
            }
          : undefined,
      });

      const messageHeader =
        `Found ${matchingInvoices.length} overdue invoice(s) totalling ${totalAmountFormatted}:\n\n` +
        matchingInvoices
          .map(
            (inv, idx) =>
              `${idx + 1}. **${inv.invoiceNumber}** — ${inv.clientName} (${inv.clientCompany}) | ${inv.amount} | Due: ${inv.dueDate}`,
          )
          .join("\n\n") +
        `\n\n⚠️ **Human Approval Required (Action: Send Overdue Reminder)**:\n` +
        `Sending external emails is a protected action. Approval request **${createdApproval.id}** has been prepared and queued.\n` +
        `Please review and authorize this action in the Approval Center before any reminder is dispatched.`;

      return {
        success: true,
        outcome: "APPROVAL_REQUIRED",
        message: messageHeader,
        approvalRequired: true,
        approvalId: createdApproval.id,
        toolUsed: "invoice-search",
        data: {
          ...executionResult.data,
          approvalRequest: createdApproval,
        },
      };
    }

    // -------------------------------------------------------------
    // 2. Business Intelligence: Total Outstanding Debt
    // -------------------------------------------------------------
    if (intent.type === "bi_outstanding_total") {
      const res = await toolRegistry.executeTool<
        {},
        BiOutstandingTotalResult
      >("bi-outstanding-total", {});

      if (!res.success || !res.data) {
        return {
          success: false,
          outcome: "TOOL_EXECUTION_FAILURE",
          message: `Failed to calculate outstanding total: ${res.error || "Unknown error."}`,
          approvalRequired: false,
          toolUsed: "bi-outstanding-total",
        };
      }

      return {
        success: true,
        outcome: "READ_ONLY_RESULT",
        message: res.data.message,
        approvalRequired: false,
        toolUsed: "bi-outstanding-total",
        data: res.data,
      };
    }

    // -------------------------------------------------------------
    // 3. Business Intelligence: Overdue Invoices Summary
    // -------------------------------------------------------------
    if (intent.type === "bi_overdue_summary") {
      const res = await toolRegistry.executeTool<
        {},
        BiOverdueSummaryResult
      >("bi-overdue-summary", {});

      if (!res.success || !res.data) {
        return {
          success: false,
          outcome: "TOOL_EXECUTION_FAILURE",
          message: `Failed to retrieve overdue summary: ${res.error || "Unknown error."}`,
          approvalRequired: false,
          toolUsed: "bi-overdue-summary",
        };
      }

      return {
        success: true,
        outcome: "READ_ONLY_RESULT",
        message: res.data.message,
        approvalRequired: false,
        toolUsed: "bi-overdue-summary",
        data: res.data,
      };
    }

    // -------------------------------------------------------------
    // 4. Business Intelligence: Top Outstanding Customers
    // -------------------------------------------------------------
    if (intent.type === "bi_top_outstanding_customers") {
      const res = await toolRegistry.executeTool<
        { limit?: number },
        BiTopOutstandingCustomersResult
      >("bi-top-outstanding-customers", { limit: intent.limit });

      if (!res.success || !res.data) {
        return {
          success: false,
          outcome: "TOOL_EXECUTION_FAILURE",
          message: `Failed to rank top debtors: ${res.error || "Unknown error."}`,
          approvalRequired: false,
          toolUsed: "bi-top-outstanding-customers",
        };
      }

      return {
        success: true,
        outcome: "READ_ONLY_RESULT",
        message: res.data.message,
        approvalRequired: false,
        toolUsed: "bi-top-outstanding-customers",
        data: res.data,
      };
    }

    // -------------------------------------------------------------
    // 5. Business Intelligence: Revenue Metrics
    // -------------------------------------------------------------
    if (intent.type === "bi_revenue_metrics") {
      const res = await toolRegistry.executeTool<
        {},
        BiRevenueMetricsResult
      >("bi-revenue-metrics", {});

      if (!res.success || !res.data) {
        return {
          success: false,
          outcome: "TOOL_EXECUTION_FAILURE",
          message: `Failed to retrieve revenue metrics: ${res.error || "Unknown error."}`,
          approvalRequired: false,
          toolUsed: "bi-revenue-metrics",
        };
      }

      return {
        success: true,
        outcome: "READ_ONLY_RESULT",
        message: res.data.message,
        approvalRequired: false,
        toolUsed: "bi-revenue-metrics",
        data: res.data,
      };
    }

    // -------------------------------------------------------------
    // 6. Customer: Customers With Outstanding Invoices
    // -------------------------------------------------------------
    if (intent.type === "customers_with_outstanding") {
      const res = await toolRegistry.executeTool<
        { minBalance?: number },
        CustomersWithOutstandingResult
      >("customers-with-outstanding", { minBalance: intent.minBalance });

      if (!res.success || !res.data) {
        return {
          success: false,
          outcome: "TOOL_EXECUTION_FAILURE",
          message: `Failed to find customers with outstanding invoices: ${res.error || "Unknown error."}`,
          approvalRequired: false,
          toolUsed: "customers-with-outstanding",
        };
      }

      return {
        success: true,
        outcome: "READ_ONLY_RESULT",
        message: res.data.message,
        approvalRequired: false,
        toolUsed: "customers-with-outstanding",
        data: res.data,
      };
    }

    // -------------------------------------------------------------
    // 7. Customer: Customer Outstanding Balance
    // -------------------------------------------------------------
    if (intent.type === "customer_outstanding_balance") {
      const res = await toolRegistry.executeTool<
        { query: string },
        CustomerOutstandingBalanceResult
      >("customer-outstanding-balance", { query: intent.query });

      if (!res.success || !res.data) {
        return {
          success: false,
          outcome: "TOOL_EXECUTION_FAILURE",
          message: `Failed to check customer outstanding balance: ${res.error || "Unknown error."}`,
          approvalRequired: false,
          toolUsed: "customer-outstanding-balance",
        };
      }

      return {
        success: true,
        outcome: "READ_ONLY_RESULT",
        message: res.data.message,
        approvalRequired: false,
        toolUsed: "customer-outstanding-balance",
        data: res.data,
      };
    }

    // -------------------------------------------------------------
    // 8. Customer: Invoice History
    // -------------------------------------------------------------
    if (intent.type === "customer_invoice_history") {
      const res = await toolRegistry.executeTool<
        { query: string; status?: any },
        CustomerInvoiceHistoryResult
      >("customer-invoice-history", {
        query: intent.query,
        status: intent.status,
      });

      if (!res.success || !res.data) {
        return {
          success: false,
          outcome: "TOOL_EXECUTION_FAILURE",
          message: `Failed to retrieve customer invoice history: ${res.error || "Unknown error."}`,
          approvalRequired: false,
          toolUsed: "customer-invoice-history",
        };
      }

      return {
        success: true,
        outcome: "READ_ONLY_RESULT",
        message: res.data.message,
        approvalRequired: false,
        toolUsed: "customer-invoice-history",
        data: res.data,
      };
    }

    // -------------------------------------------------------------
    // 9. Customer: Customer Summary
    // -------------------------------------------------------------
    if (intent.type === "customer_summary") {
      const res = await toolRegistry.executeTool<
        { query: string },
        CustomerSummaryResult
      >("customer-summary", { query: intent.query });

      if (!res.success || !res.data) {
        return {
          success: false,
          outcome: "TOOL_EXECUTION_FAILURE",
          message: `Failed to retrieve customer summary: ${res.error || "Unknown error."}`,
          approvalRequired: false,
          toolUsed: "customer-summary",
        };
      }

      return {
        success: true,
        outcome: "READ_ONLY_RESULT",
        message: res.data.message,
        approvalRequired: false,
        toolUsed: "customer-summary",
        data: res.data,
      };
    }

    // -------------------------------------------------------------
    // 10. Customer: General Customer Search (Baseline Compatible)
    // -------------------------------------------------------------
    if (intent.type === "customer_search") {
      const res = await toolRegistry.executeTool<
        { query: string },
        CustomerSearchResult
      >("customer-search", { query: intent.query });

      if (!res.success || !res.data) {
        return {
          success: false,
          outcome: "TOOL_EXECUTION_FAILURE",
          message: `Failed to search customer records: ${res.error || "Unknown error."}`,
          approvalRequired: false,
          toolUsed: "customer-search",
        };
      }

      const formatted = this.formatCustomerResults(
        intent.query,
        res.data.customers,
      );

      return {
        success: true,
        outcome: "READ_ONLY_RESULT",
        message: formatted,
        approvalRequired: false,
        toolUsed: "customer-search",
        data: res.data,
      };
    }

    // -------------------------------------------------------------
    // 11. Invoice: Single Invoice Summary
    // -------------------------------------------------------------
    if (intent.type === "invoice_summary") {
      const res = await toolRegistry.executeTool<
        { invoiceNumber: string },
        InvoiceSummaryResult
      >("invoice-summary", { invoiceNumber: intent.invoiceNumber });

      if (!res.success || !res.data) {
        return {
          success: false,
          outcome: "TOOL_EXECUTION_FAILURE",
          message: `Failed to retrieve invoice summary: ${res.error || "Unknown error."}`,
          approvalRequired: false,
          toolUsed: "invoice-summary",
        };
      }

      return {
        success: true,
        outcome: "READ_ONLY_RESULT",
        message: res.data.message,
        approvalRequired: false,
        toolUsed: "invoice-summary",
        data: res.data,
      };
    }

    // -------------------------------------------------------------
    // 12. Invoice: Overdue Invoices List
    // -------------------------------------------------------------
    if (intent.type === "overdue_invoices") {
      const res = await toolRegistry.executeTool<
        { minAmount?: number; maxAmount?: number },
        OverdueInvoicesResult
      >("overdue-invoices", {
        minAmount: intent.minAmount,
        maxAmount: intent.maxAmount,
      });

      if (!res.success || !res.data) {
        return {
          success: false,
          outcome: "TOOL_EXECUTION_FAILURE",
          message: `Failed to search overdue invoices: ${res.error || "Unknown error."}`,
          approvalRequired: false,
          toolUsed: "overdue-invoices",
        };
      }

      return {
        success: true,
        outcome: "READ_ONLY_RESULT",
        message: res.data.message,
        approvalRequired: false,
        toolUsed: "overdue-invoices",
        data: res.data,
      };
    }

    // -------------------------------------------------------------
    // 13. Invoice: Outstanding Invoices List
    // -------------------------------------------------------------
    if (intent.type === "outstanding_invoices") {
      const res = await toolRegistry.executeTool<
        { minAmount?: number; maxAmount?: number; sortBy?: any },
        OutstandingInvoicesResult
      >("outstanding-invoices", {
        minAmount: intent.minAmount,
        maxAmount: intent.maxAmount,
        sortBy: intent.sortBy,
      });

      if (!res.success || !res.data) {
        return {
          success: false,
          outcome: "TOOL_EXECUTION_FAILURE",
          message: `Failed to retrieve outstanding invoices: ${res.error || "Unknown error."}`,
          approvalRequired: false,
          toolUsed: "outstanding-invoices",
        };
      }

      return {
        success: true,
        outcome: "READ_ONLY_RESULT",
        message: res.data.message,
        approvalRequired: false,
        toolUsed: "outstanding-invoices",
        data: res.data,
      };
    }

    // -------------------------------------------------------------
    // 14. Invoice: Status Breakdown / Summary
    // -------------------------------------------------------------
    if (intent.type === "invoice_status_summary") {
      const res = await toolRegistry.executeTool<
        {},
        InvoiceStatusSummaryResult
      >("invoice-status-summary", {});

      if (!res.success || !res.data) {
        return {
          success: false,
          outcome: "TOOL_EXECUTION_FAILURE",
          message: `Failed to calculate invoice status summary: ${res.error || "Unknown error."}`,
          approvalRequired: false,
          toolUsed: "invoice-status-summary",
        };
      }

      return {
        success: true,
        outcome: "READ_ONLY_RESULT",
        message: res.data.message,
        approvalRequired: false,
        toolUsed: "invoice-status-summary",
        data: res.data,
      };
    }

    // -------------------------------------------------------------
    // 15. Invoice: General Invoice Search (Baseline Compatible)
    // -------------------------------------------------------------
    if (intent.type === "invoice_search") {
      const res = await toolRegistry.executeTool<
        {
          query?: string;
          status?: "all" | "paid" | "pending" | "overdue" | "unpaid";
          minAmount?: number;
          maxAmount?: number;
        },
        InvoiceSearchResult
      >("invoice-search", {
        query: intent.query,
        status: intent.status,
        minAmount: intent.minAmount,
        maxAmount: intent.maxAmount,
      });

      if (!res.success || !res.data) {
        return {
          success: false,
          outcome: "TOOL_EXECUTION_FAILURE",
          message: `Failed to search invoices: ${res.error || "Unknown error."}`,
          approvalRequired: false,
          toolUsed: "invoice-search",
        };
      }

      const formatted = this.formatInvoiceResults(res.data);

      return {
        success: true,
        outcome: "READ_ONLY_RESULT",
        message: formatted,
        approvalRequired: false,
        toolUsed: "invoice-search",
        data: res.data,
      };
    }

    // -------------------------------------------------------------
    // 15.1 DeliveryOps: Project Search
    // -------------------------------------------------------------
    if (intent.type === "project_search") {
      const res = await toolRegistry.executeTool<
        { query?: string; status?: string; limit?: number },
        ProjectSearchOutput
      >("project-search", {
        query: intent.query,
        status: intent.status,
        limit: intent.limit,
      });

      if (!res.success || !res.data) {
        return {
          success: false,
          outcome: "TOOL_EXECUTION_FAILURE",
          message: `Failed to search delivery projects: ${res.error || "Unknown error."}`,
          approvalRequired: false,
          toolUsed: "project-search",
        };
      }

      return {
        success: true,
        outcome: "READ_ONLY_RESULT",
        message: res.data.message,
        approvalRequired: false,
        toolUsed: "project-search",
        data: res.data,
      };
    }

    // -------------------------------------------------------------
    // 15.2 DeliveryOps: Project Summary
    // -------------------------------------------------------------
    if (intent.type === "project_summary") {
      const res = await toolRegistry.executeTool<
        { projectId: string },
        ProjectSummaryOutput
      >("project-summary", {
        projectId: intent.projectId,
      });

      if (!res.success || !res.data) {
        return {
          success: false,
          outcome: "TOOL_EXECUTION_FAILURE",
          message: `Failed to retrieve project summary: ${res.error || "Unknown error."}`,
          approvalRequired: false,
          toolUsed: "project-summary",
        };
      }

      return {
        success: true,
        outcome: "READ_ONLY_RESULT",
        message: res.data.message,
        approvalRequired: false,
        toolUsed: "project-summary",
        data: res.data,
      };
    }

    // -------------------------------------------------------------
    // 15.3 DeliveryOps: Project Risk Analysis
    // -------------------------------------------------------------
    if (intent.type === "project_risk_analysis") {
      const res = await toolRegistry.executeTool<
        { projectId?: string },
        ProjectRiskAnalysisOutput
      >("project-risk-analysis", {
        projectId: intent.projectId,
      });

      if (!res.success || !res.data) {
        return {
          success: false,
          outcome: "TOOL_EXECUTION_FAILURE",
          message: `Failed to analyze project risk: ${res.error || "Unknown error."}`,
          approvalRequired: false,
          toolUsed: "project-risk-analysis",
        };
      }

      return {
        success: true,
        outcome: "READ_ONLY_RESULT",
        message: res.data.message,
        approvalRequired: false,
        toolUsed: "project-risk-analysis",
        data: res.data,
      };
    }

    // -------------------------------------------------------------
    // 15.4 DeliveryOps: Project Blockers
    // -------------------------------------------------------------
    if (intent.type === "project_blockers") {
      const res = await toolRegistry.executeTool<
        { projectId?: string; status?: any; severity?: any },
        ProjectBlockersOutput
      >("project-blockers", {
        projectId: intent.projectId,
        status: intent.status,
        severity: intent.severity,
      });

      if (!res.success || !res.data) {
        return {
          success: false,
          outcome: "TOOL_EXECUTION_FAILURE",
          message: `Failed to retrieve project blockers: ${res.error || "Unknown error."}`,
          approvalRequired: false,
          toolUsed: "project-blockers",
        };
      }

      return {
        success: true,
        outcome: "READ_ONLY_RESULT",
        message: res.data.message,
        approvalRequired: false,
        toolUsed: "project-blockers",
        data: res.data,
      };
    }

    // -------------------------------------------------------------
    // 15.5 DeliveryOps: Client Cross-Domain Delivery Summary
    // -------------------------------------------------------------
    if (intent.type === "client_delivery_summary") {
      const res = await toolRegistry.executeTool<
        { query?: string },
        ClientDeliverySummaryOutput
      >("client-delivery-summary", {
        query: intent.query,
      });

      if (!res.success || !res.data) {
        return {
          success: false,
          outcome: "TOOL_EXECUTION_FAILURE",
          message: `Failed to retrieve client cross-domain delivery summary: ${res.error || "Unknown error."}`,
          approvalRequired: false,
          toolUsed: "client-delivery-summary",
        };
      }

      return {
        success: true,
        outcome: "READ_ONLY_RESULT",
        message: res.data.message,
        approvalRequired: false,
        toolUsed: "client-delivery-summary",
        data: res.data,
      };
    }

    // -------------------------------------------------------------
    // 16. Unsupported Business Requests
    // -------------------------------------------------------------
    const feature =
      intent.type === "unsupported"
        ? intent.unsupportedFeature
        : "The requested business operation";

    return {
      success: true,
      outcome: "UNSUPPORTED_REQUEST",
      message:
        `The requested operation (${feature}) is not supported in BizOps AI.\n\n` +
        `Supported Operations Guide:\n` +
        `• Customer Operations:\n` +
        `  - Customer search (e.g. "Find customer ABC Technologies")\n` +
        `  - Customer summary (e.g. "Customer summary for Ananya Iyer")\n` +
        `  - Customer invoice history (e.g. "Invoice history for Rahul Sharma")\n` +
        `  - Customer outstanding balance (e.g. "Outstanding balance for Pooja Verma")\n` +
        `  - Customers with outstanding debt (e.g. "Show customers with outstanding invoices")\n\n` +
        `• Invoice Operations:\n` +
        `  - Search invoices (e.g. "Find invoice INV-1001", "Show unpaid invoices")\n` +
        `  - Invoice summary (e.g. "Invoice summary for INV-2048")\n` +
        `  - Overdue invoice search (e.g. "Which invoices are overdue?")\n` +
        `  - Invoice portfolio status summary (e.g. "Invoice status summary")\n\n` +
        `• Business Intelligence:\n` +
        `  - Total outstanding debt (e.g. "How much money is outstanding?")\n` +
        `  - Overdue intelligence summary (e.g. "Overdue summary")\n` +
        `  - Top outstanding debtors (e.g. "Which customers have the highest outstanding balances?")\n` +
        `  - Revenue collection performance (e.g. "Show revenue metrics")\n\n` +
        `• Consequential Proposals (Human Approval Required):\n` +
        `  - Overdue reminder dispatch (e.g. "Send reminder for invoice INV-1001", "Prepare reminder emails for overdue invoices above ₹50,000")`,
      approvalRequired: false,
    };
  }

  /**
   * Helper formatting for customer search results.
   */
  private formatCustomerResults(
    query: string,
    customers: Customer[],
  ): string {
    if (customers.length === 0) {
      return `No customer records found matching "${query}".\n\nPlease check the spelling or search by customer name, company name, email address, or customer ID.`;
    }

    if (customers.length === 1) {
      const c = customers[0];
      const statusFormatted =
        c.status.charAt(0).toUpperCase() + c.status.slice(1);
      return (
        `Found 1 customer matching "${query}":\n\n` +
        `• Name: ${c.name}\n` +
        `• Company: ${c.company}\n` +
        `• Email: ${c.email}\n` +
        `• Account Status: ${statusFormatted}\n` +
        `• Total Spend: ${c.totalSpend} (${c.ordersCount} orders)\n` +
        `• AI Health Score: ${c.aiHealthScore}/100\n` +
        `• Last Active: ${c.lastActive}`
      );
    }

    const customerList = customers
      .map((c, index) => {
        const statusFormatted =
          c.status.charAt(0).toUpperCase() + c.status.slice(1);
        return (
          `${index + 1}. ${c.name} (${c.company})\n` +
          `   • Status: ${statusFormatted} | Email: ${c.email} | Spend: ${c.totalSpend} | Health Score: ${c.aiHealthScore}/100`
        );
      })
      .join("\n\n");

    return `Found ${customers.length} customers matching "${query}":\n\n${customerList}`;
  }

  /**
   * Helper formatting for invoice search results.
   */
  private formatInvoiceResults(result: InvoiceSearchResult): string {
    const { invoices, totalMatches, filters, query } = result;

    if (totalMatches === 0) {
      const filterDescriptions: string[] = [];
      if (query) filterDescriptions.push(`Query: "${query}"`);
      if (filters.status) filterDescriptions.push(`Status: ${filters.status}`);
      if (filters.minAmount)
        filterDescriptions.push(`Min Amount: ₹${filters.minAmount.toLocaleString("en-IN")}`);

      const criteriaText =
        filterDescriptions.length > 0
          ? ` matching criteria (${filterDescriptions.join(", ")})`
          : "";

      return `No invoices found${criteriaText}.\n\nPlease adjust your search terms, status filters, or amount thresholds.`;
    }

    let header = `Found ${totalMatches} invoice${totalMatches === 1 ? "" : "s"}`;
    if (filters.status && filters.status !== "all") {
      header += ` (${filters.status})`;
    }
    if (filters.minAmount) {
      header += ` above ₹${filters.minAmount.toLocaleString("en-IN")}`;
    }
    if (query) {
      header += ` for "${query}"`;
    }
    header += ":";

    const invoiceList = invoices
      .map((inv, index) => {
        const statusFormatted =
          inv.status.charAt(0).toUpperCase() + inv.status.slice(1);
        const autoRemindText = inv.autoRemind ? "Enabled" : "Disabled";

        return (
          `${index + 1}. **${inv.invoiceNumber}** — ${inv.clientName} (${inv.clientCompany})\n` +
          `   • Amount: ${inv.amount}\n` +
          `   • Status: ${statusFormatted}\n` +
          `   • Due Date: ${inv.dueDate} (Issued: ${inv.issueDate})\n` +
          `   • AI Auto-Remind: ${autoRemindText}`
        );
      })
      .join("\n\n");

    return `${header}\n\n${invoiceList}`;
  }
}

export const businessAgent = new BusinessAgent();
