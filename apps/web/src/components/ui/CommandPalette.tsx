import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bot, CheckCircle2, Users, ShoppingCart, FileText, BarChart3, Settings, ArrowRight, Sparkles, History, Wrench, UserCog } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../types/auth';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const quickLinks: {
    label: string;
    path: string;
    icon: React.ElementType;
    category: string;
    roles: UserRole[];
  }[] = [
    { label: 'Overview Dashboard', path: '/', icon: CheckCircle2, category: 'General', roles: ['ADMIN', 'OPERATOR', 'APPROVER'] },
    { label: 'AI Agent Workspace', path: '/agent', icon: Bot, category: 'AI & Automation', roles: ['ADMIN', 'OPERATOR'] },
    { label: 'Pending Approvals', path: '/approvals', icon: CheckCircle2, category: 'Actions', roles: ['ADMIN', 'OPERATOR', 'APPROVER'] },
    { label: 'Audit Log & History', path: '/audit', icon: History, category: 'Governance', roles: ['ADMIN', 'APPROVER'] },
    { label: 'User Management', path: '/users', icon: UserCog, category: 'System', roles: ['ADMIN'] },
    { label: 'Platform Tools', path: '/tools', icon: Wrench, category: 'Tools', roles: ['ADMIN', 'OPERATOR'] },
    { label: 'Customer Directory', path: '/customers', icon: Users, category: 'Business', roles: ['ADMIN', 'OPERATOR'] },
    { label: 'Invoices & Billing', path: '/invoices', icon: FileText, category: 'Business', roles: ['ADMIN', 'OPERATOR'] },
    { label: 'Orders & Fulfillment', path: '/orders', icon: ShoppingCart, category: 'Business', roles: ['ADMIN'] },
    { label: 'Analytics & Insights', path: '/analytics', icon: BarChart3, category: 'Reports', roles: ['ADMIN'] },
    { label: 'Workspace Settings', path: '/settings', icon: Settings, category: 'System', roles: ['ADMIN'] },
  ];

  const suggestedTasks: {
    label: string;
    path: string;
    icon: React.ElementType;
    roles: UserRole[];
  }[] = [
    { label: 'Review pending critical approvals', path: '/approvals', icon: Sparkles, roles: ['ADMIN', 'OPERATOR', 'APPROVER'] },
    { label: 'Manage user accounts and session security', path: '/users', icon: Sparkles, roles: ['ADMIN'] },
    { label: 'Search customer accounts via AI agent', path: '/agent', icon: Sparkles, roles: ['ADMIN', 'OPERATOR'] },
    { label: 'Inspect security audit logs', path: '/audit', icon: Sparkles, roles: ['ADMIN', 'APPROVER'] },
    { label: 'View invoice reminders status', path: '/invoices', icon: Sparkles, roles: ['ADMIN', 'OPERATOR'] },
  ];

  const userRole = user?.role;

  const filteredLinks = quickLinks
    .filter((item) => !userRole || item.roles.includes(userRole))
    .filter(
      (item) =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase())
    );

  const filteredTasks = suggestedTasks
    .filter((item) => !userRole || item.roles.includes(userRole))
    .filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in fade-in-90 zoom-in-95 duration-150">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search anything... (e.g., orders, customers, tasks)"
            className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 border border-slate-200">
            ESC
          </kbd>
        </div>

        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-slate-100">
          {/* Quick Nav */}
          <div className="py-2">
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Navigation
            </p>
            {filteredLinks.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => handleSelect(item.path)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50/70 hover:text-indigo-900 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                      <Icon size={15} />
                    </div>
                    <span>{item.label}</span>
                  </div>
                  <span className="text-xs text-slate-400 flex items-center gap-1 group-hover:text-indigo-600">
                    Go <ArrowRight size={12} />
                  </span>
                </button>
              );
            })}
          </div>

          {/* AI Commands & Suggested Tasks */}
          <div className="py-2">
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-500 flex items-center gap-1">
              <Sparkles size={11} /> AI Quick Actions
            </p>
            {filteredTasks.map((task, idx) => (
              <button
                key={idx}
                onClick={() => handleSelect(task.path)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs text-slate-600 hover:bg-indigo-50/70 hover:text-indigo-900 transition-colors"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                  <Sparkles size={13} />
                </div>
                <span className="truncate">{task.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500">
          <span>Tip: Press <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px]">↑</kbd> <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px]">↓</kbd> to navigate</span>
          <span className="text-indigo-600 font-medium">BizOps AI Assistant</span>
        </div>
      </div>
    </div>
  );
}
