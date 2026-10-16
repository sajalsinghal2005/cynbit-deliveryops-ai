import { useState } from 'react';
import { Shield, Bot, CheckCircle2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

export default function Settings() {
  const [refundThreshold, setRefundThreshold] = useState('15,000');
  const [autoRemindDays, setAutoRemindDays] = useState('3');
  const [requireDualSignoff, setRequireDualSignoff] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold text-slate-900">
              Workspace & AI Guardrails
            </h1>
            <Badge variant="primary" size="md">
              Admin Config
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Configure safety limits, autonomy rules, notification triggers, and model policies.
          </p>
        </div>

        <Button variant="purple-gradient" size="sm" onClick={handleSave}>
          {saved ? 'Saved Successfully!' : 'Save Settings'}
        </Button>
      </div>

      {saved && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-xs font-semibold text-emerald-900 shadow-sm flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>Configuration updated across all autonomous agent worker nodes.</span>
        </div>
      )}

      {/* AI Autonomy & Approval Limits */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
            <Shield size={18} />
          </div>
          <div>
            <h3 className="font-heading text-base font-bold text-slate-900">
              Human-in-the-Loop Safety Guardrails
            </h3>
            <p className="text-xs text-slate-500">
              Set financial and operational limits before AI is forced to ask for human approval.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-700">
              Refund Approval Threshold (₹)
            </label>
            <p className="text-[11px] text-slate-400 mb-1">
              Any refund above this value will be queued in Approvals
            </p>
            <input
              type="text"
              value={refundThreshold}
              onChange={(e) => setRefundThreshold(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">
              Invoice Overdue Grace Period (Days)
            </label>
            <p className="text-[11px] text-slate-400 mb-1">
              Days after due date before AI automatically dispatches friendly reminders
            </p>
            <input
              type="text"
              value={autoRemindDays}
              onChange={(e) => setAutoRemindDays(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>
        </div>

        <div className="pt-2">
          <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 cursor-pointer hover:bg-slate-50">
            <div>
              <p className="text-xs font-semibold text-slate-800">
                Require Dual-Administrator Signoff for Vendor Payouts &gt; ₹50,000
              </p>
              <p className="text-[11px] text-slate-500">
                Enforces 2 separate admin authorizations for high-value supplier payments.
              </p>
            </div>
            <input
              type="checkbox"
              checked={requireDualSignoff}
              onChange={(e) => setRequireDualSignoff(e.target.checked)}
              className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
            />
          </label>
        </div>
      </div>

      {/* Model Selection & Intelligence Settings */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
            <Bot size={18} />
          </div>
          <div>
            <h3 className="font-heading text-base font-bold text-slate-900">
              AI Operations Engine Model
            </h3>
            <p className="text-xs text-slate-500">
              Select the primary reasoning LLM backbone for BizOps AI.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: 'gemini', name: 'BizOps Gemini Pro 2.5', desc: 'Ultra-fast & multimodal tools', selected: true },
            { id: 'claude', name: 'Claude 3.5 Sonnet', desc: 'Complex reasoning & code', selected: false },
            { id: 'gpt4', name: 'GPT-4o Enterprise', desc: 'General business tasks', selected: false },
          ].map((m) => (
            <div
              key={m.id}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                m.selected
                  ? 'border-indigo-500 bg-indigo-50/40 shadow-2xs'
                  : 'border-slate-200 bg-white opacity-70'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-900">{m.name}</p>
                {m.selected && <Badge variant="primary" size="sm">Active</Badge>}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
