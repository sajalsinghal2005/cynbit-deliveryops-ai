import type {
  LLMProvider,
  LLMMessage,
  LLMToolDeclaration,
  LLMResponse,
  ModelDecision,
} from "../orchestrator.types.js";

function extractProjectIdentifier(text: string): string | undefined {
  const prjIdMatch = text.match(/\b(PRJ-\d+)\b/i);
  if (prjIdMatch) return prjIdMatch[1].toUpperCase();

  if (/\bFalcon\b/i.test(text)) return "Falcon";
  if (/\bZephyr\b/i.test(text)) return "Zephyr";
  if (/\bTitan\b/i.test(text)) return "Titan";
  if (/\bApex\b/i.test(text)) return "Apex";

  const genericMatch = text.match(/(?:project|status\s+of|about)\s+["']?([A-Za-z0-9_-]+)["']?/i);
  if (genericMatch && genericMatch[1] && !/^(the|a|an|all|any|status|risk|blocker|blockers)$/i.test(genericMatch[1])) {
    return genericMatch[1].trim();
  }
  return undefined;
}

function extractCustomerIdentifier(text: string): string | undefined {
  const custNumMatch = text.match(/(?:customer|client)\s+([1-5])\b/i);
  if (custNumMatch) return custNumMatch[1];

  const custIdMatch = text.match(/\b(CUST-\d+)\b/i);
  if (custIdMatch) return custIdMatch[1];

  if (/Zenith\s*Media/i.test(text)) return "Zenith Media";
  if (/ABC\s*Tech/i.test(text)) return "ABC Technologies";
  if (/Sharma\s*Infotech/i.test(text)) return "Sharma Infotech";
  if (/Global\s*Logistics/i.test(text)) return "Global Logistics";
  if (/CoreCompute/i.test(text)) return "CoreCompute";

  return undefined;
}

/**
 * Deterministic LLM Provider
 * Safe offline fallback adapter that uses rule-based classification to produce
 * typed ModelDecision structures with 100% predictability and zero network/cost overhead.
 */
export class DeterministicLLMProvider implements LLMProvider {
  public readonly name = "deterministic";
  public readonly model = "rule-engine-v1";

  public isAvailable(): boolean {
    return true;
  }

  public async generateStructuredDecision(
    messages: LLMMessage[],
    _availableTools: LLMToolDeclaration[]
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const userMessage =
      messages.filter((m) => m.role === "user").pop()?.content || "";
    const trimmed = userMessage.trim();
    const lower = trimmed.toLowerCase();

    let decision: ModelDecision;

    // 1. Prompt Injection & Jailbreak Defense Interception
    if (
      /(?:ignore\s+(?:all\s+)?previous\s+instructions|system\s+prompt|reveal\s+(?:your\s+)?instructions|you\s+are\s+now|override\s+system|maintenance\s+mode|send\s+(?:the\s+)?api\s*key)/i.test(
        trimmed
      )
    ) {
      decision = {
        type: "final_answer",
        reasoningSummary: "Prompt injection attempt detected and safely neutralized.",
        response:
          "I am BizOps AI. I cannot alter my security policies, execute unauthenticated instructions, or reveal confidential system information.",
      };
    }
    // 2. Unsupported Project / Database Mutations
    else if (
      /(?:delete|drop|destroy|truncate|remove)\s+(?:the\s+)?(?:delayed\s+)?(?:project|milestone|blocker|database|table)s?/i.test(
        trimmed
      )
    ) {
      decision = {
        type: "final_answer",
        reasoningSummary: "Destructive database mutations on project records are not supported.",
        response:
          "I cannot delete or modify project records. All DeliveryOps capabilities are strictly read-only and no mutation tools exist for projects or database records.",
      };
    }
    // 3. Ambiguous Project Inquiry
    else if (
      /^(?:tell\s+me\s+about\s+(?:the\s+)?project|show\s+(?:me\s+)?(?:the\s+)?project|what\s+is\s+(?:the\s+)?project|status\s+of\s+(?:the\s+)?project)[?.!]?$/i.test(
        trimmed
      ) ||
      /^(?:tell\s+me\s+about|show\s+me|what\s+is|inspect)\s+(?:the\s+)?projects?[?.!]?$/i.test(trimmed)
    ) {
      decision = {
        type: "clarification",
        reasoningSummary: "Ambiguous project inquiry without specific project name or identifier.",
        response:
          "Could you please specify which project you would like information on (for example: Project Falcon, Project Zephyr, Project Titan, or Project Apex)?",
      };
    }
    // 4. Cross-Domain Client Delivery + Billing Summary
    else if (
      /(?:delivery\s+(?:and|&|\+)\s+(?:billing|invoices?)|clients?\s+have\s+delivery\s+problems|delivery\s+and\s+billing\s+health|client\s+delivery\s+summary|both\s+delivery\s+risk\s+and\s+overdue)/i.test(
        trimmed
      ) ||
      (/(?:delivery|project)/i.test(trimmed) &&
        /(?:invoice|billing|overdue|debt)/i.test(trimmed) &&
        /(?:client|customer)/i.test(trimmed))
    ) {
      const custId = extractCustomerIdentifier(trimmed);
      decision = {
        type: "tool_call",
        toolName: "client-delivery-summary",
        arguments: custId ? { query: custId } : { query: "all" },
        reasoningSummary: custId
          ? `Retrieve unified cross-domain delivery portfolio and invoice health for client ${custId}.`
          : "Scan customer accounts for compound delivery risk and overdue billing balances.",
      };
    }
    // 5. Project Blockers
    else if (
      /(?:what\s+is\s+blocking|blockers?\s+(?:for|on|in)|blocking\s+["']?([A-Za-z0-9_-]+)|show\s+(?:all\s+)?blockers|list\s+blockers|active\s+blockers|projects?\s+have\s+active\s+blockers)/i.test(
        trimmed
      )
    ) {
      const prj = extractProjectIdentifier(trimmed);
      decision = {
        type: "tool_call",
        toolName: "project-blockers",
        arguments: prj ? { projectId: prj, status: "unresolved" } : { status: "unresolved" },
        reasoningSummary: prj
          ? `Retrieve open delivery blockers for project ${prj}.`
          : "Retrieve active delivery blockers across all projects.",
      };
    }
    // 6. Portfolio Highest Risk Ranking & Immediate Attention
    else if (
      /(?:highest\s+risk|highest\s+delivery\s+risk|most\s+at\s+risk|projects?\s+(?:are|is)\s+(?:currently\s+)?(?:at\s+)?highest\s+risk|projects?\s+need\s+immediate\s+attention|immediate\s+attention|which\s+projects?\s+(?:are|is)\s+high\s+risk)/i.test(
        trimmed
      )
    ) {
      decision = {
        type: "tool_call",
        toolName: "project-risk-analysis",
        arguments: { projectId: "all" },
        reasoningSummary: "Perform portfolio-wide deterministic delivery risk ranking across active projects.",
      };
    }
    // 7. Specific Project Risk Analysis
    else if (
      /(?:why\s+is\s+.*(?:at\s+risk|delayed|risky)|is\s+.*(?:at\s+risk|delayed|risky)|risk\s+analysis|project\s+risk)/i.test(
        trimmed
      )
    ) {
      const prj = extractProjectIdentifier(trimmed);
      decision = {
        type: "tool_call",
        toolName: "project-risk-analysis",
        arguments: prj ? { projectId: prj } : { projectId: "all" },
        reasoningSummary: prj
          ? `Perform deterministic server-side risk evaluation for project ${prj}.`
          : "Evaluate delivery risk indicators across projects.",
      };
    }
    // 8. General Which Projects Are At Risk
    else if (
      /(?:which\s+projects?\s+(?:are|is)\s+at\s+risk|projects?\s+at\s+risk|show\s+at[-_\s]risk\s+projects?)/i.test(
        trimmed
      )
    ) {
      decision = {
        type: "tool_call",
        toolName: "project-search",
        arguments: { status: "at_risk" },
        reasoningSummary: "Search delivery registry for projects marked at_risk.",
      };
    }
    // 9. Delivery Operations Summary
    else if (
      /(?:summary\s+of\s+(?:current\s+)?delivery\s+operations|delivery\s+operations\s+summary|overview\s+of\s+delivery\s+operations)/i.test(
        trimmed
      )
    ) {
      decision = {
        type: "tool_call",
        toolName: "project-search",
        arguments: { status: "all", limit: 10 },
        reasoningSummary: "Retrieve delivery operations portfolio summary across all active projects.",
      };
    }
    // 10. Project Status / Summary
    else if (
      /(?:status\s+of\s+(?:project\s+)?|project\s+summary|summary\s+of\s+(?:project\s+)?|overview\s+of\s+(?:project\s+)?|details\s+(?:for|of)\s+(?:project\s+)?)/i.test(
        trimmed
      ) &&
      extractProjectIdentifier(trimmed)
    ) {
      const prj = extractProjectIdentifier(trimmed)!;
      decision = {
        type: "tool_call",
        toolName: "project-summary",
        arguments: { projectId: prj },
        reasoningSummary: `Retrieve comprehensive delivery status and milestone progress for project ${prj}.`,
      };
    }
    // 11. Project Search
    else if (
      /(?:(?:find|search|show|list|get)\s+(?:all\s+)?(?:[a-z_-\s]+\s+)?projects?|projects?\s+using\s+|projects?\s+led\s+by|projects?\s+with\s+lead)/i.test(
        trimmed
      )
    ) {
      let queryTerm: string | undefined = undefined;
      let statusFilter: string | undefined = undefined;

      if (/delayed/i.test(trimmed)) statusFilter = "delayed";
      else if (/at_risk|at\s+risk/i.test(trimmed)) statusFilter = "at_risk";
      else if (/on_track|on\s+track/i.test(trimmed)) statusFilter = "on_track";

      const termMatch = trimmed.match(/(?:using|with|stack|lead|by|named|for)\s+["']?([^"'?.!]+)["']?/i);
      if (termMatch && termMatch[1]) {
        queryTerm = termMatch[1].trim();
      }

      decision = {
        type: "tool_call",
        toolName: "project-search",
        arguments: {
          query: queryTerm,
          ...(statusFilter ? { status: statusFilter } : {}),
        },
        reasoningSummary: `Search delivery projects matching criteria ${queryTerm || statusFilter || "all"}.`,
      };
    }
    // 10. Negative / Cancel Reminder Intent
    else if (
      /(?:do\s+not|don't|cancel|never|stop|hold)\s+(?:send|dispatch|issue|prepare)?\s*(?:a\s+)?(?:reminder|email|notice)/i.test(
        trimmed
      )
    ) {
      decision = {
        type: "final_answer",
        reasoningSummary: "User specified negative reminder command.",
        response:
          "Understood. No invoice reminder proposal will be queued or dispatched.",
      };
    }
    // Consequential DeliveryOps Client Follow-up Tool Call
    else if (
      /(?:prepare|draft|create|send)\s+(?:a\s+)?(?:client\s+)?follow[-_\s]?up/i.test(trimmed) ||
      /(?:follow[-_\s]?up\s+(?:with|for|to)|client\s+follow[-_\s]?up)/i.test(trimmed)
    ) {
      let prj = extractProjectIdentifier(trimmed) || "Falcon";
      let cust = extractCustomerIdentifier(trimmed) || "ABC Technologies";

      if (prj === "Titan" && !extractCustomerIdentifier(trimmed)) cust = "Zenith Media";
      else if (prj === "Zephyr" && !extractCustomerIdentifier(trimmed)) cust = "Sharma Infotech";
      else if (prj === "Apex" && !extractCustomerIdentifier(trimmed)) cust = "Global Logistics";

      decision = {
        type: "tool_call",
        toolName: "prepare-client-followup",
        arguments: {
          customer: cust,
          project: prj,
          reason: `Project ${prj} delivery risk escalation follow-up`,
          subject: `Follow-up: Delivery Status and Milestone Review for ${prj}`,
          message: `Dear Client,\n\nWe are following up regarding ${prj} delivery milestones, active blockers, and upcoming release timelines.\n\nBest regards,\nDelivery Operations Team`,
        },
        reasoningSummary: `Prepare client follow-up proposal for ${cust} regarding project ${prj}.`,
      };
    }
    // 3. Consequential Invoice Reminder Tool Call
    else if (
      /(?:(?:send|dispatch|issue|prepare)\s+(?:an?\s+)?(?:(?:overdue|payment|invoice)\s+)*(?:reminder|email|notice)s?)|(?:\b(?:remind|notify)\s+(?:client|customer|overdue|debtor))\b|(?:payment\s+reminder)/i.test(
        trimmed
      )
    ) {
      let query: string | undefined = undefined;
      const invMatch = trimmed.match(/\b(inv-\d+)\b/i);
      if (invMatch && invMatch[1]) {
        query = invMatch[1].toUpperCase();
      }

      if (!query) {
        const clientMatch = trimmed.match(
          /(?:reminder(?:s)?\s+(?:for|to)|remind)\s+["']?([^"'?.!]+)["']?/i
        );
        if (clientMatch && clientMatch[1]) {
          query = clientMatch[1].trim();
        }
      }

      decision = {
        type: "tool_call",
        toolName: "send-email",
        arguments: {
          template: "overdue_invoice_reminder",
          invoices: [
            {
              invoiceNumber: query || "INV-1001",
              clientName: query || "Client Accounts Payable",
              clientCompany: query || "Client Accounts Payable",
              amount: "₹1,00,000",
              dueDate: "Past Due",
            },
          ],
        },
        reasoningSummary: `Propose overdue reminder email for target: ${query || "overdue invoices"}.`,
      };
    }
    // 4. BI Analytics: Total Outstanding Debt
    else if (
      /(?:how\s+much\s+(?:money\s+)?is\s+outstanding|total\s+outstanding|outstanding\s+total|total\s+unpaid|what\s+is\s+(?:the\s+)?outstanding)/i.test(
        trimmed
      )
    ) {
      decision = {
        type: "tool_call",
        toolName: "bi-outstanding-total",
        arguments: {},
        reasoningSummary: "Query aggregate outstanding accounts receivable total.",
      };
    }
    // 5. BI Analytics: Overdue Summary
    else if (
      /(?:overdue\s+summary|overdue\s+breakdown|summary\s+of\s+overdue|how\s+much\s+is\s+overdue|overdue\s+report)/i.test(
        trimmed
      )
    ) {
      decision = {
        type: "tool_call",
        toolName: "bi-overdue-summary",
        arguments: {},
        reasoningSummary: "Query aggregate overdue debt portfolio.",
      };
    }
    // 6. BI Analytics: Top Outstanding Customers / Debtors
    else if (
      /(?:top\s+outstanding\s+customers?|highest\s+outstanding\s+balances?|highest\s+debt|top\s+debtors?|who\s+owes\s+the\s+most|outstanding\s+revenue\s+by\s+customer)/i.test(
        trimmed
      )
    ) {
      decision = {
        type: "tool_call",
        toolName: "bi-top-outstanding-customers",
        arguments: { limit: 5 },
        reasoningSummary: "Retrieve top debtor accounts ranked by outstanding balance.",
      };
    }
    // 7. BI Analytics: Revenue & Collections
    else if (
      /(?:revenue\s+metrics|collection\s+rate|financial\s+performance|collections?\s+performance|total\s+collected|total\s+revenue)/i.test(
        trimmed
      )
    ) {
      decision = {
        type: "tool_call",
        toolName: "bi-revenue-metrics",
        arguments: {},
        reasoningSummary: "Calculate billing collections and recovery rate metrics.",
      };
    }
    // 8. Invoice Search / Inspection
    else if (
      /(?:show\s+(?:me\s+)?(?:all\s+)?(?:overdue\s+)?invoices?|find\s+invoice|search\s+invoice|unpaid\s+invoices?|which\s+invoices\s+are\s+overdue|which\s+customers\s+have\s+overdue\s+invoices)/i.test(
        trimmed
      )
    ) {
      const isOverdue = lower.includes("overdue");
      const invMatch = trimmed.match(/\b(inv-\d+)\b/i);

      let minAmount: number | undefined = undefined;
      const amountMatch = trimmed.match(
        /(?:above|greater\s+than|>|more\s+than|exceeding|over)\s*(?:₹|rs\.?|inr)?\s*([0-9,]+)/i
      );
      if (amountMatch && amountMatch[1]) {
        const parsedNum = parseFloat(amountMatch[1].replace(/,/g, ""));
        if (!isNaN(parsedNum)) {
          minAmount = parsedNum;
        }
      }

      if (invMatch && invMatch[1]) {
        decision = {
          type: "tool_call",
          toolName: "invoice-summary",
          arguments: { invoiceNumber: invMatch[1].toUpperCase() },
          reasoningSummary: `Look up specific invoice details for ${invMatch[1].toUpperCase()}.`,
        };
      } else if (isOverdue && minAmount === undefined) {
        decision = {
          type: "tool_call",
          toolName: "overdue-invoices",
          arguments: {},
          reasoningSummary: "Retrieve list of all overdue invoices.",
        };
      } else {
        decision = {
          type: "tool_call",
          toolName: "invoice-search",
          arguments: {
            status: isOverdue ? "overdue" : "unpaid",
            ...(minAmount !== undefined ? { minAmount } : {}),
          },
          reasoningSummary: `Search ${isOverdue ? "overdue" : "unsettled"} invoices${minAmount !== undefined ? ` above ₹${minAmount.toLocaleString("en-IN")}` : ""}.`,
        };
      }
    }
    // 9. Customer Search / Summary
    else if (
      /(?:find\s+customer|search\s+customer|customer\s+summary|account\s+status|customer\s+balance)/i.test(
        trimmed
      )
    ) {
      const custMatch = trimmed.match(
        /(?:customer(?:s)?|client(?:s)?|account\s+status\s+of)\s+["']?([^"'?.!]+)["']?/i
      );
      const query = custMatch ? custMatch[1].trim() : "Acme";

      if (lower.includes("summary") || lower.includes("status")) {
        decision = {
          type: "tool_call",
          toolName: "customer-summary",
          arguments: { query },
          reasoningSummary: `Retrieve customer operational summary for ${query}.`,
        };
      } else if (lower.includes("balance")) {
        decision = {
          type: "tool_call",
          toolName: "customer-outstanding-balance",
          arguments: { query },
          reasoningSummary: `Calculate outstanding balance for customer ${query}.`,
        };
      } else {
        decision = {
          type: "tool_call",
          toolName: "customer-search",
          arguments: { query },
          reasoningSummary: `Search customer directory for ${query}.`,
        };
      }
    }
    // 10. Clarification / Unsupported Fallback
    else {
      decision = {
        type: "clarification",
        reasoningSummary: "User request not recognized among registered operations.",
        response:
          "I can assist with querying customer records, inspecting invoice statuses, calculating revenue metrics, or proposing overdue invoice reminder emails. Could you clarify your request?",
      };
    }

    return {
      decision,
      provider: this.name,
      model: this.model,
      latencyMs: Date.now() - startTime,
      usage: {
        promptTokens: Math.ceil(trimmed.length / 4),
        completionTokens: 25,
        totalTokens: Math.ceil(trimmed.length / 4) + 25,
      },
    };
  }
}
