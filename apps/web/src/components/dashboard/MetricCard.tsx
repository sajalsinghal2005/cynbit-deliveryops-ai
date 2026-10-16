import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  description: string;
  icon: LucideIcon;
  positive?: boolean;
}

export default function MetricCard({
  title,
  value,
  change,
  description,
  icon: Icon,
  positive = true,
}: MetricCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#101218] p-5 transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.12]">
      <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-indigo-500/5 blur-2xl transition group-hover:bg-indigo-500/10" />

      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-500">{title}</p>

          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.025] text-slate-500">
            <Icon size={16} />
          </div>
        </div>

        <div className="mt-5 flex items-end gap-2">
          <h3 className="text-2xl font-semibold tracking-tight text-white">
            {value}
          </h3>

          <span
            className={`mb-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
              positive
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-amber-500/10 text-amber-400"
            }`}
          >
            {change}
          </span>
        </div>

        <p className="mt-1 text-[11px] text-slate-600">{description}</p>
      </div>
    </div>
  );
}