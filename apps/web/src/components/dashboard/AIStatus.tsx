import { Bot, Cpu, Database, Network, ShieldCheck, CheckCircle2 } from 'lucide-react';
import Badge from '../ui/Badge';

export default function AIStatus() {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Bot size={16} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">AI Agent Engine</h4>
            <p className="text-[10px] text-slate-500">Autonomous Operations Core</p>
          </div>
        </div>
        <Badge variant="success" size="sm" dot>
          Operational
        </Badge>
      </div>

      <div className="mt-3 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <Cpu size={14} className="text-slate-400" />
            <span>LLM Model</span>
          </div>
          <span className="font-semibold text-slate-800">BizOps Gemini Pro 2.5</span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <Network size={14} className="text-slate-400" />
            <span>Tool Registry</span>
          </div>
          <span className="font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-[11px]">
            15 tools active
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <Database size={14} className="text-slate-400" />
            <span>Vector & SQL DB</span>
          </div>
          <span className="font-semibold text-emerald-600 flex items-center gap-1">
            <CheckCircle2 size={12} /> Connected
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <ShieldCheck size={14} className="text-slate-400" />
            <span>HITL Guardrails</span>
          </div>
          <span className="font-semibold text-slate-800">Enforced</span>
        </div>
      </div>
    </div>
  );
}
