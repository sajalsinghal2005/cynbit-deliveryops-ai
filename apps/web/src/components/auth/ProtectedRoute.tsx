import React from 'react';
import { Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { ShieldAlert, Bot, ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../types/auth';

interface ProtectedRouteProps {
  children?: React.ReactNode;
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // 1. Loading state during initial session discovery
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 text-center">
        <div className="relative mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25 animate-pulse">
            <Bot size={30} strokeWidth={2.2} />
          </div>
          <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-xs">
            <RefreshCw size={13} className="text-indigo-600 animate-spin" />
          </div>
        </div>
        <h2 className="text-base font-semibold text-slate-800 tracking-tight">
          Authenticating Session
        </h2>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          Verifying your credentials and role permissions with BizOps AI...
        </p>
      </div>
    );
  }

  // 2. Unauthenticated state -> Redirect to /login with return location
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Role-based frontend access check
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/80 p-8 shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 mb-4">
            <ShieldAlert size={26} />
          </div>

          <h3 className="text-lg font-bold text-slate-900 tracking-tight">
            Access Restricted
          </h3>

          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            Your current account role (
            <span className="font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
              {user.role}
            </span>
            ) does not have authorization to view this module.
          </p>

          <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 text-left text-xs text-slate-500 space-y-1">
            <p className="font-medium text-slate-700">Required Roles:</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {allowedRoles.map((role) => (
                <span
                  key={role}
                  className="rounded-md bg-slate-200/80 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm shadow-indigo-500/20 hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Authenticated & Authorized
  return children ? <>{children}</> : <Outlet />;
}
