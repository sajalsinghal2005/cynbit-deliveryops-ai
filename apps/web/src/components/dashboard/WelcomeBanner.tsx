import { useNavigate } from 'react-router-dom';
import { Bot, Sparkles, ArrowRight, CheckCircle2, Zap } from 'lucide-react';
import Badge from '../ui/Badge';

export default function WelcomeBanner() {
  const navigate = useNavigate();

  return (
    <div className="relative overflow-hidden rounded-3xl border border-indigo-100/80 bg-gradient-to-br from-white via-indigo-50/30 to-purple-50/40 p-6 sm:p-8 shadow-[0_2px_10px_-3px_rgba(99,102,241,0.08)]">
      {/* Decorative background glows */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-200/40 via-purple-200/30 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 left-1/3 h-48 w-48 rounded-full bg-indigo-100/50 blur-2xl" />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left Welcome Content */}
        <div className="max-w-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
              Wednesday, October 7, 2026
            </span>
          </div>

          <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Good evening, <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Sajal!</span>
          </h1>

          <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
            Here's what's happening across your business operations.
          </p>

          {/* Status Pills */}
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Badge variant="success" size="md" dot>
              AI Agent Online
            </Badge>
            <Badge variant="primary" size="md" dot>
              System Healthy
            </Badge>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 ml-1">
              <Zap size={13} className="text-amber-500 fill-amber-500" />
              <span>4 autonomous actions completed today</span>
            </div>
          </div>
        </div>

        {/* Right Action & AI Card Area */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 lg:shrink-0">
          {/* Floating Pill Card: Automate • Process • Grow */}
          <div className="hidden xl:flex flex-col justify-between rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur-md max-w-[210px]">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                <Sparkles size={13} />
              </div>
              <span>Automate • Process • Grow</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-500 leading-normal">
              Smart operations, powered by AI.
            </p>
            <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
              <CheckCircle2 size={11} /> 99.8% precision rate
            </div>
          </div>

          {/* Purple Gradient CTA Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 p-5 text-white shadow-lg shadow-indigo-600/25 transition-all hover:shadow-xl hover:shadow-indigo-600/30 group">
            {/* Background shimmer */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_60%)]" />

            <div className="relative z-10">
              <div className="flex items-center justify-between gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md text-white border border-white/20">
                  <Bot size={22} className="animate-pulse" />
                </div>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
                  Active V2.4
                </span>
              </div>

              <h2 className="mt-3 text-base font-bold text-white tracking-tight">
                Open AI Agent
              </h2>
              <p className="mt-0.5 text-xs text-indigo-100 max-w-[190px]">
                Your AI assistant for business tasks.
              </p>

              <button
                onClick={() => navigate('/agent')}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-indigo-900 shadow-sm transition-all hover:bg-indigo-50 hover:shadow active:scale-[0.98]"
              >
                <span>Start Agent</span>
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
