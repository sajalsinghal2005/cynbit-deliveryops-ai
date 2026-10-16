import { FileText, Search, ShieldAlert, Mail, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const activities = [
  {
    id: '1',
    title: 'Invoice generated',
    description: 'INV-2048 • ₹84,500',
    time: '2 min ago',
    icon: FileText,
    type: 'success',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    link: '/invoices',
  },
  {
    id: '2',
    title: 'Customer lookup completed',
    description: 'ABC Technologies',
    time: '5 min ago',
    icon: Search,
    type: 'indigo',
    color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    link: '/customers',
  },
  {
    id: '3',
    title: 'Refund approval required',
    description: '₹25,000 • Rahul Sharma',
    time: '8 min ago',
    icon: ShieldAlert,
    type: 'warning',
    color: 'bg-rose-50 text-rose-600 border-rose-100',
    link: '/approvals',
  },
  {
    id: '4',
    title: 'Email campaign completed',
    description: '12 customer reminders',
    time: '14 min ago',
    icon: Mail,
    type: 'blue',
    color: 'bg-purple-50 text-purple-600 border-purple-100',
    link: '/analytics',
  },
];

export default function RecentActivity() {
  const navigate = useNavigate();

  return (
    <div className="mt-6 pt-5 border-t border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Recent Activity
        </h4>
        <button
          onClick={() => navigate('/audit')}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 group"
        >
          <span>Audit Trail</span>
          <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      <div className="divide-y divide-slate-100/80">
        {activities.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              onClick={() => navigate(item.link)}
              className="flex items-center justify-between py-3 px-2 rounded-xl transition-colors hover:bg-slate-50 cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${item.color} transition-transform group-hover:scale-105`}
                >
                  <Icon size={15} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                    {item.title}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {item.description}
                  </p>
                </div>
              </div>

              <span className="text-[11px] font-medium text-slate-400 shrink-0 ml-3">
                {item.time}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
