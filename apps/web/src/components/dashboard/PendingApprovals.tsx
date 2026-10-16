import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Mail, XCircle, ArrowUpRight, Check, X, Sparkles } from 'lucide-react';
import Badge from '../ui/Badge';

interface ApprovalItemData {
  id: string;
  title: string;
  description: string;
  icon: typeof CreditCard;
  risk: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'waiting' | 'approved' | 'rejected';
}

const initialApprovals: ApprovalItemData[] = [
  {
    id: '1',
    title: 'Refund customer payment',
    description: 'Rahul Sharma • ₹25,000 • Waiting',
    icon: CreditCard,
    risk: 'HIGH',
    status: 'waiting',
  },
  {
    id: '2',
    title: 'Send invoice reminder',
    description: 'ABC Technologies • 3 recipients • Waiting',
    icon: Mail,
    risk: 'MEDIUM',
    status: 'waiting',
  },
  {
    id: '3',
    title: 'Cancel order',
    description: 'ORD-1024 • ₹12,500 • Waiting',
    icon: XCircle,
    risk: 'HIGH',
    status: 'waiting',
  },
];

export default function PendingApprovals() {
  const [approvals, setApprovals] = useState<ApprovalItemData[]>(initialApprovals);
  const [feedback, setFeedback] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleAction = (id: string, action: 'approved' | 'rejected', title: string) => {
    setApprovals((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: action } : item))
    );
    setFeedback(`${action === 'approved' ? 'Approved' : 'Rejected'}: ${title}`);
    setTimeout(() => setFeedback(null), 3000);
  };

  const pendingCount = approvals.filter((a) => a.status === 'waiting').length;

  return (
    <div className="flex flex-col justify-between h-full">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-base font-bold text-slate-900">
              Pending approvals
            </h3>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white shadow-xs">
              {pendingCount}
            </span>
          </div>

          <button
            onClick={() => navigate('/approvals')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 group"
          >
            <span>View all</span>
            <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Actions waiting for human review
        </p>

        {/* Feedback Alert if action taken */}
        {feedback && (
          <div className="mt-3 rounded-xl bg-indigo-50 border border-indigo-100 p-2 text-xs font-semibold text-indigo-700 animate-in fade-in duration-150 flex items-center gap-1.5">
            <Sparkles size={13} /> {feedback}
          </div>
        )}

        {/* Approvals List */}
        <div className="mt-4 space-y-2.5">
          {approvals.map((item) => {
            const Icon = item.icon;
            const isDone = item.status !== 'waiting';

            return (
              <div
                key={item.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all ${
                  isDone
                    ? 'bg-slate-50 border-slate-200/50 opacity-60'
                    : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                      item.risk === 'HIGH'
                        ? 'bg-rose-50 text-rose-600 border-rose-100'
                        : 'bg-amber-50 text-amber-600 border-amber-100'
                    }`}
                  >
                    <Icon size={16} />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {item.title}
                      </p>
                      <Badge
                        variant={item.risk === 'HIGH' ? 'danger' : 'warning'}
                        size="sm"
                      >
                        {item.risk}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Actions / Status */}
                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                  {isDone ? (
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                        item.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {item.status.toUpperCase()}
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => handleAction(item.id, 'approved', item.title)}
                        title="Approve"
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200/60 transition-colors"
                      >
                        <Check size={14} strokeWidth={2.5} />
                      </button>
                      <button
                        onClick={() => handleAction(item.id, 'rejected', item.title)}
                        title="Reject"
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200/60 transition-colors"
                      >
                        <X size={14} strokeWidth={2.5} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Soft AI Info Card at bottom */}
      <div className="mt-6 rounded-2xl border border-indigo-100/90 bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-white p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
            <Sparkles size={14} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-800 leading-snug">
              Let AI handle the routine, so you can focus on what matters.
            </p>
            <button
              onClick={() => navigate('/settings')}
              className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 group"
            >
              <span>Learn more</span>
              <ArrowUpRight size={12} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
