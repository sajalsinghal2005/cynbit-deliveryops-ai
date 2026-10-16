import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  FileText,
  Mail,
  Search,
  Shield,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Risk = "LOW" | "MEDIUM" | "CRITICAL";

type Tool = {
  id: string;
  name: string;
  description: string;
  category: string;
  risk: Risk;
  status: "ACTIVE" | "DISABLED";
  executions: number;
  lastUsed: string;
  icon: React.ElementType;
};

const tools: Tool[] = [
  // CRM Tools
  {
    id: "customer-search",
    name: "Search Customers",
    description: "Find customers using name, email, company, or customer ID.",
    category: "CRM",
    risk: "LOW",
    status: "ACTIVE",
    executions: 482,
    lastUsed: "Just now",
    icon: Users,
  },
  {
    id: "customer-summary",
    name: "Customer Summary",
    description: "Retrieve comprehensive customer profile and aggregated invoice financial summary.",
    category: "CRM",
    risk: "LOW",
    status: "ACTIVE",
    executions: 247,
    lastUsed: "4 min ago",
    icon: UserRound,
  },
  {
    id: "customer-invoice-history",
    name: "Customer Invoice History",
    description: "Retrieve complete invoice transaction history for a specific customer.",
    category: "CRM",
    risk: "LOW",
    status: "ACTIVE",
    executions: 189,
    lastUsed: "12 min ago",
    icon: FileText,
  },
  {
    id: "customer-outstanding-balance",
    name: "Customer Outstanding Balance",
    description: "Calculate exact outstanding and overdue invoice balance for a customer.",
    category: "CRM",
    risk: "LOW",
    status: "ACTIVE",
    executions: 312,
    lastUsed: "2 min ago",
    icon: CreditCard,
  },
  {
    id: "customers-with-outstanding",
    name: "Customers With Outstanding Debt",
    description: "Identify all customers with unpaid (pending or overdue) invoices ranked by balance.",
    category: "CRM",
    risk: "LOW",
    status: "ACTIVE",
    executions: 154,
    lastUsed: "18 min ago",
    icon: Users,
  },

  // Finance Tools
  {
    id: "invoice-search",
    name: "Search Invoices",
    description: "Find invoices by client, company, invoice number, status, or amount range.",
    category: "Finance",
    risk: "LOW",
    status: "ACTIVE",
    executions: 712,
    lastUsed: "1 min ago",
    icon: FileText,
  },
  {
    id: "invoice-summary",
    name: "Invoice Summary",
    description: "Retrieve comprehensive details for a specific invoice, including linked customer and due status.",
    category: "Finance",
    risk: "LOW",
    status: "ACTIVE",
    executions: 285,
    lastUsed: "6 min ago",
    icon: FileText,
  },
  {
    id: "overdue-invoices",
    name: "Overdue Invoices",
    description: "Find all overdue customer invoices with aggregated overdue debt amounts.",
    category: "Finance",
    risk: "LOW",
    status: "ACTIVE",
    executions: 418,
    lastUsed: "3 min ago",
    icon: AlertTriangle,
  },
  {
    id: "outstanding-invoices",
    name: "Outstanding Invoices",
    description: "Retrieve all unsettled invoices (pending and overdue) with financial breakdown.",
    category: "Finance",
    risk: "LOW",
    status: "ACTIVE",
    executions: 364,
    lastUsed: "8 min ago",
    icon: FileText,
  },
  {
    id: "invoice-status-summary",
    name: "Invoice Status Summary",
    description: "Aggregated status breakdown of all invoices: counts, totals, and collection rate.",
    category: "Finance",
    risk: "LOW",
    status: "ACTIVE",
    executions: 198,
    lastUsed: "15 min ago",
    icon: Activity,
  },
  {
    id: "send-email",
    name: "Send Overdue Reminder",
    description: "Consequential: dispatch overdue reminder emails (strictly requires human authorization).",
    category: "Finance",
    risk: "MEDIUM",
    status: "ACTIVE",
    executions: 62,
    lastUsed: "10 min ago",
    icon: Mail,
  },

  // Analytics Tools
  {
    id: "bi-outstanding-total",
    name: "BI: Outstanding Total Revenue",
    description: "Calculate deterministic total outstanding accounts receivable debt across pending and overdue invoices.",
    category: "Analytics",
    risk: "LOW",
    status: "ACTIVE",
    executions: 521,
    lastUsed: "1 min ago",
    icon: Activity,
  },
  {
    id: "bi-overdue-summary",
    name: "BI: Overdue Invoices Intelligence",
    description: "Comprehensive deterministic metrics on overdue debt, impacted accounts, and risk distribution.",
    category: "Analytics",
    risk: "LOW",
    status: "ACTIVE",
    executions: 389,
    lastUsed: "5 min ago",
    icon: AlertTriangle,
  },
  {
    id: "bi-top-outstanding-customers",
    name: "BI: Top Outstanding Debtors Ranking",
    description: "Rank customers with the largest outstanding invoice balances across pending and overdue accounts.",
    category: "Analytics",
    risk: "LOW",
    status: "ACTIVE",
    executions: 274,
    lastUsed: "9 min ago",
    icon: Users,
  },
  {
    id: "bi-revenue-metrics",
    name: "BI: Revenue & Collections Metrics",
    description: "Executive-level revenue performance indicators: total billed, collections, collection rate, and debt load.",
    category: "Analytics",
    risk: "LOW",
    status: "ACTIVE",
    executions: 180,
    lastUsed: "22 min ago",
    icon: Activity,
  },
];

