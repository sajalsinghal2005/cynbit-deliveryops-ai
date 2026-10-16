import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Mail,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export type Risk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Approval {
  id: string;
  title: string;
  description: string;
  actionType: string;
  toolName: string;
  arguments: Record<string, any>;
  reason: string;
  customer: string;
  amount?: string;
  risk: Risk;
  relatedInvoiceId?: string;
  relatedCustomerId?: string;
  status: ApprovalStatus;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  executionStatus?: "NOT_EXECUTED" | "SUCCESS" | "FAILED";
  executionResult?: any;
}

function getActionIcon(actionType: string, toolName: string): React.ElementType {
  if (
    actionType === "SEND_INVOICE_REMINDER" ||
    toolName === "send-email" ||
    toolName === "prepare-client-followup"
  ) {
    return Mail;
  }
  if (actionType === "REFUND_PAYMENT" || toolName === "payment-refund") {
    return CreditCard;
  }
  if (actionType === "CANCEL_ORDER" || toolName === "order-cancel") {
    return XCircle;
  }
  return FileText;
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return "Just now";
    if (diffMins === 1) return "1 minute ago";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return "1 hour ago";
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  } catch {
    return "Recently";
  }
}

export default function Approvals() {
  const { user } = useAuth();
  const canDecide = user?.role === "ADMIN" || user?.role === "APPROVER";
  const [searchParams] = useSearchParams();
  const targetId = searchParams.get("id");

  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [selected, setSelected] = useState<Approval | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" } | null>(
    null,
  );
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const data = await api.get<{ success: boolean; approvals: Approval[] }>("/api/approvals");
      if (data.success && Array.isArray(data.approvals)) {
        setApprovals(data.approvals);
        // If query param targetId is present, select that item
        if (targetId) {
          const matched = data.approvals.find((a: Approval) => a.id.toUpperCase() === targetId.toUpperCase());
          if (matched) {
            setSelected(matched);
            if (matched.status !== "PENDING") {
              setFilter("all");
            }
            return;
          }
        }
        // If nothing selected or selected item was removed, select first available
        setSelected((prev) => {
          if (!prev) return data.approvals[0] || null;
          const found = data.approvals.find((a: Approval) => a.id === prev.id);
          return found || data.approvals[0] || null;
        });
      }
    } catch (err: any) {
      console.error("Failed to fetch approvals:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [targetId]);

  const showToast = (message: string, type: "success" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const handleApprove = async (id: string) => {
    if (!canDecide) {
      showToast("Approval decisions require APPROVER or ADMIN privileges.", "info");
      return;
    }
    try {
      setProcessingId(id);
      const data = await api.post<{ success: boolean; message?: string }>(
        `/api/approvals/${id}/approve`
      );

      if (!data.success) {
        showToast(data.message || "Failed to approve request", "info");
        return;
      }

      showToast(
        data.message || `Request ${id} approved and executed in safe simulation mode.`,
        "success",
      );

      // Refresh approvals
      await fetchApprovals();
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : "Network error while processing approval.";
      showToast(msg, "info");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!canDecide) {
      showToast("Approval decisions require APPROVER or ADMIN privileges.", "info");
      return;
    }
    try {
      setProcessingId(id);
      const data = await api.post<{ success: boolean; message?: string }>(
        `/api/approvals/${id}/reject`,
        { reason: "Rejected in Approval Center" }
      );

      if (!data.success) {
        showToast(data.message || "Failed to reject request", "info");
        return;
      }

      showToast(data.message || `Request ${id} rejected.`, "info");
      await fetchApprovals();
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : "Network error while rejecting approval.";
      showToast(msg, "info");
    } finally {
      setProcessingId(null);
    }
  };

  const pendingApprovals = approvals.filter((a) => a.status === "PENDING");
  const displayedApprovals =
    filter === "pending" ? pendingApprovals : approvals;

  return (
    <main className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-xl shadow-emerald-500/10 animate-in fade-in slide-in-from-bottom-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <Sparkles size={16} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-900">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="mb-7">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 text-amber-600">
            <ShieldAlert size={14} />
          </span>

          <span className="text-xs font-semibold text-amber-600">
            HUMAN IN THE LOOP
          </span>
        </div>

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
              Approval Center
            </h1>

            <p className="mt-1.5 text-sm text-slate-500">
              Review, authorize, or reject critical AI agent actions before backend execution.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Toggle */}
            <div className="flex rounded-xl border border-slate-200 bg-slate-100/80 p-1 text-xs font-medium">
              <button
                onClick={() => setFilter("pending")}
                className={`rounded-lg px-3 py-1.5 transition ${
                  filter === "pending"
                    ? "bg-white font-semibold text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Pending ({pendingApprovals.length})
              </button>
              <button
                onClick={() => setFilter("all")}
                className={`rounded-lg px-3 py-1.5 transition ${
                  filter === "all"
                    ? "bg-white font-semibold text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All ({approvals.length})
              </button>
            </div>

            <button
              onClick={fetchApprovals}
              disabled={loading}
              title="Refresh approvals"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-xs hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>

            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <Clock3 size={15} className="text-amber-500" />
              <span className="text-xs font-medium text-amber-700">
                {pendingApprovals.length} actions waiting
              </span>
            </div>
          </div>
        </div>
      </div>

      {displayedApprovals.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          {/* Approval list */}
          <div className="space-y-3">
            {displayedApprovals.map((approval) => (
              <ApprovalListItem
                key={approval.id}
                approval={approval}
                selected={selected?.id === approval.id}
                onClick={() => setSelected(approval)}
              />
            ))}
          </div>

          {/* Details */}
          <AnimatePresence mode="wait">
            {selected && (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="h-fit rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <ApprovalDetails
                  approval={selected}
                  canDecide={canDecide}
                  isProcessing={processingId === selected.id}
                  onApprove={() => handleApprove(selected.id)}
                  onReject={() => handleReject(selected.id)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </main>
  );
}

function ApprovalListItem({
  approval,
  selected,
  onClick,
}: {
  approval: Approval;
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = getActionIcon(approval.actionType, approval.toolName);

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border bg-white p-5 text-left shadow-sm transition ${
        selected
          ? "border-violet-300 ring-4 ring-violet-500/5"
          : "border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
      }`}
    >
      <div className="flex gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            approval.risk === "HIGH" || approval.risk === "CRITICAL"
              ? "bg-red-50 text-red-500"
              : "bg-amber-50 text-amber-500"
          }`}
        >
          <Icon size={19} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              {approval.title}
            </h2>

            <RiskBadge risk={approval.risk} />

            {approval.status !== "PENDING" && (
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                  approval.status === "APPROVED"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {approval.status}
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-slate-500">
            {approval.description}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <UserRound size={12} />
              {approval.customer}
            </span>

            {approval.amount && (
              <span className="text-[11px] font-semibold text-slate-700">
                {approval.amount}
              </span>
            )}

            <span className="text-[10px] text-slate-400">
              {formatRelativeTime(approval.createdAt)}
            </span>
          </div>
        </div>

        <ArrowRight
          size={16}
          className={`mt-1 shrink-0 ${
            selected ? "text-violet-500" : "text-slate-300"
          }`}
        />
      </div>
    </button>
  );
}

function ApprovalDetails({
  approval,
  canDecide = true,
  isProcessing,
  onApprove,
  onReject,
}: {
  approval: Approval;
  canDecide?: boolean;
  isProcessing: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const Icon = getActionIcon(approval.actionType, approval.toolName);
  const isDecided = approval.status !== "PENDING";

  return (
    <div>
      {/* Header */}
      <div className="border-b border-slate-100 p-5">
        <div className="flex items-start justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
              <Icon size={18} />
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Approval request • {approval.id}
              </p>

              <h2 className="mt-1 text-base font-semibold text-slate-900">
                {approval.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <RiskBadge risk={approval.risk} />
            {isDecided && (
              <span
                className={`rounded-md px-2 py-1 text-[9px] font-bold tracking-wide ${
                  approval.status === "APPROVED"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {approval.status}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Why */}
      <div className="p-5">
        <SectionTitle title="Why does AI need to do this?" />

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs leading-5 text-slate-600">
            {approval.reason}
          </p>
        </div>

        {/* Action summary */}
        <div className="mt-6">
          <SectionTitle title="Action details" />

          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            <DetailRow label="Target Client" value={approval.customer} />

            {approval.amount && (
              <DetailRow label="Amount Involved" value={approval.amount} />
            )}

            <DetailRow label="Tool Name" value={approval.toolName} />

            <DetailRow label="Action Type" value={approval.actionType} />

            <DetailRow label="Request ID" value={approval.id} />

            <DetailRow
              label="Requester"
              value={
                approval.arguments?.requestedBy?.name
                  ? `${approval.arguments.requestedBy.name} (${approval.arguments.requestedBy.email})`
                  : "AI Agent / Operator"
              }
            />

            <DetailRow label="Approval Status" value={approval.status} />

            <DetailRow
              label="Execution Status"
              value={approval.executionStatus || "NOT_EXECUTED"}
            />

            <DetailRow label="Created Time" value={new Date(approval.createdAt).toLocaleString()} />

            {approval.decidedAt && (
              <DetailRow label="Decision Time" value={new Date(approval.decidedAt).toLocaleString()} />
            )}

            {approval.decidedBy && (
              <DetailRow label="Deciding Actor" value={approval.decidedBy} />
            )}
          </div>
        </div>

        {/* If this is a Client Follow-Up proposal */}
        {approval.toolName === "prepare-client-followup" && approval.arguments && (
          <div className="mt-6">
            <SectionTitle title="Proposed Client Follow-Up" />
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 flex items-start gap-2.5">
                <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <p className="font-bold">Human Approval Strictly Required</p>
                  <p className="mt-0.5 text-amber-800 text-[11px] leading-relaxed">
                    Zero external emails have been sent. The AI agent prepared this grounded proposal based on authoritative delivery risk and blocker records. Execution occurs only after human authorization.
                  </p>
                </div>
              </div>

              {/* Context Summary Cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Project</span>
                  <p className="mt-1 text-xs font-semibold text-slate-800 truncate" title={approval.arguments.projectName || approval.arguments.projectId}>
                    {approval.arguments.projectName || approval.arguments.projectId || "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Project Status</span>
                  <p className="mt-1 text-xs font-semibold text-slate-800">
                    {approval.arguments.projectStatus || "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Risk Assessment</span>
                  <p className="mt-1 text-xs font-semibold text-slate-800">
                    {approval.arguments.overallRiskLevel || approval.risk} ({approval.arguments.riskScore ?? "—"}/100)
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Open Blockers</span>
                  <p className="mt-1 text-xs font-semibold text-slate-800">
                    {approval.arguments.openBlockersCount ?? (approval.arguments.openBlockers?.length || 0)} active
                  </p>
                </div>
              </div>

              {/* Email Preview Card */}
              <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
                <div className="flex items-center justify-between border-b border-violet-100 pb-2">
                  <span className="text-[11px] font-semibold text-violet-900">
                    Proposed Recipient: <span className="font-mono text-violet-700">{approval.arguments.recipientEmail}</span>
                  </span>
                  <span className="rounded bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                    Draft Message
                  </span>
                </div>
                <div className="pt-2">
                  <p className="text-xs font-bold text-slate-800">
                    Subject: {approval.arguments.subject}
                  </p>
                  <div className="mt-2.5 rounded-lg border border-slate-200/80 bg-white p-3 font-mono text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap">
                    {approval.arguments.message}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tool arguments */}
        <div className="mt-6">
          <SectionTitle title="Execution parameters" />

          <div className="mt-3 overflow-hidden rounded-xl bg-slate-950 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-medium text-slate-500">
                TOOL ARGUMENTS
              </span>

              <FileText size={12} className="text-slate-600" />
            </div>

            <pre className="overflow-x-auto text-[11px] leading-5 text-emerald-400 font-mono">
              {JSON.stringify(approval.arguments, null, 2)}
            </pre>
          </div>
        </div>

        {/* Execution Result if already decided */}
        {approval.executionResult && (
          <div className="mt-6">
            <SectionTitle title="Execution outcome (Simulation)" />

            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                <CheckCircle2 size={15} />
                <span>Action Executed in Demo Mode</span>
              </div>
              <p className="mt-1 text-xs text-emerald-700">
                {approval.executionResult.message || JSON.stringify(approval.executionResult)}
              </p>
            </div>
          </div>
        )}

        {/* Warning if still pending */}
        {!isDecided && (
          <div className="mt-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertTriangle
              size={17}
              className="mt-0.5 shrink-0 text-red-500"
            />

            <div>
              <p className="text-xs font-semibold text-red-800">
                Critical action
              </p>

              <p className="mt-1 text-[11px] leading-5 text-red-600">
                Approving this request will allow the backend agent to execute the
                protected action with the parameters shown above.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-slate-100 bg-slate-50/70 p-5">
        {!isDecided ? (
          <>
            {canDecide ? (
              <>
                <div className="flex gap-3">
                  <button
                    disabled={isProcessing}
                    onClick={onReject}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 cursor-pointer"
                  >
                    <X size={15} />
                    {isProcessing ? "Processing..." : "Reject"}
                  </button>

                  <button
                    disabled={isProcessing}
                    onClick={onApprove}
                    className="flex flex-[1.5] items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-50 cursor-pointer"
                  >
                    <Check size={15} />
                    {isProcessing ? "Authorizing..." : "Approve Action"}
                  </button>
                </div>

                <p className="mt-3 text-center text-[10px] text-slate-400">
                  By approving, you authorize BizOps AI to execute this backend action.
                </p>
              </>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-center text-xs text-amber-800">
                <p className="font-semibold flex items-center justify-center gap-1.5">
                  <ShieldAlert size={14} className="text-amber-600" />
                  <span>Operator View-Only Mode</span>
                </p>
                <p className="mt-1 text-[11px] text-amber-700 leading-relaxed">
                  Deciding critical proposals requires an Approver or Administrator account.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 py-2.5 text-xs font-medium text-slate-600">
            {approval.status === "APPROVED" ? (
              <>
                <CheckCircle2 size={15} className="text-emerald-600" />
                <span>Decision recorded: Approved by {approval.decidedBy}</span>
              </>
            ) : (
              <>
                <XCircle size={15} className="text-slate-500" />
                <span>Decision recorded: Rejected by {approval.decidedBy}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
      {title}
    </h3>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-0">
      <span className="text-[11px] text-slate-400">{label}</span>

      <span className="max-w-[60%] truncate text-[11px] font-medium text-slate-700">
        {value}
      </span>
    </div>
  );
}

function RiskBadge({ risk }: { risk: Risk }) {
  return (
    <span
      className={`rounded-md px-2 py-1 text-[9px] font-bold tracking-wide ${
        risk === "HIGH" || risk === "CRITICAL"
          ? "bg-red-50 text-red-600"
          : "bg-amber-50 text-amber-600"
      }`}
    >
      {risk} RISK
    </span>
  );
}

function EmptyState({ filter }: { filter: "pending" | "all" }) {
  return (
    <div className="flex min-h-[500px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white text-center shadow-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
        <CheckCircle2 size={30} />
      </div>

      <h2 className="mt-5 text-lg font-semibold text-slate-900">
        {filter === "pending" ? "All caught up" : "No approval records found"}
      </h2>

      <p className="mt-2 max-w-sm text-sm text-slate-500">
        {filter === "pending"
          ? "There are no pending critical actions waiting for review. BizOps AI can continue operating safely."
          : "No approval requests have been generated yet."}
      </p>
    </div>
  );
}