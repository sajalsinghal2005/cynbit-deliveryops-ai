import { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Sparkles } from 'lucide-react';

const data7D = [
  { date: 'Oct 1', executions: 40, automated: 34, approvals: 6 },
  { date: 'Oct 2', executions: 55, automated: 48, approvals: 7 },
  { date: 'Oct 3', executions: 95, automated: 88, approvals: 7 },
  { date: 'Oct 4', executions: 52, automated: 47, approvals: 5 },
  { date: 'Oct 5', executions: 98, automated: 91, approvals: 7 },
  { date: 'Oct 6', executions: 66, automated: 60, approvals: 6 },
  { date: 'Oct 7', executions: 112, automated: 105, approvals: 7 },
];

const data30D = [
  { date: 'Sep 8', executions: 210, automated: 195, approvals: 15 },
  { date: 'Sep 15', executions: 340, automated: 310, approvals: 30 },
  { date: 'Sep 22', executions: 480, automated: 440, approvals: 40 },
  { date: 'Sep 29', executions: 590, automated: 550, approvals: 40 },
  { date: 'Oct 7', executions: 730, automated: 690, approvals: 40 },
];

const data90D = [
  { date: 'Jul', executions: 920, automated: 850, approvals: 70 },
  { date: 'Aug', executions: 1450, automated: 1360, approvals: 90 },
  { date: 'Sep', executions: 2100, automated: 1980, approvals: 120 },
  { date: 'Oct', executions: 2650, automated: 2520, approvals: 130 },
];

export default function AgentActivityChart() {
  const [timeRange, setTimeRange] = useState<'7D' | '30D' | '90D'>('7D');

  const chartData = timeRange === '7D' ? data7D : timeRange === '30D' ? data30D : data90D;

  return (
    <div className="flex flex-col h-full">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-base font-bold text-slate-900">
              Agent activity
            </h3>
            <span className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
              <Sparkles size={10} /> +24.8% peak
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Recent operations performed by AI
          </p>
        </div>

        {/* Time Filters */}
        <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200/70 self-start sm:self-auto">
          {(['7D', '30D', '90D'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                timeRange === range
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Main Area Chart */}
      <div className="w-full h-64 sm:h-72 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#f1f5f9"
            />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
              dx={-5}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-xl border border-slate-200/90 bg-white/95 p-3 shadow-xl backdrop-blur-md">
                      <p className="text-xs font-bold text-slate-800 mb-1">{label}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="h-2 w-2 rounded-full bg-indigo-600" />
                        <span className="text-slate-500">Executions:</span>
                        <span className="font-bold text-indigo-600">
                          {payload[0].value} tasks
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="executions"
              stroke="#6366f1"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#purpleGradient)"
              activeDot={{
                r: 6,
                fill: '#6366f1',
                stroke: '#ffffff',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Footer Stats */}
      <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-lg bg-slate-50/50">
          <p className="text-[10px] uppercase font-semibold text-slate-400">Total Runs</p>
          <p className="text-sm font-bold text-slate-800 mt-0.5">342</p>
        </div>
        <div className="p-2 rounded-lg bg-slate-50/50">
          <p className="text-[10px] uppercase font-semibold text-slate-400">Success Rate</p>
          <p className="text-sm font-bold text-emerald-600 mt-0.5">99.4%</p>
        </div>
        <div className="p-2 rounded-lg bg-slate-50/50">
          <p className="text-[10px] uppercase font-semibold text-slate-400">Avg Speed</p>
          <p className="text-sm font-bold text-indigo-600 mt-0.5">1.2s</p>
        </div>
      </div>
    </div>
  );
}
