import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Clock, DollarSign, Sparkles } from 'lucide-react';
import Badge from '../components/ui/Badge';

const weeklySavingsData = [
  { day: 'Mon', hoursSaved: 14, costSaved: 18000 },
  { day: 'Tue', hoursSaved: 19, costSaved: 24000 },
  { day: 'Wed', hoursSaved: 28, costSaved: 36000 },
  { day: 'Thu', hoursSaved: 22, costSaved: 28000 },
  { day: 'Fri', hoursSaved: 31, costSaved: 41000 },
  { day: 'Sat', hoursSaved: 12, costSaved: 15000 },
  { day: 'Sun', hoursSaved: 8, costSaved: 10000 },
];

const toolDistribution = [
  { name: 'Invoicing & Billing', value: 42, color: '#6366f1' },
  { name: 'CRM & Customer Ops', value: 28, color: '#8b5cf6' },
  { name: 'Email Dispatcher', value: 18, color: '#3b82f6' },
  { name: 'Risk / Approvals', value: 12, color: '#10b981' },
];

export default function Analytics() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold text-slate-900">
              Operations & AI Analytics
            </h1>
            <Badge variant="purple" size="md">
              Real-time ROI
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Quantify AI agent productivity, manual hours eliminated, and operational cost savings.
          </p>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Manual Hours Saved</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Clock size={16} />
            </div>
          </div>
          <h3 className="text-3xl font-extrabold text-slate-900 mt-2">134 hrs</h3>
          <p className="text-xs text-emerald-600 font-semibold mt-1">↑ 32.4% vs last month</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Operational Cost Saved</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign size={16} />
            </div>
          </div>
          <h3 className="text-3xl font-extrabold text-slate-900 mt-2">₹1,72,000</h3>
          <p className="text-xs text-emerald-600 font-semibold mt-1">Estimated direct savings</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Autonomous Precision</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Sparkles size={16} />
            </div>
          </div>
          <h3 className="text-3xl font-extrabold text-slate-900 mt-2">99.8%</h3>
          <p className="text-xs text-indigo-600 font-semibold mt-1">Zero critical hallucinations</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 cols: Bar Chart of Hours Saved */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
          <div className="pb-4">
            <h3 className="font-heading text-base font-bold text-slate-900">
              Daily Hours Automated
            </h3>
            <p className="text-xs text-slate-500">
              Human work hours saved across daily business operations
            </p>
          </div>

          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklySavingsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                          <p className="text-xs font-bold text-slate-800">{label}</p>
                          <p className="text-xs text-indigo-600 font-bold mt-1">
                            {payload[0].value} hours saved
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="hoursSaved" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 5 cols: Tool Distribution Donut */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-heading text-base font-bold text-slate-900">
              Tool Workload Share
            </h3>
            <p className="text-xs text-slate-500">
              Breakdown of autonomous AI executions by category
            </p>
          </div>

          <div className="w-full h-48 my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={toolDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {toolDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            {toolDistribution.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600">{item.name}</span>
                </div>
                <span className="font-bold text-slate-800">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
