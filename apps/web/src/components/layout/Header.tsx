import { useState, useEffect } from 'react';
import { Search, Bell, Command, Menu, ShieldCheck, Shield } from 'lucide-react';
import CommandPalette from '../ui/CommandPalette';
import NotificationPopover from '../ui/NotificationPopover';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

export default function Header({ onOpenMobileMenu }: HeaderProps) {
  const { user } = useAuth();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Global shortcut: ⌘K or Ctrl+K opens command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getRoleDisplay = (role?: string) => {
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

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 sm:px-6 lg:px-8 backdrop-blur-md">
        {/* Left Section: Mobile Menu + Search Box */}
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          {/* Mobile hamburger button */}
          <button
            onClick={onOpenMobileMenu}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          {/* Large Search Box */}
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="group flex w-full max-w-md items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-2 text-left text-xs text-slate-400 transition-all hover:border-slate-300 hover:bg-white hover:shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
          >
            <div className="flex items-center gap-2.5 truncate">
              <Search
                size={16}
                className="text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0"
              />
              <span className="truncate text-slate-500">
                Search anything... (e.g., orders, customers, tasks)
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 shadow-2xs">
              <Command size={10} />
              <span>K</span>
            </div>
          </button>
        </div>

        {/* Right Section: Notifications + User Profile */}
        <div className="flex items-center gap-3 relative">
          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen((prev) => !prev)}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 shadow-2xs transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95 cursor-pointer"
              aria-label="Notifications"
            >
              <Bell size={17} />
              {/* Red notification dot */}
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </button>

            <NotificationPopover
              isOpen={notificationsOpen}
              onClose={() => setNotificationsOpen(false)}
            />
          </div>

          <div className="h-5 w-px bg-slate-200" />

          {/* User Profile Info */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-xs font-bold text-white shadow-xs">
                  {getInitials(user?.name)}
                </div>
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>

              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-slate-800 truncate max-w-[150px]">
                  {user?.name || 'Guest User'}
                </p>
                <div className="flex items-center gap-1">
                  {user?.role === 'ADMIN' ? (
                    <ShieldCheck size={11} className="text-indigo-600" />
                  ) : (
                    <Shield size={11} className="text-purple-600" />
                  )}
                  <p className="text-[10px] text-slate-500">
                    {getRoleDisplay(user?.role)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Global Command Palette Modal */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </>
  );
}
