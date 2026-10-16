import { ArrowUpRight, Clock3, CreditCard, Mail, XCircle } from "lucide-react";

const approvals = [
  {
    title: "Refund customer payment",
    description: "Rahul Sharma · ₹25,000",
    icon: CreditCard,
    risk: "HIGH",
  },
  {
    title: "Send invoice reminder",
    description: "ABC Technologies · 3 recipients",
    icon: Mail,
    risk: "MEDIUM",
  },
  {
    title: "Cancel order",
    description: "ORD-1024 · ₹12,500",
    icon: XCircle,
    risk: "HIGH",
  },
];

export default function ApprovalSummary() {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#101218]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-200">
              Pending approvals
            </h2>

            <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">
              3
            </span>
          </div>

          <p className="mt-0.5 text-[11px] text-slate-600">
            Actions waiting for human review
          </p>
        </div>

        <button className="text-[11px] font-medium text-indigo-400">
          View all
        </button>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {approvals.map((approval) => {
          const Icon = approval.icon;

          return (
            <div
              key={approval.title}
              className="group flex items-center gap-3 px-5 py-4"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                <Icon size={16} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-300">
                  {approval.title}
                </p>

                <div className="mt-1 flex items-center gap-2">
                  <p className="truncate text-[10px] text-slate-600">
                    {approval.description}
                  </p>

                  <span className="hidden items-center gap-1 text-[9px] text-slate-600 sm:flex">
                    <Clock3 size={9} />
                    Waiting
                  </span>
                </div>
              </div>

              <span
                className={`hidden rounded-md px-1.5 py-0.5 text-[9px] font-semibold sm:block ${
                  approval.risk === "HIGH"
                    ? "bg-red-500/10 text-red-400"
                    : "bg-amber-500/10 text-amber-400"
                }`}
              >
                {approval.risk}
              </span>

              <button className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white/[0.05] hover:text-white">
                <ArrowUpRight size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}