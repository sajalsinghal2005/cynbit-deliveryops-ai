import {
  CheckCircle2,
  FileText,
  Mail,
  Search,
  ShieldAlert,
} from "lucide-react";

const activities = [
  {
    icon: CheckCircle2,
    title: "Invoice generated",
    description: "INV-2048 · ₹84,500",
    time: "2 min ago",
    type: "success",
  },
  {
    icon: Search,
    title: "Customer lookup completed",
    description: "ABC Technologies",
    time: "5 min ago",
    type: "default",
  },
  {
    icon: ShieldAlert,
    title: "Refund approval required",
    description: "₹25,000 · Rahul Sharma",
    time: "8 min ago",
    type: "warning",
  },
  {
    icon: Mail,
    title: "Email campaign completed",
    description: "12 customer reminders",
    time: "14 min ago",
    type: "success",
  },
  {
    icon: FileText,
    title: "Sales report generated",
    description: "September 2026",
    time: "21 min ago",
    type: "default",
  },
];

export default function ActivityFeed() {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#101218]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">
            Agent activity
          </h2>

          <p className="mt-0.5 text-[11px] text-slate-600">
            Recent operations performed by AI
          </p>
        </div>

        <button className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300">
          View all
        </button>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {activities.map((activity) => {
          const Icon = activity.icon;

          return (
            <div
              key={activity.title}
              className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-white/[0.015]"
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  activity.type === "success"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : activity.type === "warning"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-white/[0.04] text-slate-500"
                }`}
              >
                <Icon size={15} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-300">
                  {activity.title}
                </p>

                <p className="mt-0.5 truncate text-[10px] text-slate-600">
                  {activity.description}
                </p>
              </div>

              <span className="shrink-0 text-[10px] text-slate-700">
                {activity.time}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}