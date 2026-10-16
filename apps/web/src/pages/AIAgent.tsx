import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  FileSearch,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import type {
  AgentResponse,
  AgentConversationItem,
  AgentCustomerItem,
  AgentInvoiceItem,
  AgentOutcomeType,
} from "../types/agent";

type StepStatus = "completed" | "running" | "pending" | "approval";

interface AgentStep {
  id: number;
  title: string;
  description: string;
  status: StepStatus;
  icon: React.ElementType;
}

const initialSteps: AgentStep[] = [
  {
    id: 1,
    title: "Analyze request",
    description: "Identify user intent and required business operation",
    status: "completed",
    icon: Sparkles,
  },
  {
    id: 2,
    title: "Tool selection",
    description: "Select authorized business tool from registry",
    status: "completed",
    icon: FileSearch,
  },
  {
    id: 3,
    title: "Execute query",
    description: "Query business data and verify governance policy",
    status: "running",
    icon: Search,
  },
  {
    id: 4,
    title: "Governance check",
    description: "Verify if action requires human review and authorization",
    status: "pending",
    icon: ShieldAlert,
  },
];

export default function Agent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isApproverOnly = user?.role === "APPROVER";

  const [message, setMessage] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<AgentStep[]>(initialSteps);
  const [latestApprovalId, setLatestApprovalId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<AgentConversationItem[]>([]);
  const nextItemId = useRef(1);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll conversation on update
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [conversation, running]);

  // Copy helper
  const handleCopy = async (text: string, identifier: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(identifier);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore clipboard write failures gracefully
    }
  };

  // Main task runner
  const runAgent = async (promptToRun?: string) => {
    const prompt = (promptToRun || message).trim();
    if (!prompt || running || isApproverOnly) return;

    const itemId = `turn-${nextItemId.current++}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Append user turn with processing placeholder
    setConversation((prev) => [
      ...prev,
      {
        id: itemId,
        timestamp,
        userMessage: prompt,
        isProcessing: true,
      },
    ]);

    if (!promptToRun) {
      setMessage("");
    }
    setRunning(true);

    // Dynamic right-hand execution steps
    setSteps([
      {
        id: 1,
        title: "Analyze request",
        description: `Parsing business request: "${prompt.slice(0, 40)}${prompt.length > 40 ? "..." : ""}"`,
        status: "running",
        icon: Sparkles,
      },
      {
        id: 2,
        title: "Tool verification",
        description: "Checking tool registry and server-side RBAC",
        status: "pending",
        icon: FileSearch,
      },
      {
        id: 3,
        title: "Execute operation",
        description: "Retrieving records or constructing proposal",
        status: "pending",
        icon: Search,
      },
      {
        id: 4,
        title: "Governance authorization",
        description: "Ensuring human review before any consequential execution",
        status: "pending",
        icon: ShieldAlert,
      },
    ]);

    try {
      const response = await api.post<AgentResponse>("/api/agent", {
        message: prompt,
      });

      if (!response || typeof response !== "object") {
        throw new Error("BizOps API returned an unexpected response format.");
      }

      // Update right-hand execution plan based on response
      const isConsequential = response.outcome === "APPROVAL_REQUIRED" || response.approvalRequired;
      const toolLabel = response.toolUsed === "invoice-search"
        ? "Invoice Search Tool"
        : response.toolUsed === "customer-search"
        ? "Customer Search Tool"
        : "Autonomous Reasoning";

      setSteps([
        {
          id: 1,
          title: "Analyze request",
          description: "Intent identified and validated successfully",
          status: "completed",
          icon: Sparkles,
        },
        {
          id: 2,
          title: "Tool invocation",
          description: `Dispatched: ${toolLabel}`,
          status: "completed",
          icon: FileSearch,
        },
        {
          id: 3,
          title: "Data retrieval",
          description: response.success ? "Operation completed successfully" : "Execution halted with issue",
          status: "completed",
          icon: Search,
        },
        {
          id: 4,
          title: "Governance status",
          description: isConsequential
            ? `Protected action queued (Approval ID: ${response.approvalId || "Pending"})`
            : "Read-only operation; no human approval needed",
          status: isConsequential ? "approval" : "completed",
          icon: isConsequential ? ShieldAlert : CheckCircle2,
        },
      ]);

      if (response.approvalId) {
        setLatestApprovalId(response.approvalId);
      }

      // Update conversation item with actual response
      setConversation((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                isProcessing: false,
                response,
              }
            : item
        )
      );
    } catch (err: any) {
      let safeErrorMessage = "An unexpected error occurred while processing your request.";
      if (err instanceof ApiError) {
        safeErrorMessage = err.message || safeErrorMessage;
      } else if (err instanceof TypeError) {
        safeErrorMessage = "Unable to connect to the backend server. Please verify the API is running at http://localhost:4000.";
      } else if (err instanceof Error) {
        safeErrorMessage = err.message || safeErrorMessage;
      }

      // Mark right-hand steps with error
      setSteps((prev) =>
        prev.map((s, idx) =>
          idx === 2
            ? { ...s, status: "pending", description: "Failed during execution" }
            : s
        )
      );

      setConversation((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                isProcessing: false,
                error: safeErrorMessage,
              }
            : item
        )
      );
    } finally {
      setRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      runAgent();
    }
  };

  return (
    <main className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
      {/* Approver role alert banner */}
      {isApproverOnly && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/80 p-4 shadow-sm">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <ShieldAlert size={16} />
          </div>
          <div className="flex-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-900">
              Governance & Decision Role Notice
            </h3>
            <p className="mt-1 text-xs leading-5 text-blue-700">
              Your account has the <span className="font-semibold">APPROVER</span> role. Agent operational execution is scoped to Operators and Administrators. You have full governance authority to review, authorize, or reject pending proposals in the Approval Center.
            </p>
          </div>
          <button
            onClick={() => navigate("/approvals")}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            Go to Approvals
            <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-100 text-violet-600">
              <Bot size={14} />
            </span>
            <span className="text-xs font-semibold text-violet-600">
              AI OPERATIONS
            </span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
            AI Operations Agent
          </h1>

          <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
            Automate business workflows with natural language. Read-only queries resolve instantly; consequential actions require human approval before execution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {conversation.length > 0 && (
            <button
              onClick={() => {
                setConversation([]);
                setLatestApprovalId(null);
                setSteps(initialSteps);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-rose-600"
              title="Clear current conversation history"
            >
              <Trash2 size={13} />
              Clear history
            </button>
          )}

          <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-emerald-700">
              Agent Ready
            </span>
          </div>
        </div>
      </div>

      {/* Main workspace */}
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        {/* LEFT COLUMN: Conversation Workspace */}
        <section className="flex min-h-[670px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Panel Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20">
                <Bot size={19} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  BizOps Autonomous Assistant
                </p>
                <p className="text-[11px] text-slate-500">
                  Deterministic tool dispatch & governance gating
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
              <Zap size={13} className="text-violet-500" />
              <span className="text-[10px] font-semibold text-slate-600">
                GOVERNED AGENT
              </span>
            </div>
          </div>

          {/* Conversation Stream */}
          <div
            ref={logContainerRef}
            role="log"
            aria-label="Conversation with BizOps AI"
            aria-live="polite"
            aria-busy={running}
            className="flex-1 space-y-6 overflow-y-auto bg-slate-50/50 p-5"
          >
            {/* Empty State */}
            {conversation.length === 0 && !running && (
              <div className="flex h-full min-h-[420px] flex-col items-center justify-center text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                  <Sparkles size={27} />
                </div>

                <h2 className="text-lg font-semibold text-slate-900">
                  What business operation would you like to perform?
                </h2>

                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Search customers and invoices, inspect account health, or prepare overdue reminder actions with built-in human approval.
                </p>

                <div className="mt-6 grid w-full max-w-2xl gap-2.5 sm:grid-cols-3">
                  <Suggestion
                    text="Which projects are at risk?"
                    description="DeliveryOps portfolio risk"
                    onClick={() => runAgent("Which projects are currently at risk?")}
                  />
                  <Suggestion
                    text="What is blocking Zephyr?"
                    description="Blocker severity & impact"
                    onClick={() => runAgent("What is blocking the Zephyr project?")}
                  />
                  <Suggestion
                    text="Status of PRJ-101"
                    description="Falcon milestones & health"
                    onClick={() => runAgent("What is the status of PRJ-101?")}
                  />
                  <Suggestion
                    text="Risk & overdue invoices"
                    description="Cross-domain delivery & AR"
                    onClick={() => runAgent("Which clients have both delivery risk and overdue invoices?")}
                  />
                  <Suggestion
                    text="Prepare follow-up for Falcon"
                    description="Creates governed proposal"
                    onClick={() => runAgent("Prepare a client follow-up for Falcon")}
                  />
                  <Suggestion
                    text="How much is outstanding?"
                    description="Portfolio AR total"
                    onClick={() => runAgent("How much money is outstanding?")}
                  />
                </div>
              </div>
            )}

            {/* Conversation Items */}
            {conversation.map((item) => (
              <div key={item.id} className="space-y-4">
                {/* 1. USER PROMPT CARD */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-end"
                >
                  <div className="max-w-[85%]">
                    <div className="mb-1 flex items-center justify-end gap-2">
                      <span className="text-[10px] font-medium text-slate-400">
                        {item.timestamp}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-600">
                        You
                      </span>
                    </div>

                    <div className="whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-violet-600 px-4 py-3 text-sm leading-6 text-white shadow-lg shadow-violet-500/10">
                      {item.userMessage}
                    </div>
                  </div>
                </motion.div>

                {/* 2. AGENT RESPONSE / RESULT CARD */}
                {item.isProcessing ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                      <Bot size={15} />
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
                      <span>Analyzing business intent and evaluating data sources...</span>
                    </div>
                  </motion.div>
                ) : item.response ? (
                  <AgentResponseCard
                    response={item.response}
                    onCopy={handleCopy}
                    copiedId={copiedId}
                    navigate={navigate}
                  />
                ) : item.error ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                      <AlertCircle size={15} />
                    </div>
                    <div className="w-full max-w-[85%] rounded-2xl rounded-tl-md border border-rose-200 bg-rose-50/50 p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-rose-800">
                          Operation Halted
                        </span>
                        <button
                          onClick={() => runAgent(item.userMessage)}
                          className="flex items-center gap-1 rounded bg-rose-100 px-2 py-1 text-[11px] font-medium text-rose-700 transition hover:bg-rose-200"
                        >
                          <RotateCcw size={11} />
                          Retry
                        </button>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-rose-700">
                        {item.error}
                      </p>
                    </div>
                  </motion.div>
                ) : null}
              </div>
            ))}
          </div>

          {/* Composer */}
          <div className="border-t border-slate-200 bg-white p-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 transition focus-within:border-violet-300 focus-within:ring-4 focus-within:ring-violet-500/5">
              <textarea
                id="agent-task-input"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={running || isApproverOnly}
                placeholder={
                  isApproverOnly
                    ? "Agent operation execution is disabled for APPROVER role (use Approval Center)."
                    : "Ask BizOps AI to search records, check invoices, or prepare actions (Press Enter to send)..."
                }
                rows={2}
                aria-label="Business task for BizOps AI"
                className="w-full resize-none bg-transparent px-2 py-1 text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-400"
              />

              <div className="flex items-center justify-between px-1 pt-2">
                <span className="text-[10px] text-slate-400">
                  {message.length > 0
                    ? `${message.length}/2,000 chars • Enter to send, Shift+Enter for newline`
                    : "Consequential actions are never executed without human authorization."}
                </span>

                <button
                  onClick={() => runAgent()}
                  disabled={!message.trim() || running || isApproverOnly}
                  className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Run business task"
                >
                  {running ? (
                    <>
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>Run task</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: Execution Plan & Governance Panel */}
        <section className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Execution Plan & Safety
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Step-by-step transparency & governance status
              </p>
            </div>

            <span className="rounded-lg bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-600">
              {steps.filter((s) => s.status === "completed").length}/{steps.length} Steps
            </span>
          </div>

          <div className="flex-1 p-5">
            {/* Step Pipeline */}
            <div className="relative">
              {steps.map((step, index) => (
                <motion.div
                  key={step.id}
                  layout
                  className="relative flex gap-4 pb-7 last:pb-0"
                >
                  {/* Connector line */}
                  {index !== steps.length - 1 && (
                    <div className="absolute left-[15px] top-8 h-[calc(100%-12px)] w-px bg-slate-200" />
                  )}

                  <StepIcon status={step.status} icon={step.icon} />

                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p
                          className={`text-xs font-semibold ${
                            step.status === "pending"
                              ? "text-slate-400"
                              : "text-slate-800"
                          }`}
                        >
                          {step.title}
                        </p>
                        <p className="mt-1 text-[11px] leading-5 text-slate-500">
                          {step.description}
                        </p>
                      </div>

                      <StatusBadge status={step.status} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Active Approval Alert Card */}
            {latestApprovalId && (
              <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-amber-500 shadow-sm">
                    <ShieldAlert size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-amber-900">
                        Human Authorization Required
                      </p>
                      <span className="rounded bg-amber-200/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-900">
                        {latestApprovalId}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-5 text-amber-800">
                      BizOps AI has queued proposal <strong>{latestApprovalId}</strong>. It cannot execute until an authorized Administrator or Approver reviews and authorizes it.
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => navigate(`/approvals?id=${latestApprovalId}`)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-500 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-600"
                  >
                    Review in Approval Center
                    <ExternalLink size={13} />
                  </button>
                  <button
                    onClick={() => handleCopy(latestApprovalId, "sidebar-id")}
                    className="flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-2 text-xs font-medium text-amber-800 transition hover:bg-amber-50"
                    title="Copy Approval ID"
                  >
                    {copiedId === "sidebar-id" ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
            )}

            {/* Governance Safety Invariant Note */}
            <div className="mt-6 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3.5">
              <div className="flex items-center gap-2">
                <ShieldAlert size={14} className="text-violet-600" />
                <span className="text-xs font-semibold text-slate-800">
                  Built-in Safety Invariants
                </span>
              </div>
              <ul className="space-y-1.5 text-[11px] leading-4 text-slate-500">
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-500">✓</span>
                  <span>No external side-effects occur before human approval</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-500">✓</span>
                  <span>Direct execution buttons are prohibited on the agent console</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-500">✓</span>
                  <span>Actor identity strictly tied to authenticated server session</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

/**
 * Rich Agent Response Card Component
 * Formats results based on outcome:
 * - READ_ONLY_RESULT (Structured table of customers or invoices)
 * - APPROVAL_REQUIRED (Prominent human approval box with ID and navigation)
 * - UNSUPPORTED_REQUEST (Helpful capability scope guidance)
 * - INVALID_REQUEST (Friendly correction instructions)
 * - TOOL_EXECUTION_FAILURE / INTERNAL_FAILURE (Sanitized error state with retry)
 */
function AgentResponseCard({
  response,
  onCopy,
  copiedId,
  navigate,
}: {
  response: AgentResponse;
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
  navigate: (to: string) => void;
}) {
  const { outcome, message, approvalRequired, approvalId, toolUsed, data } = response;

  const isCustomerSearchData = toolUsed === "customer-search" && data?.customers;
  const isCustomerSummaryData = toolUsed === "customer-summary" && data?.found && data?.customer && data?.financialSummary;
  const isCustomerBalanceData = toolUsed === "customer-outstanding-balance" && data?.found && data?.customer;
  const isCustomersWithOutstandingData = toolUsed === "customers-with-outstanding" && data?.customers;
  const isInvoiceSummaryData = toolUsed === "invoice-summary" && data?.found && data?.invoice;
  const isInvoiceStatusSummaryData = toolUsed === "invoice-status-summary" && data?.statusBreakdown;
  const isBiOutstandingData = toolUsed === "bi-outstanding-total" && data?.totalOutstandingFormatted;
  const isBiOverdueData = toolUsed === "bi-overdue-summary" && data?.totalOverdueAmountFormatted;
  const isBiTopCustomersData = toolUsed === "bi-top-outstanding-customers" && data?.rankedCustomers;
  const isBiRevenueData = toolUsed === "bi-revenue-metrics" && data?.totalBilledFormatted;
  const isInvoiceData =
    (toolUsed === "invoice-search" ||
      toolUsed === "overdue-invoices" ||
      toolUsed === "outstanding-invoices" ||
      toolUsed === "customer-invoice-history") &&
    data?.invoices;

  const isProjectSearchData = toolUsed === "project-search" && data?.projects;
  const isProjectSummaryData = toolUsed === "project-summary" && data?.found && data?.project;
  const isProjectRiskData = toolUsed === "project-risk-analysis" && data?.found;
  const isProjectBlockersData = toolUsed === "project-blockers" && data?.blockers;
  const isClientDeliveryData = toolUsed === "client-delivery-summary" && data?.customer && data?.projects;
  const isPrepareFollowupData =
    (toolUsed === "prepare-client-followup" || data?.action === "prepare-client-followup") &&
    (data?.proposedSubject || data?.subject || data?.approvalRequest);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
        <Bot size={15} />
      </div>

      <div className="w-full max-w-[92%] rounded-2xl rounded-tl-md border border-slate-200 bg-white p-4 text-sm shadow-sm">
        {/* Card Header & Outcome Badge */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <OutcomeBadge outcome={outcome} approvalRequired={approvalRequired} />
            {response.mode === "LLM" ? (
              <span className="flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 border border-violet-200">
                <Sparkles size={11} className="text-violet-600" />
                <span>AI ({response.model || response.provider})</span>
              </span>
            ) : response.mode === "DETERMINISTIC_FALLBACK" ? (
              <span className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200">
                <ShieldAlert size={11} className="text-slate-500" />
                <span>Deterministic Mode</span>
              </span>
            ) : null}
            {toolUsed && (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-600">
                {toolUsed}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onCopy(message, `msg-${approvalId || "turn"}`)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              title="Copy synthesized response"
            >
              {copiedId === `msg-${approvalId || "turn"}` ? (
                <>
                  <Check size={12} className="text-emerald-600" />
                  <span className="text-emerald-600 font-semibold">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 1. APPROVAL_REQUIRED BANNER */}
        {approvalRequired && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm">
                <ShieldAlert size={16} />
              </div>

              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                    Human Authorization Required
                  </h4>

                  {approvalId && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-amber-950">
                        {approvalId}
                      </span>
                      <button
                        onClick={() => onCopy(approvalId, `appr-${approvalId}`)}
                        className="rounded border border-amber-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 transition hover:bg-amber-100"
                      >
                        {copiedId === `appr-${approvalId}` ? "Copied" : "Copy ID"}
                      </button>
                    </div>
                  )}
                </div>

                <p className="mt-1.5 text-xs leading-5 text-amber-800">
                  Proposal created — waiting for human approval. Sending external emails is a protected action.
                  This action has <strong>NOT executed</strong>. Please review and authorize in the Approval Center.
                </p>

                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => navigate(approvalId ? `/approvals?id=${approvalId}` : "/approvals")}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-700"
                  >
                    Open Approval Center
                    <ExternalLink size={12} />
                  </button>

                  <span className="text-[11px] text-amber-700">
                    • Governed execution prevents direct UI execution
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. SYNTHESIZED TEXT RESPONSE */}
        <div className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-700">
          {message}
        </div>

        {/* 2.1 SAFE REASONING SUMMARY */}
        {response.reasoningSummary && response.reasoningSummary !== message && (
          <div className="mt-2.5 rounded-lg border border-slate-100 bg-slate-50/80 p-2.5 text-[11px] text-slate-600 flex items-start gap-2">
            <Sparkles size={13} className="text-violet-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-800">Agent Reasoning Summary: </span>
              <span>{response.reasoningSummary}</span>
            </div>
          </div>
        )}

        {/* 3. STRUCTURED DATA PRESENTATION */}
        {/* 3.1 BI: Outstanding Total Card */}
        {isBiOutstandingData && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3.5 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Total Outstanding</span>
              <p className="mt-1 font-mono text-lg font-bold text-violet-900">{data.totalOutstandingFormatted}</p>
              <span className="text-[10px] text-violet-600">{data.totalOutstandingInvoicesCount} unpaid invoice(s)</span>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3.5 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Overdue Debt</span>
              <p className="mt-1 font-mono text-lg font-bold text-rose-900">{data.overdueTotalFormatted}</p>
              <span className="text-[10px] text-rose-600">{data.overdueInvoicesCount} overdue invoice(s)</span>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Pending Balance</span>
              <p className="mt-1 font-mono text-lg font-bold text-amber-900">{data.pendingTotalFormatted}</p>
              <span className="text-[10px] text-amber-600">{data.pendingInvoicesCount} pending invoice(s)</span>
            </div>
          </div>
        )}

        {/* 3.1.2 BI: Overdue Invoices Intelligence Summary */}
        {isBiOverdueData && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/40 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-200/60 pb-2.5">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900">Overdue Debt Intelligence</h4>
                <p className="mt-0.5 text-xs text-rose-800">{data.totalOverdueCount} invoice(s) affecting {data.impactedClientsCount} client account(s)</p>
              </div>
              <span className="font-mono text-base font-bold text-rose-950">{data.totalOverdueAmountFormatted}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-rose-900">
              <span>Avg Overdue: <strong>{data.averageOverdueAmountFormatted}</strong></span>
              <span>Impacted Accounts: <strong>{data.impactedClients?.length || data.impactedClientsCount}</strong></span>
            </div>
          </div>
        )}

        {/* 3.2 BI: Top Outstanding Customers Leaderboard */}
        {isBiTopCustomersData && data.rankedCustomers.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center justify-between bg-slate-50 px-3.5 py-2">
              <span className="text-[11px] font-semibold text-slate-700">Top Outstanding Debtors ({data.rankedCustomers.length})</span>
              <span className="font-mono text-[10px] font-semibold text-violet-600">Portfolio: {data.totalDebtPortfolioFormatted}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-white text-[10px] uppercase text-slate-400">
                  <tr>
                    <th className="px-3.5 py-2 font-medium">Rank</th>
                    <th className="px-3.5 py-2 font-medium">Customer / Company</th>
                    <th className="px-3.5 py-2 font-medium">Total Balance</th>
                    <th className="px-3.5 py-2 font-medium">Overdue</th>
                    <th className="px-3.5 py-2 font-medium">Pending</th>
                    <th className="px-3.5 py-2 font-medium">Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.rankedCustomers.map((c: any) => (
                    <tr key={c.customerId} className="hover:bg-slate-50/50">
                      <td className="px-3.5 py-2.5 font-bold text-slate-500">#{c.rank}</td>
                      <td className="px-3.5 py-2.5">
                        <div className="font-medium text-slate-800">{c.name}</div>
                        <div className="text-[10px] text-slate-400">{c.company}</div>
                      </td>
                      <td className="px-3.5 py-2.5 font-mono font-bold text-violet-600">{c.totalOutstandingFormatted}</td>
                      <td className="px-3.5 py-2.5 font-mono text-rose-600">{c.overdueAmountFormatted}</td>
                      <td className="px-3.5 py-2.5 font-mono text-amber-600">{c.pendingAmountFormatted}</td>
                      <td className="px-3.5 py-2.5">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">{c.aiHealthScore}/100</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3.3 BI: Revenue Performance Metrics */}
        {isBiRevenueData && (
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 shadow-sm">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Total Billed</span>
              <p className="mt-1 font-mono text-base font-bold text-slate-800">{data.totalBilledFormatted}</p>
              <span className="text-[10px] text-slate-400">{data.totalInvoicesCount} invoices</span>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 shadow-sm">
              <span className="text-[10px] font-semibold text-emerald-700 uppercase">Total Collected</span>
              <p className="mt-1 font-mono text-base font-bold text-emerald-800">{data.totalCollectedFormatted}</p>
              <span className="text-[10px] text-emerald-600">{data.collectionRatePercent}% collected</span>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 shadow-sm">
              <span className="text-[10px] font-semibold text-amber-700 uppercase">Outstanding Debt</span>
              <p className="mt-1 font-mono text-base font-bold text-amber-800">{data.totalOutstandingFormatted}</p>
              <span className="text-[10px] text-amber-600">Pending + Overdue</span>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 shadow-sm">
              <span className="text-[10px] font-semibold text-blue-700 uppercase">Active Accounts</span>
              <p className="mt-1 font-mono text-base font-bold text-blue-800">{data.activeCustomersCount}</p>
              <span className="text-[10px] text-blue-600">Current Clients</span>
            </div>
          </div>
        )}

        {/* 3.4 Customer Summary Card */}
        {isCustomerSummaryData && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 font-bold text-violet-600">
                  {data.customer.avatar || data.customer.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">{data.customer.name}</h4>
                  <p className="text-[11px] text-slate-500">{data.customer.company} • {data.customer.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">Health: {data.customer.aiHealthScore}/100</span>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold capitalize text-emerald-700">{data.customer.status}</span>
              </div>
            </div>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-2.5">
                <span className="text-[10px] text-slate-400">Total Billed</span>
                <p className="font-mono text-xs font-bold text-slate-700">{data.financialSummary.totalBilledFormatted}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-2.5">
                <span className="text-[10px] text-emerald-600">Settled (Paid)</span>
                <p className="font-mono text-xs font-bold text-emerald-700">{data.financialSummary.totalPaidFormatted}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-2.5">
                <span className="text-[10px] text-amber-600">Outstanding Balance</span>
                <p className="font-mono text-xs font-bold text-amber-700">{data.financialSummary.totalOutstandingFormatted}</p>
              </div>
              <div className="rounded-lg bg-rose-50 p-2.5">
                <span className="text-[10px] text-rose-600">Overdue Debt</span>
                <p className="font-mono text-xs font-bold text-rose-700">{data.financialSummary.totalOverdueFormatted}</p>
              </div>
            </div>
          </div>
        )}

        {/* 3.5 Customer Outstanding Balance Card */}
        {isCustomerBalanceData && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/60 pb-2.5">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">Outstanding Balance Summary</h4>
                <p className="mt-0.5 text-xs text-amber-800">{data.customer.name} ({data.customer.company})</p>
              </div>
              <span className="font-mono text-base font-bold text-amber-950">{data.totalOutstandingFormatted}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-amber-900">
              <span>Overdue: <strong>{data.overdueAmountFormatted}</strong></span>
              <span>Pending: <strong>{data.pendingAmountFormatted}</strong></span>
              <span>Unpaid Invoices: <strong>{data.unpaidInvoiceCount}</strong></span>
            </div>
          </div>
        )}

        {/* 3.6 Customers With Outstanding Invoices Leaderboard */}
        {isCustomersWithOutstandingData && data.customers.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center justify-between bg-slate-50 px-3.5 py-2">
              <span className="text-[11px] font-semibold text-slate-700">Customers With Balances ({data.customers.length})</span>
              <span className="font-mono text-[10px] font-semibold text-amber-700">Total: {data.totalOutstandingPortfolioFormatted}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-white text-[10px] uppercase text-slate-400">
                  <tr>
                    <th className="px-3.5 py-2 font-medium">Customer / Company</th>
                    <th className="px-3.5 py-2 font-medium">Outstanding Balance</th>
                    <th className="px-3.5 py-2 font-medium">Overdue</th>
                    <th className="px-3.5 py-2 font-medium">Pending</th>
                    <th className="px-3.5 py-2 font-medium">Invoices</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.customers.map((c: any) => (
                    <tr key={c.id} className="hover:bg-slate-50/50">
                      <td className="px-3.5 py-2.5 font-medium text-slate-800">
                        {c.name} <span className="text-slate-400 font-normal">({c.company})</span>
                      </td>
                      <td className="px-3.5 py-2.5 font-mono font-bold text-amber-600">{c.outstandingAmountFormatted}</td>
                      <td className="px-3.5 py-2.5 font-mono text-rose-600">{c.overdueAmountFormatted}</td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-600">{c.pendingAmountFormatted}</td>
                      <td className="px-3.5 py-2.5 text-slate-500">{c.unpaidInvoiceCount} unpaid</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3.7 Single Invoice Summary Detail Card */}
        {isInvoiceSummaryData && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-violet-600">{data.invoice.invoiceNumber}</span>
                <h4 className="font-semibold text-slate-800">{data.invoice.clientName} ({data.invoice.clientCompany})</h4>
              </div>
              <div className="text-right">
                <p className="font-mono text-base font-bold text-slate-900">{data.invoice.amount}</p>
                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${
                  data.invoice.status === "paid" ? "bg-emerald-50 text-emerald-700" :
                  data.invoice.status === "overdue" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
                }`}>
                  {data.invoice.status}
                </span>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs text-slate-600">
              <div>Issued: <strong>{data.invoice.issueDate}</strong></div>
              <div>Due: <strong>{data.invoice.dueDate}</strong></div>
              <div>Auto-Remind: <strong>{data.invoice.autoRemind ? "Enabled" : "Disabled"}</strong></div>
            </div>
            {data.dueDateStatus?.isOverdue && (
              <div className="mt-2.5 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
                ⚠️ Invoice is overdue by <strong>{data.dueDateStatus.daysOverdue} day(s)</strong>.
              </div>
            )}
          </div>
        )}

        {/* 3.8 Invoice Status Portfolio Summary Card */}
        {isInvoiceStatusSummaryData && (
          <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Portfolio Status Breakdown</h4>
              <span className="text-xs text-emerald-600 font-semibold">Collection Rate: {data.collectionRatePercent}%</span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">Paid Invoices</span>
                <p className="mt-1 font-mono text-base font-bold text-emerald-900">{data.statusBreakdown.paid.formattedAmount}</p>
                <span className="text-[10px] text-emerald-700">{data.statusBreakdown.paid.count} invoices ({data.statusBreakdown.paid.percentageOfAmount}%)</span>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                <span className="text-[10px] font-bold text-amber-700 uppercase">Pending Invoices</span>
                <p className="mt-1 font-mono text-base font-bold text-amber-900">{data.statusBreakdown.pending.formattedAmount}</p>
                <span className="text-[10px] text-amber-700">{data.statusBreakdown.pending.count} invoices ({data.statusBreakdown.pending.percentageOfAmount}%)</span>
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3">
                <span className="text-[10px] font-bold text-rose-700 uppercase">Overdue Invoices</span>
                <p className="mt-1 font-mono text-base font-bold text-rose-900">{data.statusBreakdown.overdue.formattedAmount}</p>
                <span className="text-[10px] text-rose-700">{data.statusBreakdown.overdue.count} invoices ({data.statusBreakdown.overdue.percentageOfAmount}%)</span>
              </div>
            </div>
          </div>
        )}

        {/* 3.9 Customer Search Records Table */}
        {isCustomerSearchData && data.customers.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="bg-slate-50 px-3.5 py-2 text-[11px] font-semibold text-slate-700">
              Matched Customer Directory Records ({data.customers.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-white text-[10px] uppercase text-slate-400">
                  <tr>
                    <th className="px-3.5 py-2 font-medium">Customer</th>
                    <th className="px-3.5 py-2 font-medium">Company</th>
                    <th className="px-3.5 py-2 font-medium">Email</th>
                    <th className="px-3.5 py-2 font-medium">Spend</th>
                    <th className="px-3.5 py-2 font-medium">Health Score</th>
                    <th className="px-3.5 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.customers.map((c: AgentCustomerItem) => (
                    <tr key={c.id} className="hover:bg-slate-50/50">
                      <td className="whitespace-nowrap px-3.5 py-2.5 font-medium text-slate-800">
                        {c.name}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 text-slate-600">
                        {c.company}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 text-slate-500">
                        {c.email}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 font-mono text-slate-700">
                        {c.totalSpend}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 text-slate-700">
                        <span className="font-semibold">{c.aiHealthScore}</span>/100
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5">
                        <span
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${
                            c.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3.10 Invoices Table (Search, Overdue, Outstanding, History) */}
        {isInvoiceData && data.invoices.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="bg-slate-50 px-3.5 py-2 text-[11px] font-semibold text-slate-700">
              Matched Financial Invoices ({data.invoices.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-white text-[10px] uppercase text-slate-400">
                  <tr>
                    <th className="px-3.5 py-2 font-medium">Invoice Number</th>
                    <th className="px-3.5 py-2 font-medium">Client / Company</th>
                    <th className="px-3.5 py-2 font-medium">Amount</th>
                    <th className="px-3.5 py-2 font-medium">Due Date</th>
                    <th className="px-3.5 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.invoices.map((inv: AgentInvoiceItem) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50">
                      <td className="whitespace-nowrap px-3.5 py-2.5 font-mono font-semibold text-violet-600">
                        {inv.invoiceNumber}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 text-slate-700">
                        <div className="font-medium text-slate-800">{inv.clientName}</div>
                        <div className="text-[10px] text-slate-400">{inv.clientCompany}</div>
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 font-mono font-medium text-slate-800">
                        {inv.amount}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 text-slate-500">
                        {inv.dueDate}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5">
                        <span
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${
                            inv.status === "paid"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : inv.status === "overdue"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3.11 Cynbit DeliveryOps: Project Risk Analysis */}
        {isProjectRiskData && (
          <div className="mt-4 space-y-3">
            {/* Case A: Portfolio Risk Ranking */}
            {data.portfolioRiskRanking && Array.isArray(data.portfolioRiskRanking) && (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="flex items-center justify-between bg-slate-50 px-3.5 py-2.5 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-600" />
                    <span className="text-xs font-bold text-slate-800">
                      DeliveryOps Portfolio Risk Ranking ({data.portfolioRiskRanking.length} Projects)
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">Deterministic Server Risk Engine</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-white text-[10px] uppercase text-slate-400">
                      <tr>
                        <th className="px-3.5 py-2 font-medium">Project</th>
                        <th className="px-3.5 py-2 font-medium">Client</th>
                        <th className="px-3.5 py-2 font-medium">Risk Level</th>
                        <th className="px-3.5 py-2 font-medium">Risk Score</th>
                        <th className="px-3.5 py-2 font-medium">Health</th>
                        <th className="px-3.5 py-2 font-medium">Blockers</th>
                        <th className="px-3.5 py-2 font-medium">Delayed MS</th>
                        <th className="px-3.5 py-2 font-medium">Key Risk Driver</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {data.portfolioRiskRanking.map((p: any) => (
                        <tr key={p.projectId} className="hover:bg-slate-50/50">
                          <td className="px-3.5 py-2.5">
                            <span className="font-mono text-xs font-bold text-violet-600">{p.projectId}</span>
                            <div className="font-medium text-slate-800 text-[11px] truncate max-w-[150px]">{p.projectName}</div>
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-600 text-[11px]">{p.clientCompany}</td>
                          <td className="px-3.5 py-2.5">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                p.overallRiskLevel === "CRITICAL"
                                  ? "bg-rose-100 text-rose-800 border border-rose-200"
                                  : p.overallRiskLevel === "HIGH"
                                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                                  : p.overallRiskLevel === "MEDIUM"
                                  ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
                                  : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              }`}
                            >
                              {p.overallRiskLevel}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 font-mono font-bold text-slate-800">{p.riskScore}/100</td>
                          <td className="px-3.5 py-2.5 font-mono text-slate-700">{p.healthScore}/100</td>
                          <td className="px-3.5 py-2.5">
                            <span className={p.openBlockersCount > 0 ? "font-bold text-rose-600" : "text-slate-500"}>
                              {p.openBlockersCount}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span className={p.delayedMilestonesCount > 0 ? "font-bold text-amber-600" : "text-slate-500"}>
                              {p.delayedMilestonesCount}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-[11px] text-slate-500 max-w-[200px] truncate" title={p.keyRiskDriver}>
                            {p.keyRiskDriver}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Case B: Single Project Risk Analysis */}
            {data.projectId && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded border border-violet-100">
                      {data.projectId}
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{data.projectName}</h4>
                      <p className="text-[11px] text-slate-500">{data.clientCompany}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                        data.overallRiskLevel === "CRITICAL"
                          ? "bg-rose-100 text-rose-800 border border-rose-200"
                          : data.overallRiskLevel === "HIGH"
                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                          : data.overallRiskLevel === "MEDIUM"
                          ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
                          : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      {data.overallRiskLevel} RISK ({data.riskScore}/100)
                    </span>
                  </div>
                </div>

                {/* Breakdown Stats */}
                {data.breakdown && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Health Score</span>
                      <p className="font-mono text-sm font-bold text-slate-800 mt-0.5">{data.breakdown.healthScore}/100</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Milestone Progress</span>
                      <p className="font-mono text-sm font-bold text-indigo-600 mt-0.5">{data.breakdown.milestones?.avgProgress}%</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Delayed Milestones</span>
                      <p className="font-mono text-sm font-bold text-amber-600 mt-0.5">{data.breakdown.milestones?.delayed} of {data.breakdown.milestones?.total}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Open Blockers</span>
                      <p className="font-mono text-sm font-bold text-rose-600 mt-0.5">
                        {data.breakdown.openBlockers?.total} ({data.breakdown.openBlockers?.critical} crit, {data.breakdown.openBlockers?.high} high)
                      </p>
                    </div>
                  </div>
                )}

                {/* Evidence List */}
                {data.evidence && Array.isArray(data.evidence) && data.evidence.length > 0 && (
                  <div className="rounded-lg bg-slate-50 p-3 border border-slate-100 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      Authoritative Risk Evidence (Server-Side)
                    </span>
                    <ul className="space-y-1 text-xs text-slate-700">
                      {data.evidence.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-amber-500 font-bold">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Grounded Recommendations */}
                {data.recommendations && Array.isArray(data.recommendations) && data.recommendations.length > 0 && (
                  <div className="rounded-lg bg-indigo-50/50 p-3 border border-indigo-100 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-indigo-700 tracking-wider">
                      Grounded Operational Recommendations
                    </span>
                    <ul className="space-y-1 text-xs text-indigo-900">
                      {data.recommendations.map((rec: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-indigo-600 font-bold">✓</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3.12 Cynbit DeliveryOps: Project Search Table */}
        {isProjectSearchData && data.projects.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="bg-slate-50 px-3.5 py-2 text-[11px] font-semibold text-slate-700 flex items-center justify-between">
              <span>Matched Delivery Projects ({data.projects.length})</span>
              <span className="text-[10px] text-slate-500">PostgreSQL Authoritative Records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-white text-[10px] uppercase text-slate-400">
                  <tr>
                    <th className="px-3.5 py-2 font-medium">Project</th>
                    <th className="px-3.5 py-2 font-medium">Client</th>
                    <th className="px-3.5 py-2 font-medium">Status</th>
                    <th className="px-3.5 py-2 font-medium">Health</th>
                    <th className="px-3.5 py-2 font-medium">Lead</th>
                    <th className="px-3.5 py-2 font-medium">Target Date</th>
                    <th className="px-3.5 py-2 font-medium">Milestones</th>
                    <th className="px-3.5 py-2 font-medium">Blockers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.projects.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="px-3.5 py-2.5">
                        <span className="font-mono text-xs font-bold text-violet-600">{p.id}</span>
                        <div className="font-medium text-slate-800 text-[11px] truncate max-w-[160px]">{p.name}</div>
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600">{p.clientCompany || p.clientName || "—"}</td>
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            p.status === "on_track"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : p.status === "at_risk"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 font-mono font-bold text-slate-700">{p.healthScore}/100</td>
                      <td className="px-3.5 py-2.5 text-slate-600">{p.deliveryLead}</td>
                      <td className="px-3.5 py-2.5 text-slate-500">{p.targetDate}</td>
                      <td className="px-3.5 py-2.5 text-slate-600">{p.milestoneCount}</td>
                      <td className="px-3.5 py-2.5">
                        <span className={p.openBlockerCount > 0 ? "font-bold text-rose-600" : "text-slate-500"}>
                          {p.openBlockerCount}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3.13 Cynbit DeliveryOps: Project Summary */}
        {isProjectSummaryData && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded border border-violet-100">
                  {data.project.id}
                </span>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{data.project.name}</h4>
                  <p className="text-[11px] text-slate-500">
                    Client: {data.project.customer?.company || "—"} • Lead: {data.project.deliveryLead}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                  {data.project.status}
                </span>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  Health: {data.project.healthScore}/100
                </span>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="rounded-lg bg-slate-50 p-2.5">
                <span className="text-[10px] uppercase font-bold text-slate-400">Target Date</span>
                <p className="font-semibold text-slate-800 mt-0.5">{data.project.targetDate}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5">
                <span className="text-[10px] uppercase font-bold text-slate-400">Budget</span>
                <p className="font-semibold text-slate-800 mt-0.5">{data.project.budget || "—"}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5">
                <span className="text-[10px] uppercase font-bold text-slate-400">Avg Progress</span>
                <p className="font-semibold text-indigo-600 mt-0.5">
                  {data.project.deliveryIndicators?.milestoneProgressAvg ?? 0}%
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5">
                <span className="text-[10px] uppercase font-bold text-slate-400">Open Blockers</span>
                <p className="font-semibold text-rose-600 mt-0.5">
                  {data.project.deliveryIndicators?.openBlockersCount ?? data.project.openBlockers?.length ?? 0}
                </p>
              </div>
            </div>

            {/* Milestones preview if any */}
            {data.project.milestones && data.project.milestones.length > 0 && (
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Milestones</span>
                <div className="mt-1.5 space-y-1.5">
                  {data.project.milestones.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-slate-400 font-bold">{m.id}</span>
                        <span className="font-medium text-slate-800">{m.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-[11px]">{m.dueDate}</span>
                        <span className="font-bold text-slate-700">{m.progressPercent}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3.14 Cynbit DeliveryOps: Blockers List */}
        {isProjectBlockersData && data.blockers.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border border-rose-200 bg-white">
            <div className="bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-900 border-b border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-rose-600" />
                <span>Active Delivery Blockers ({data.blockers.length})</span>
              </div>
              <span className="text-[10px] font-normal text-rose-700">Project: {data.projectName || data.projectId}</span>
            </div>
            <div className="p-3.5 space-y-2.5">
              {data.blockers.map((b: any) => (
                <div key={b.id} className="rounded-lg border border-slate-200 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {b.id}
                      </span>
                      <span className="font-bold text-slate-900">{b.title}</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        b.severity === "CRITICAL"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {b.severity}
                    </span>
                  </div>
                  <p className="text-slate-600">{b.description}</p>
                  <div className="text-[11px] text-rose-700 font-medium pt-1 border-t border-slate-100">
                    Impact: {b.impact}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3.15 Cynbit DeliveryOps: Cross-Domain Client Delivery Summary */}
        {isClientDeliveryData && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  {data.customer.name} ({data.customer.company})
                </h4>
                <p className="text-[11px] text-slate-500">{data.customer.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 border border-indigo-200">
                  Delivery Posture: {data.summary?.deliveryRiskPosture || "ANALYZED"}
                </span>
              </div>
            </div>

            {/* Cross-domain summary pills */}
            {data.summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Projects</span>
                  <p className="font-mono text-sm font-bold text-slate-800 mt-0.5">{data.summary.totalProjects}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">At Risk Projects</span>
                  <p className="font-mono text-sm font-bold text-amber-600 mt-0.5">{data.summary.atRiskOrDelayedProjects}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Overdue Invoices</span>
                  <p className="font-mono text-sm font-bold text-rose-600 mt-0.5">{data.summary.totalOverdueInvoices}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Overdue AR Amount</span>
                  <p className="font-mono text-sm font-bold text-rose-600 mt-0.5">{data.summary.totalOverdueAmountFormatted || "₹0"}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3.16 Cynbit DeliveryOps: Prepared Client Follow-up Details */}
        {isPrepareFollowupData && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-amber-200 pb-2">
              <div className="flex items-center gap-2">
                <ShieldAlert size={16} className="text-amber-600" />
                <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                  Grounded Client Follow-up Proposal
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-amber-900">
                {data.approvalId || approvalId}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-amber-700 uppercase font-semibold">Target Client:</span>
                <p className="font-bold text-slate-800">{data.customer || data.company}</p>
              </div>
              <div>
                <span className="text-[10px] text-amber-700 uppercase font-semibold">Project & Risk:</span>
                <p className="font-bold text-slate-800">
                  {data.project} (Risk: {data.riskLevel || "MEDIUM"})
                </p>
              </div>
              <div>
                <span className="text-[10px] text-amber-700 uppercase font-semibold">Recipient:</span>
                <p className="font-mono text-slate-700">{data.proposedRecipient || data.recipientEmail}</p>
              </div>
              <div>
                <span className="text-[10px] text-amber-700 uppercase font-semibold">Subject Line:</span>
                <p className="font-semibold text-slate-800">{data.proposedSubject || data.subject}</p>
              </div>
            </div>

            {(data.proposedMessage || data.message) && (
              <div className="rounded-lg bg-white border border-amber-200 p-3">
                <span className="text-[10px] uppercase font-bold text-slate-400">Draft Message Preview:</span>
                <p className="mt-1 font-mono text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {data.proposedMessage || data.message}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-amber-800 font-medium">
              <span>⚠️ Zero external emails dispatched. Human authorization required before execution.</span>
              <button
                onClick={() => navigate(`/approvals?id=${data.approvalId || approvalId}`)}
                className="flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 transition"
              >
                <span>Authorize in Approvals</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        )}

        {/* 4. UNSUPPORTED CAPABILITY GUIDANCE */}
        {outcome === "UNSUPPORTED_REQUEST" && (
          <div className="mt-3.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-violet-600" />
              <span className="text-xs font-semibold text-slate-800">
                Supported Operations Guide
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              BizOps AI is designed for governed operations. Try one of these query patterns:
            </p>
            <div className="mt-2 grid gap-1.5 text-xs text-slate-600">
              <span className="font-mono text-[11px] bg-white px-2 py-1 rounded border border-slate-200">
                • "Find customer Acme Technologies"
              </span>
              <span className="font-mono text-[11px] bg-white px-2 py-1 rounded border border-slate-200">
                • "Show all unpaid invoices above ₹50,000"
              </span>
              <span className="font-mono text-[11px] bg-white px-2 py-1 rounded border border-slate-200">
                • "Send reminder for invoice INV-1001"
              </span>
            </div>
          </div>
        )}

        {/* 5. FAILURE & RETRY ACTION */}
        {(outcome === "TOOL_EXECUTION_FAILURE" || outcome === "INTERNAL_FAILURE") && (
          <div className="mt-3.5 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <span>The requested business operation could not be completed safely.</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Outcome Badge Component
 * Displays distinct visual indicators for each outcome type
 */
function OutcomeBadge({
  outcome,
  approvalRequired,
}: {
  outcome: AgentOutcomeType;
  approvalRequired?: boolean;
}) {
  if (approvalRequired || outcome === "APPROVAL_REQUIRED") {
    return (
      <span className="flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
        <ShieldAlert size={11} className="text-amber-600" />
        APPROVAL REQUIRED
      </span>
    );
  }

  if (outcome === "READ_ONLY_RESULT") {
    return (
      <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
        <CheckCircle2 size={11} className="text-emerald-600" />
        REQUEST COMPLETED
      </span>
    );
  }

  if (outcome === "UNSUPPORTED_REQUEST") {
    return (
      <span className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
        <Sparkles size={11} className="text-slate-500" />
        UNSUPPORTED FEATURE
      </span>
    );
  }

  if (outcome === "INVALID_REQUEST") {
    return (
      <span className="flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
        <AlertCircle size={11} className="text-rose-500" />
        INVALID REQUEST
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-800 border border-rose-200">
      <AlertCircle size={11} className="text-rose-600" />
      OPERATION FAILED
    </span>
  );
}

function Suggestion({
  text,
  description,
  onClick,
}: {
  text: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-800">{text}</span>
        <ArrowRight size={12} className="text-slate-400" />
      </div>
      <span className="mt-1 text-[10px] text-slate-400">{description}</span>
    </button>
  );
}

function StepIcon({
  status,
  icon: Icon,
}: {
  status: StepStatus;
  icon: React.ElementType;
}) {
  if (status === "completed") {
    return (
      <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-4 border-white bg-emerald-500 text-white">
        <Check size={13} strokeWidth={3} />
      </div>
    );
  }

  if (status === "running") {
    return (
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
        className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-4 border-white bg-violet-600 text-white shadow-lg shadow-violet-500/30"
      >
        <Icon size={13} />
      </motion.div>
    );
  }

  if (status === "approval") {
    return (
      <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-4 border-white bg-amber-500 text-white shadow-lg shadow-amber-500/20">
        <ShieldAlert size={14} />
      </div>
    );
  }

  return (
    <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-4 border-white bg-slate-100 text-slate-400">
      <Icon size={13} />
    </div>
  );
}

function StatusBadge({ status }: { status: StepStatus }) {
  if (status === "completed") {
    return (
      <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600">
        <CheckCircle2 size={10} />
        Done
      </span>
    );
  }

  if (status === "running") {
    return (
      <span className="flex items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-600">
        <Clock3 size={10} />
        Active
      </span>
    );
  }

  if (status === "approval") {
    return (
      <span className="flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
        <ShieldAlert size={10} />
        Review
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">
      <Clock3 size={10} />
      Queued
    </span>
  );
}