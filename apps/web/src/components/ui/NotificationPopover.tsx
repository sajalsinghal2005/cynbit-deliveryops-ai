import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, ShieldAlert, Mail, ArrowRight, Sparkles } from 'lucide-react';

interface NotificationPopoverProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationPopover({ isOpen, onClose }: NotificationPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const notifications = [
    {
      id: '1',
      title: 'Refund Approval Required',
      description: 'Rahul Sharma requested ₹25,000 refund on ORD-1042.',
      time: '8m ago',
      type: 'warning',
      icon: ShieldAlert,
      link: '/approvals',
      unread: true,
    },
    {
      id: '2',
      title: 'Invoice Auto-Generated',
      description: 'INV-2048 for ₹84,500 created for Acme Corp.',
      time: '25m ago',
      type: 'success',
      icon: CheckCircle2,
      link: '/invoices',
      unread: true,
    },
    {
      id: '3',
      title: 'Customer Payment Reminder',
      description: 'AI sent 12 automated reminders to overdue accounts.',
      time: '1h ago',
      type: 'info',
      icon: Mail,
      link: '/analytics',
      unread: false,
    },
  ];

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-2xl bg-white shadow-xl border border-slate-200 p-0 overflow-hidden animate-in fade-in-90 slide-in-from-top-2 duration-150"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-indigo-600" />
          <h4 className="text-sm font-semibold text-slate-800">Notifications</h4>
          <span className="rounded-full bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2">
            2 new
          </span>
        </div>
        <button
          onClick={() => {}}
          className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
        >
          Mark all as read
        </button>
      </div>

      <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
        {notifications.map((n) => {
          const Icon = n.icon;
          return (
            <div
              key={n.id}
              onClick={() => {
                navigate(n.link);
                onClose();
              }}
              className={`p-3.5 flex items-start gap-3 hover:bg-slate-50 cursor-pointer transition-colors ${
                n.unread ? 'bg-indigo-50/20' : ''
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  n.type === 'warning'
                    ? 'bg-rose-50 text-rose-600'
                    : n.type === 'success'
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-indigo-50 text-indigo-600'
                }`}
              >
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-900 truncate">{n.title}</p>
                  <span className="text-[10px] text-slate-400 shrink-0">{n.time}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                  {n.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 flex items-center gap-1">
          <Sparkles size={12} className="text-indigo-500" /> AI alerts active
        </span>
        <button
          onClick={() => {
            navigate('/approvals');
            onClose();
          }}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
        >
          View all approvals <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}
