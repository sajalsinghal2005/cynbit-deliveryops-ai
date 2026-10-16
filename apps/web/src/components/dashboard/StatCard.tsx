import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: string;
  change: string;
  trend?: 'up' | 'down' | 'neutral';
  description: string;
  icon: LucideIcon;
  sparklineData?: number[];
  variant?: 'indigo' | 'amber' | 'emerald' | 'blue';
}

export default function StatCard({
  title,
  value,
  change,
  trend = 'up',
  description,
  icon: Icon,
  sparklineData = [35, 45, 40, 60, 55, 75, 70, 90],
  variant = 'indigo',
}: StatCardProps) {
  const colorMap = {
    indigo: {
      iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      sparklineColor: '#6366f1',
      glow: 'group-hover:border-indigo-200',
    },
    amber: {
      iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
      badge: 'bg-amber-50 text-amber-700 border-amber-100',
      sparklineColor: '#f59e0b',
      glow: 'group-hover:border-amber-200',
    },
    emerald: {
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      sparklineColor: '#10b981',
      glow: 'group-hover:border-emerald-200',
    },
    blue: {
      iconBg: 'bg-purple-50 text-purple-600 border-purple-100',
      badge: 'bg-purple-50 text-purple-700 border-purple-100',
      sparklineColor: '#8b5cf6',
      glow: 'group-hover:border-purple-200',
    },
  };

  const style = colorMap[variant] || colorMap.indigo;

  // Generate SVG mini sparkline path
  const min = Math.min(...sparklineData);
  const max = Math.max(...sparklineData);
  const range = max - min || 1;
  const height = 28;
  const width = 80;
  const points = sparklineData
    .map((val, index) => {
      const x = (index / (sparklineData.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/40 ${style.glow}`}
    >
      {/* Top row: Title and Icon */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 tracking-tight">{title}</span>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-xl border ${style.iconBg} transition-transform group-hover:scale-105`}
        >
          <Icon size={16} />
        </div>
      </div>

      {/* Middle row: Large Value & Sparkline */}
      <div className="mt-4 flex items-end justify-between">
        <div>
          <h3 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </h3>
        </div>

        {/* Mini Sparkline SVG */}
        <div className="opacity-75 transition-opacity group-hover:opacity-100">
          <svg width={width} height={height} className="overflow-visible">
            <polyline
              fill="none"
              stroke={style.sparklineColor}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
          </svg>
        </div>
      </div>

      {/* Bottom row: Trend badge & description */}
      <div className="mt-3 flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[11px] font-bold ${style.badge}`}
        >
          {trend === 'up' ? (
            <ArrowUpRight size={12} className="stroke-[2.5]" />
          ) : (
            <ArrowDownRight size={12} className="stroke-[2.5]" />
          )}
          {change}
        </span>
        <span className="text-[11px] text-slate-500 truncate">{description}</span>
      </div>
    </div>
  );
}
