import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Bot,
  ClipboardCheck,
  Users,
  ShoppingCart,
  FileText,
  BarChart3,
  Settings,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  Shield,
  X,
  Wrench,
  History,
  LogOut,
  Loader2,
  UserCog,
  FolderKanban,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../types/auth';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavItemConfig {
  label: string;
  to: string;
  icon: React.ElementType;
  isAi?: boolean;
  badge?: string;
  roles?: UserRole[];
}

const navItems: NavItemConfig[] = [
  {
    label: 'Overview',
    to: '/',
    icon: LayoutDashboard,
    roles: ['ADMIN', 'OPERATOR', 'APPROVER'],
  },
  {
    label: 'AI Agent',
    to: '/agent',
    icon: Bot,
    isAi: true,
    roles: ['ADMIN', 'OPERATOR'],
  },
  {
    label: 'Projects',
    to: '/projects',
    icon: FolderKanban,
    roles: ['ADMIN', 'OPERATOR', 'APPROVER'],
  },
  {
    label: 'Approvals',
    to: '/approvals',
    icon: ClipboardCheck,
    badge: '3',
    roles: ['ADMIN', 'OPERATOR', 'APPROVER'],
  },
  {
    label: 'Audit Log',
    to: '/audit',
    icon: History,
    roles: ['ADMIN', 'APPROVER'],
  },
  {
    label: 'User Management',
    to: '/users',
    icon: UserCog,
    roles: ['ADMIN'],
  },
  {
    label: 'Tools',
    to: '/tools',
    icon: Wrench,
    roles: ['ADMIN', 'OPERATOR'],
  },
  {
    label: 'Customers',
    to: '/customers',
    icon: Users,
    roles: ['ADMIN', 'OPERATOR'],
  },
  {
    label: 'Orders',
    to: '/orders',
    icon: ShoppingCart,
    roles: ['ADMIN'],
  },
  {
    label: 'Invoices',
    to: '/invoices',
    icon: FileText,
    roles: ['ADMIN', 'OPERATOR'],
  },
  {
    label: 'Analytics',
    to: '/analytics',
    icon: BarChart3,
    roles: ['ADMIN'],
  },
];

export default function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  // Helper to extract clean user initials
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Helper for friendly role title
  const getRoleDisplay = (role?: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return 'Administrator';
      case 'OPERATOR':
        return 'Operator';
      case 'APPROVER':
        return 'Approver';
      default:
        return 'User';
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    try {
      setLoggingOut(true);
      setLogoutError(null);
      const res = await logout();
      if (res.success) {
        if (onCloseMobile) onCloseMobile();
        navigate('/login', { replace: true });
      } else {
        setLogoutError(res.message || 'Logout failed. Please check connection and try again.');
      }
    } catch (err: any) {
      console.error('Logout error:', err);
      setLogoutError(err?.message || 'Unexpected error during logout.');
    } finally {
      setLoggingOut(false);
    }
  };

  // Filter navigation items based on current authenticated user role
  const visibleNavItems = navItems.filter((item) => {
    if (!item.roles || item.roles.length === 0) return true;
    if (!user) return false;
    return item.roles.includes(user.role);
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen w-64 border-r border-slate-200/80 bg-white flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Top Header & Logo */}
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex h-16 shrink-0 items-center justify-between px-5 border-b border-slate-100">
            <NavLink to="/" className="flex items-center gap-3 group" onClick={onCloseMobile}>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25 transition-transform group-hover:scale-105">
                <Bot size={20} strokeWidth={2.2} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-heading text-[16px] font-bold tracking-tight text-slate-900">
                    BizOps
                  </span>
                  <span className="rounded bg-indigo-50 px-1 py-0.2 text-[9px] font-bold text-indigo-600 tracking-wider">
                    AI
                  </span>
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  AI OPERATIONS
                </p>
              </div>
            </NavLink>

            {/* Mobile close button */}
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 lg:hidden"
                aria-label="Close sidebar"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Workspace Selector */}
          <div className="px-4 pt-4 pb-2 shrink-0">
            <button className="flex w-full items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 text-left transition-all hover:bg-slate-100/80 hover:border-slate-300">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-[11px] font-bold text-white shadow-xs">
                  AC
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    Acme Corporation
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    Enterprise Workspace
                  </p>
                </div>
              </div>
              <ChevronDown size={14} className="text-slate-400 shrink-0" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="mt-2 flex-1 px-3 space-y-1 overflow-y-auto">
            <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Navigation ({user ? getRoleDisplay(user.role) : 'Guest'})
            </div>

            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onCloseMobile}
                  className={({ isActive }) =>
                    `group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 shadow-xs font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-3">
                        <Icon
                          size={18}
                          className={`transition-colors ${
                            isActive
                              ? 'text-indigo-600'
                              : 'text-slate-400 group-hover:text-slate-600'
                          }`}
                        />
                        <span>{item.label}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {item.isAi && (
                          <span className="flex items-center gap-1 text-[10px] text-purple-600 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded-md font-medium">
                            <Sparkles size={10} /> Smart
                          </span>
                        )}

                        {item.badge && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow-xs shadow-rose-500/30">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Settings & Dynamic User Profile */}
        <div className="border-t border-slate-100 p-3 space-y-2 shrink-0">
          {user?.role === 'ADMIN' && (
            <NavLink
              to="/settings"
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Settings
                    size={18}
                    className={isActive ? 'text-indigo-600' : 'text-slate-400'}
                  />
                  <span>Settings</span>
                </>
              )}
            </NavLink>
          )}

          {logoutError && (
            <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-700 leading-tight">
              {logoutError}
            </div>
          )}

          {user && (
            <div className="flex items-center justify-between rounded-xl p-2 bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-xs font-bold text-white shadow-xs">
                    {getInitials(user.name)}
                  </div>
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate" title={user.name}>
                    {user.name}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate" title={user.email}>
                    {user.email}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {user.role === 'ADMIN' ? (
                      <ShieldCheck size={10} className="text-indigo-600 shrink-0" />
                    ) : (
                      <Shield size={10} className="text-purple-600 shrink-0" />
                    )}
                    <span className="text-[9px] font-semibold text-slate-600">
                      {getRoleDisplay(user.role)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                id="sidebar-logout-btn"
                onClick={handleLogout}
                disabled={loggingOut}
                title="Sign out"
                aria-label="Sign out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
              >
                {loggingOut ? (
                  <Loader2 size={15} className="animate-spin text-rose-500" />
                ) : (
                  <LogOut size={15} />
                )}
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}