const categories = [
  "All",
  "CRM",
  "Orders",
  "Finance",
  "Communication",
  "Analytics",
  "System",
];

export default function Tools() {
  const [category, setCategory] = useState("All");
  const [risk, setRisk] = useState<"ALL" | Risk>("ALL");
  const [search, setSearch] = useState("");
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);

  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
      const categoryMatch =
        category === "All" || tool.category === category;

      const riskMatch = risk === "ALL" || tool.risk === risk;

      const searchMatch =
        tool.name.toLowerCase().includes(search.toLowerCase()) ||
        tool.description.toLowerCase().includes(search.toLowerCase());

      return categoryMatch && riskMatch && searchMatch;
    });
  }, [category, risk, search]);

  const criticalCount = tools.filter(
    (tool) => tool.risk === "CRITICAL",
  ).length;

  const lowRiskCount = tools.filter(
    (tool) => tool.risk === "LOW",
  ).length;

  return (
    <main className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
      {/* Header */}
      <div className="mb-7">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-100 text-violet-600">
            <Wrench size={14} />
          </span>

          <span className="text-xs font-semibold text-violet-600">
            AGENT CAPABILITIES
          </span>
        </div>

        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
              Tool Registry
            </h1>

            <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
              Manage the actions BizOps AI can perform across your business
              systems.
            </p>
          </div>

          <button className="flex w-fit items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-violet-600">
            <Wrench size={14} />
            Add Tool
          </button>
        </div>
      </div>

      {/* Overview */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ToolMetric
          title="Active tools"
          value={tools.length.toString()}
          description="Available to AI agents"
          icon={Wrench}
        />

        <ToolMetric
          title="Low risk"
          value={lowRiskCount.toString()}
          description="Can run automatically"
          icon={CheckCircle2}
          type="success"
        />

        <ToolMetric
          title="Critical actions"
          value={criticalCount.toString()}
          description="Require human approval"
          icon={Shield}
          type="danger"
        />

        <ToolMetric
          title="Executions"
          value="2,930"
          description="Total this month"
          icon={Activity}
        />
      </div>

      {/* Filters */}
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          {/* Categories */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {categories.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition ${
                  category === item
                    ? "bg-violet-600 text-white"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          {/* Search + Risk */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex h-9 min-w-[230px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3">
              <Search size={14} className="text-slate-400" />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tools..."
                className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="relative">
              <select
                value={risk}
                onChange={(e) =>
                  setRisk(e.target.value as "ALL" | Risk)
                }
                className="h-9 appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-xs text-slate-600 outline-none"
              >
                <option value="ALL">All risk levels</option>
                <option value="LOW">Low risk</option>
                <option value="MEDIUM">Medium risk</option>
                <option value="CRITICAL">Critical</option>
              </select>

              <ChevronDown
                size={13}
                className="pointer-events-none absolute right-2.5 top-3 text-slate-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tool cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence>
          {filteredTools.map((tool) => (
            <motion.div
              layout
              key={tool.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            >
              <ToolCard
                tool={tool}
                onView={() => setSelectedTool(tool)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredTools.length === 0 && (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white">
          <Search size={25} className="text-slate-300" />

          <p className="mt-3 text-sm font-medium text-slate-700">
            No tools found
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Try changing your search or filters.
          </p>
        </div>
      )}

      {/* Details drawer */}
      <AnimatePresence>
        {selectedTool && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTool(null)}
              className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-sm"
            />

            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28 }}
              className="fixed right-0 top-0 z-50 h-full w-full max-w-[460px] border-l border-slate-200 bg-white shadow-2xl"
            >
              <ToolDetails
                tool={selectedTool}
                onClose={() => setSelectedTool(null)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}

function ToolCard({
  tool,
  onView,
}: {
  tool: Tool;
  onView: () => void;
}) {
  const Icon = tool.icon;

  return (
    <>
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
          <Icon size={18} />
        </div>

        <RiskBadge risk={tool.risk} />
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            {tool.name}
          </h2>

          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </div>

        <p className="mt-1.5 min-h-[38px] text-xs leading-5 text-slate-500">
          {tool.description}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
        <div>
          <p className="text-[10px] text-slate-400">Executions</p>

          <p className="mt-0.5 text-xs font-semibold text-slate-700">
            {tool.executions}
          </p>
        </div>

        <div>
          <p className="text-[10px] text-slate-400">Last used</p>

          <p className="mt-0.5 text-xs font-medium text-slate-600">
            {tool.lastUsed}
          </p>
        </div>

        <button
          onClick={onView}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-violet-600 transition hover:bg-violet-50"
        >
          Details
          <ArrowUpRight size={11} />
        </button>
      </div>
    </>
  );
}

function ToolDetails({
  tool,
  onClose,
}: {
  tool: Tool;
  onClose: () => void;
}) {
  const Icon = tool.icon;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-100 p-6">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
            <Icon size={19} />
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Tool details
            </p>

            <h2 className="mt-1 text-base font-semibold text-slate-900">
              {tool.name}
            </h2>
          </div>
        </div>

        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={17} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />

          <span className="text-xs font-medium text-emerald-600">
            Active
          </span>

          <span className="mx-1 text-slate-300">•</span>

          <span className="text-xs text-slate-500">
            {tool.category}
          </span>
        </div>

        <p className="mt-5 text-sm leading-6 text-slate-600">
          {tool.description}
        </p>

        <div className="mt-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Risk classification
          </p>

          <div
            className={`mt-3 rounded-xl border p-4 ${
              tool.risk === "CRITICAL"
                ? "border-red-200 bg-red-50"
                : tool.risk === "MEDIUM"
                  ? "border-amber-200 bg-amber-50"
                  : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <div className="flex gap-3">
              {tool.risk === "CRITICAL" ? (
                <AlertTriangle
                  size={17}
                  className="text-red-500"
                />
              ) : tool.risk === "MEDIUM" ? (
                <Shield
                  size={17}
                  className="text-amber-500"
                />
              ) : (
                <CheckCircle2
                  size={17}
                  className="text-emerald-500"
                />
              )}

              <div>
                <p className="text-xs font-semibold text-slate-800">
                  {tool.risk === "CRITICAL"
                    ? "Human approval required"
                    : tool.risk === "MEDIUM"
                      ? "Controlled action"
                      : "Safe for autonomous execution"}
                </p>

                <p className="mt-1 text-[11px] leading-5 text-slate-600">
                  {tool.risk === "CRITICAL"
                    ? "The AI agent must pause and receive explicit approval before executing this tool."
                    : tool.risk === "MEDIUM"
                      ? "This tool modifies business data and may require additional validation."
                      : "This tool only reads or analyzes business information."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tool metadata */}
        <div className="mt-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Tool metadata
          </p>

          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            <MetadataRow label="Tool ID" value={tool.id} />
            <MetadataRow label="Category" value={tool.category} />
            <MetadataRow
              label="Executions"
              value={tool.executions.toString()}
            />
            <MetadataRow label="Last used" value={tool.lastUsed} />
          </div>
        </div>

        {/* Execution flow */}
        <div className="mt-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Execution flow
          </p>

          <div className="mt-3 space-y-2">
            <FlowStep
              number="01"
              text="Agent selects tool"
            />

            <FlowStep
              number="02"
              text="Validate tool parameters"
            />

            <FlowStep
              number="03"
              text={
                tool.risk === "CRITICAL"
                  ? "Request human approval"
                  : "Execute tool"
              }
            />

            <FlowStep
              number="04"
              text="Record execution in audit log"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 bg-slate-50 p-5">
        <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-semibold text-white transition hover:bg-violet-600">
          <Wrench size={14} />
          Configure Tool
        </button>
      </div>
    </div>
  );
}

function ToolMetric({
  title,
  value,
  description,
  icon: Icon,
  type = "default",
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  type?: "default" | "success" | "danger";
}) {
  const styles = {
    default: "bg-violet-50 text-violet-600",
    success: "bg-emerald-50 text-emerald-600",
    danger: "bg-red-50 text-red-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{title}</p>

        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${styles[type]}`}
        >
          <Icon size={15} />
        </div>
      </div>

      <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>

      <p className="mt-1 text-[11px] text-slate-400">{description}</p>
    </div>
  );
}

function RiskBadge({ risk }: { risk: Risk }) {
  const styles = {
    LOW: "bg-emerald-50 text-emerald-600",
    MEDIUM: "bg-amber-50 text-amber-600",
    CRITICAL: "bg-red-50 text-red-600",
  };

  return (
    <span
      className={`rounded-md px-2 py-1 text-[9px] font-bold tracking-wide ${styles[risk]}`}
    >
      {risk}
    </span>
  );
}

function MetadataRow({
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

function FlowStep({
  number,
  text,
}: {
  number: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
      <span className="text-[9px] font-bold text-violet-500">
        {number}
      </span>

      <span className="text-[11px] font-medium text-slate-600">
        {text}
      </span>
    </div>
  );
}