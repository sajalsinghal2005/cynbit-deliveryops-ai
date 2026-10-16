import React, { useState, useEffect, useCallback, useId } from 'react';
import {
  Users,
  ShieldCheck,
  Shield,
  UserCheck,
  UserX,
  Search,
  Plus,
  RefreshCw,
  KeyRound,
  Monitor,
  Laptop,
  Smartphone,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Clock,
  Radio,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../lib/api';
import type {
  AdminUserListItem,
  ListUsersResponse,
  SafeSessionItem,
  ListSessionsResponse,
  CreateUserResponse,
  UpdateUserResponse,
  SetStatusResponse,
  ResetPasswordResponse,
  UserRole,
} from '../types';

export default function UserManagement() {
  const { user: currentUser } = useAuth();

  // Primary list state
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Filters and pagination
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [sessionsModalOpen, setSessionsModalOpen] = useState(false);

  // Selected user for actions
  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(null);

  // Form states
  // 1. Create User
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createRole, setCreateRole] = useState<UserRole>('OPERATOR');
  const [createCustomPassword, setCreateCustomPassword] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createFormError, setCreateFormError] = useState<string | null>(null);

  // Returned temporary password display
  const [newlyCreatedPassword, setNewlyCreatedPassword] = useState<string | null>(null);
  const [copiedNewPassword, setCopiedNewPassword] = useState(false);

  // 2. Edit User
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('OPERATOR');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);

  // 3. Status Change
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // 4. Password Reset
  const [resetCustomPassword, setResetCustomPassword] = useState('');
  const [resetRevokeSessions, setResetRevokeSessions] = useState(true);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccessPassword, setResetSuccessPassword] = useState<string | null>(null);
  const [copiedResetPassword, setCopiedResetPassword] = useState(false);

  // 5. Sessions Inspector
  const [sessions, setSessions] = useState<SafeSessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  // Notification timer
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Fetch users from API
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search.trim()) params.set('search', search.trim());
      if (roleFilter !== 'ALL') params.set('role', roleFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);

      const res = await api.get<ListUsersResponse>(`/api/admin/users?${params.toString()}`);
      if (res.success && Array.isArray(res.users)) {
        setUsers(res.users);
        setTotal(res.pagination.total);
        setTotalPages(res.pagination.totalPages);
      } else {
        throw new Error(res.message || 'Failed to parse user list response');
      }
    } catch (err: any) {
      console.error('Fetch users error:', err);
      const msg = err instanceof ApiError ? err.message : err?.message || 'Failed to load users.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Metrics computation
  const activeCount = users.filter((u) => u.isActive).length;
  const inactiveCount = users.filter((u) => !u.isActive).length;
  const adminCount = users.filter((u) => u.role === 'ADMIN' && u.isActive).length;

  // Search input change handler with reset to page 1
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleRoleFilterChange = (role: UserRole | 'ALL') => {
    setRoleFilter(role);
    setPage(1);
  };

  const handleStatusFilterChange = (status: 'ALL' | 'ACTIVE' | 'INACTIVE') => {
    setStatusFilter(status);
    setPage(1);
  };

  // Helper: Initials
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Format dates
  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  // ==========================================
  // ACTION: Create User
  // ==========================================
  const openCreateModal = () => {
    setCreateName('');
    setCreateEmail('');
    setCreateRole('OPERATOR');
    setCreateCustomPassword('');
    setShowCreatePassword(false);
    setCreateFormError(null);
    setNewlyCreatedPassword(null);
    setCopiedNewPassword(false);
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateFormError(null);

    const trimmedName = createName.trim();
    const trimmedEmail = createEmail.trim().toLowerCase();

    if (!trimmedName || trimmedName.length < 2) {
      setCreateFormError('Name must be at least 2 characters.');
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setCreateFormError('Please enter a valid email address.');
      return;
    }
    if (createCustomPassword && createCustomPassword.length < 8) {
      setCreateFormError('Temporary password must be at least 8 characters long.');
      return;
    }

    try {
      setCreateSubmitting(true);
      const res = await api.post<CreateUserResponse>('/api/admin/users', {
        name: trimmedName,
        email: trimmedEmail,
        role: createRole,
        temporaryPassword: createCustomPassword || undefined,
      });

      if (res.success && res.temporaryPassword) {
        setNewlyCreatedPassword(res.temporaryPassword);
        setNotification({
          type: 'success',
          message: `User "${res.user.name}" created successfully.`,
        });
        fetchUsers();
      } else {
        throw new Error(res.message || 'Creation completed but password missing.');
      }
    } catch (err: any) {
      console.error('Create user error:', err);
      const msg = err instanceof ApiError ? err.message : err?.message || 'Failed to create user.';
      setCreateFormError(msg);
    } finally {
      setCreateSubmitting(false);
    }
  };

  const closeCreateModal = () => {
    // Clear sensitive password from memory immediately
    setNewlyCreatedPassword(null);
    setCopiedNewPassword(false);
    setCreateCustomPassword('');
    setCreateModalOpen(false);
  };

  const copyToClipboard = async (text: string, setCopiedState: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedState(true);
      setTimeout(() => setCopiedState(false), 2500);
    } catch {
      // Fallback
      setCopiedState(false);
    }
  };

  // ==========================================
  // ACTION: Edit User
  // ==========================================
  const openEditModal = (user: AdminUserListItem) => {
    setSelectedUser(user);
    setEditName(user.name);
    setEditRole(user.role);
    setEditFormError(null);
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setEditFormError(null);

    const trimmedName = editName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setEditFormError('Name must be at least 2 characters.');
      return;
    }

    // Frontend self-demotion check
    if (currentUser?.id === selectedUser.id && editRole !== 'ADMIN') {
      setEditFormError('Administrators cannot demote their own account. Another administrator must perform this action.');
      return;
    }

    try {
      setEditSubmitting(true);
      const res = await api.patch<UpdateUserResponse>(`/api/admin/users/${selectedUser.id}`, {
        name: trimmedName,
        role: editRole,
      });

      if (res.success) {
        setNotification({
          type: 'success',
          message: `User "${res.user.name}" profile updated successfully.`,
        });
        setEditModalOpen(false);
        fetchUsers();
      }
    } catch (err: any) {
      console.error('Edit user error:', err);
      const msg = err instanceof ApiError ? err.message : err?.message || 'Failed to update user.';
      setEditFormError(msg);
    } finally {
      setEditSubmitting(false);
    }
  };

  // ==========================================
  // ACTION: Status Toggle (Activate/Deactivate)
  // ==========================================
  const openStatusConfirm = (user: AdminUserListItem) => {
    setSelectedUser(user);
    setStatusError(null);
    setStatusConfirmOpen(true);
  };

  const handleStatusSubmit = async () => {
    if (!selectedUser) return;
    setStatusError(null);

    // Prevent self-deactivation on frontend
    if (currentUser?.id === selectedUser.id && selectedUser.isActive) {
      setStatusError('Administrators cannot deactivate their own account.');
      return;
    }

    const nextStatus = !selectedUser.isActive;

    try {
      setStatusSubmitting(true);
      const res = await api.patch<SetStatusResponse>(`/api/admin/users/${selectedUser.id}/status`, {
        isActive: nextStatus,
      });

      if (res.success) {
        setNotification({
          type: 'success',
          message: nextStatus
            ? `Account for "${res.user.name}" has been activated.`
            : `Account for "${res.user.name}" deactivated and ${res.sessionsRevoked} active session(s) revoked.`,
        });
        setStatusConfirmOpen(false);
        fetchUsers();
      }
    } catch (err: any) {
      console.error('Status change error:', err);
      const msg = err instanceof ApiError ? err.message : err?.message || 'Failed to update account status.';
      setStatusError(msg);
    } finally {
      setStatusSubmitting(false);
    }
  };

  // ==========================================
  // ACTION: Password Reset
  // ==========================================
  const openResetPasswordModal = (user: AdminUserListItem) => {
    setSelectedUser(user);
    setResetCustomPassword('');
    setResetRevokeSessions(true);
    setShowResetPassword(false);
    setResetError(null);
    setResetSuccessPassword(null);
    setCopiedResetPassword(false);
    setResetPasswordOpen(true);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setResetError(null);

    if (resetCustomPassword && resetCustomPassword.length < 8) {
      setResetError('Password must be at least 8 characters long.');
      return;
    }

    try {
      setResetSubmitting(true);
      const res = await api.post<ResetPasswordResponse>(
        `/api/admin/users/${selectedUser.id}/reset-password`,
        {
          newPassword: resetCustomPassword || undefined,
          revokeSessions: resetRevokeSessions,
        }
      );

      if (res.success && res.temporaryPassword) {
        setResetSuccessPassword(res.temporaryPassword);
        setNotification({
          type: 'success',
          message: `Password reset successfully. ${res.sessionsRevoked} active session(s) invalidated.`,
        });
        fetchUsers();
      }
    } catch (err: any) {
      console.error('Password reset error:', err);
      const msg = err instanceof ApiError ? err.message : err?.message || 'Failed to reset password.';
      setResetError(msg);
    } finally {
      setResetSubmitting(false);
    }
  };

  const closeResetPasswordModal = () => {
    setResetSuccessPassword(null);
    setCopiedResetPassword(false);
    setResetCustomPassword('');
    setResetPasswordOpen(false);
  };

  // ==========================================
  // ACTION: Sessions Management
  // ==========================================
  const openSessionsModal = async (user: AdminUserListItem) => {
    setSelectedUser(user);
    setSessions([]);
    setSessionsError(null);
    setSessionsModalOpen(true);
    await fetchUserSessions(user.id);
  };

  const fetchUserSessions = async (userId: string) => {
    try {
      setSessionsLoading(true);
      setSessionsError(null);
      const res = await api.get<ListSessionsResponse>(`/api/admin/users/${userId}/sessions`);
      if (res.success && Array.isArray(res.sessions)) {
        setSessions(res.sessions);
      } else {
        throw new Error(res.message || 'Failed to parse session list.');
      }
    } catch (err: any) {
      console.error('Fetch sessions error:', err);
      const msg = err instanceof ApiError ? err.message : err?.message || 'Failed to retrieve active sessions.';
      setSessionsError(msg);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleRevokeSingleSession = async (sessionId: string) => {
    if (!selectedUser) return;
    const targetSession = sessions.find((s) => s.id === sessionId);
    if (targetSession?.isCurrent) {
      const confirmSelf = window.confirm(
        'Warning: You are revoking your CURRENT active session. You will be logged out immediately. Do you wish to continue?'
      );
      if (!confirmSelf) return;
    }

    try {
      setRevokingSessionId(sessionId);
      await api.delete(`/api/admin/users/${selectedUser.id}/sessions/${sessionId}`);
      setNotification({
        type: 'success',
        message: 'Session revoked successfully.',
      });
      await fetchUserSessions(selectedUser.id);
      fetchUsers();
    } catch (err: any) {
      console.error('Revoke session error:', err);
      const msg = err instanceof ApiError ? err.message : err?.message || 'Failed to revoke session.';
      setSessionsError(msg);
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!selectedUser) return;
    const isSelf = currentUser?.id === selectedUser.id;
    const confirmMsg = isSelf
      ? 'Revoke all your other active sessions? Your current session will be preserved.'
      : `Are you sure you want to revoke all active sessions for "${selectedUser.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setRevokingAll(true);
      const query = isSelf ? '?keepCurrentSession=true' : '';
      const res = await api.delete<{ success: boolean; count: number }>(
        `/api/admin/users/${selectedUser.id}/sessions${query}`
      );
      setNotification({
        type: 'success',
        message: `Revoked ${res.count || 0} active session(s).`,
      });
      await fetchUserSessions(selectedUser.id);
      fetchUsers();
    } catch (err: any) {
      console.error('Revoke all sessions error:', err);
      const msg = err instanceof ApiError ? err.message : err?.message || 'Failed to revoke sessions.';
      setSessionsError(msg);
    } finally {
      setRevokingAll(false);
    }
  };

  // Device icon helper
  const getDeviceIcon = (device?: string) => {
    if (!device) return <Monitor size={16} className="text-slate-400" />;
    const d = device.toLowerCase();
    if (d.includes('phone') || d.includes('android') || d.includes('ios')) {
      return <Smartphone size={16} className="text-slate-500" />;
    }
    if (d.includes('mac') || d.includes('laptop')) {
      return <Laptop size={16} className="text-slate-500" />;
    }
    return <Monitor size={16} className="text-slate-500" />;
  };

  const createNameId = useId();
  const createEmailId = useId();
  const createRoleId = useId();
  const createPasswordId = useId();
  const editNameId = useId();
  const editRoleId = useId();
  const resetPasswordInputId = useId();
  const resetRevokeCheckboxId = useId();

  return (
    <div className="space-y-6">
      {/* 1. Page Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900">
              User Management
            </h1>
            <Badge variant="primary" size="md">
              ADMIN ONLY
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage system operators, approvers, and administrators, role assignments, and active sessions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            loading={loading}
            onClick={fetchUsers}
            title="Refresh list"
            id="user-mgmt-refresh-btn"
          >
            Refresh
          </Button>
          <Button
            variant="purple-gradient"
            size="sm"
            icon={Plus}
            onClick={openCreateModal}
            id="user-mgmt-create-btn"
          >
            Create User
          </Button>
        </div>
      </div>

      {/* 2. Feedback Notification Toast/Banner */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border text-xs font-medium animate-in fade-in duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : notification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-indigo-50 border-indigo-200 text-indigo-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : notification.type === 'error' ? (
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
            ) : (
              <Radio size={16} className="text-indigo-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 rounded-md hover:bg-black/5 text-current cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 3. Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card variant="default" className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Users size={22} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Users</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{total}</p>
          </div>
        </Card>

        <Card variant="default" className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <UserCheck size={22} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Active Accounts</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{activeCount}</p>
          </div>
        </Card>

        <Card variant="default" className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
            <UserX size={22} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Inactive Accounts</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{inactiveCount}</p>
          </div>
        </Card>

        <Card variant="default" className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Active Admins</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{adminCount}</p>
          </div>
        </Card>
      </div>

      {/* 4. Filter, Search, and Status Bar */}
      <Card variant="default" className="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              id="user-search-input"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search by name or email..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Role and Status Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <SlidersHorizontal size={14} className="text-slate-400" />
              <span className="font-medium">Role:</span>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {(['ALL', 'ADMIN', 'OPERATOR', 'APPROVER'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => handleRoleFilterChange(r)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                    roleFilter === r
                      ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {r === 'ALL' ? 'All Roles' : r}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500 ml-2">
              <span className="font-medium">Status:</span>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusFilterChange(s)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                    statusFilter === s
                      ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s === 'ALL' ? 'All' : s === 'ACTIVE' ? 'Active' : 'Inactive'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* 5. Users Table */}
      <Card variant="default" noPadding className="overflow-hidden">
        {/* Error state */}
        {error && (
          <div className="p-6 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-200 mb-3">
              <AlertCircle size={22} />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Failed to load user accounts</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{error}</p>
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={fetchUsers}
              className="mt-4"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !error && (
          <div className="p-8 text-center space-y-3">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 animate-spin">
              <RefreshCw size={18} />
            </div>
            <p className="text-xs text-slate-500 font-medium">Loading user directory...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && users.length === 0 && (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
              <Users size={24} />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">No users match your criteria</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Try adjusting your search query, role filter, or status selection.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearch('');
                setRoleFilter('ALL');
                setStatusFilter('ALL');
              }}
              className="mt-4"
            >
              Reset Filters
            </Button>
          </div>
        )}

        {/* Real Table */}
        {!loading && !error && users.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4 sm:px-6">User Account</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Account Status</th>
                  <th className="py-3.5 px-4 text-center">Active Sessions</th>
                  <th className="py-3.5 px-4">Created Date</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {users.map((u) => {
                  const isCurrent = currentUser?.id === u.id;
                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/60 transition-colors group"
                    >
                      {/* Name & Email */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-xs ${
                              u.role === 'ADMIN'
                                ? 'bg-gradient-to-tr from-indigo-600 to-purple-600'
                                : u.role === 'APPROVER'
                                ? 'bg-gradient-to-tr from-blue-600 to-indigo-600'
                                : 'bg-gradient-to-tr from-slate-600 to-slate-700'
                            }`}
                          >
                            {getInitials(u.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900 truncate">
                                {u.name}
                              </span>
                              {isCurrent && (
                                <span className="rounded bg-indigo-50 px-1.5 py-0.2 text-[9px] font-bold text-indigo-700 border border-indigo-100">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        {u.role === 'ADMIN' ? (
                          <Badge variant="purple" size="sm" className="font-semibold">
                            <ShieldCheck size={11} className="mr-1 text-purple-600" />
                            ADMIN
                          </Badge>
                        ) : u.role === 'APPROVER' ? (
                          <Badge variant="primary" size="sm" className="font-semibold">
                            <Shield size={11} className="mr-1 text-indigo-600" />
                            APPROVER
                          </Badge>
                        ) : (
                          <Badge variant="neutral" size="sm" className="font-semibold">
                            OPERATOR
                          </Badge>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {u.isActive ? (
                          <Badge variant="success" size="sm" dot>
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="danger" size="sm" dot>
                            Inactive
                          </Badge>
                        )}
                      </td>

                      {/* Active Sessions */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => openSessionsModal(u)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-[11px] font-semibold text-slate-600 transition-colors cursor-pointer"
                          title="Inspect active sessions"
                        >
                          <Radio size={12} className={u.activeSessionsCount > 0 ? 'text-emerald-500' : 'text-slate-400'} />
                          <span>{u.activeSessionsCount} active</span>
                        </button>
                      </td>

                      {/* Created Date */}
                      <td className="py-3.5 px-4 text-slate-500 font-medium">
                        {formatDate(u.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Details */}
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Edit User Details & Role"
                            aria-label={`Edit ${u.name}`}
                          >
                            <SlidersHorizontal size={15} />
                          </button>

                          {/* Reset Password */}
                          <button
                            onClick={() => openResetPasswordModal(u)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            title="Reset Password"
                            aria-label={`Reset password for ${u.name}`}
                          >
                            <KeyRound size={15} />
                          </button>

                          {/* Toggle Active/Inactive */}
                          <button
                            onClick={() => openStatusConfirm(u)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              u.isActive
                                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={u.isActive ? 'Deactivate Account' : 'Activate Account'}
                            aria-label={u.isActive ? `Deactivate ${u.name}` : `Activate ${u.name}`}
                          >
                            {u.isActive ? <UserX size={15} /> : <UserCheck size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500">
              <div>
                Showing <span className="font-semibold text-slate-700">{(page - 1) * limit + 1}</span> to{' '}
                <span className="font-semibold text-slate-700">{Math.min(page * limit, total)}</span> of{' '}
                <span className="font-semibold text-slate-700">{total}</span> accounts
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  icon={ChevronLeft}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  Previous
                </Button>
                <span className="px-2 font-medium text-slate-700">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  icon={ChevronRight}
                  iconPosition="right"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ========================================================= */}
      {/* MODAL 1: Create User */}
      {/* ========================================================= */}
      <Modal
        isOpen={createModalOpen}
        onClose={closeCreateModal}
        title={newlyCreatedPassword ? 'User Created Successfully' : 'Create New User Account'}
        subtitle={
          newlyCreatedPassword
            ? 'Deliver the temporary credentials securely to the user.'
            : 'Add a new operator, approver, or administrator to the workspace.'
        }
        maxWidth="md"
      >
        {newlyCreatedPassword ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-sm text-emerald-800">
                <CheckCircle2 size={18} />
                <span>Account Created Successfully</span>
              </div>
              <p className="text-xs leading-relaxed text-emerald-700">
                A temporary password has been generated for this account. This password will <strong>only be displayed once</strong> and is never logged or stored in plaintext.
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Temporary Password
              </span>
              <div className="flex items-center gap-2 p-2.5 bg-slate-900 rounded-xl text-white font-mono text-xs select-all">
                <span className="flex-1 tracking-wider">{newlyCreatedPassword}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(newlyCreatedPassword, setCopiedNewPassword)}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-sans font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copiedNewPassword ? (
                    <>
                      <Check size={12} />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
              <span>
                Please securely send this temporary password to the user. Closing this dialog will purge it from memory.
              </span>
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="primary" onClick={closeCreateModal}>
                Done & Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            {createFormError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{createFormError}</span>
              </div>
            )}

            <div>
              <label htmlFor={createNameId} className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                id={createNameId}
                type="text"
                required
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Vikram Sharma"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label htmlFor={createEmailId} className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                id={createEmailId}
                type="email"
                required
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="vikram@bizops.ai"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label htmlFor={createRoleId} className="block text-xs font-semibold text-slate-700 mb-1">
                Role & Permissions <span className="text-rose-500">*</span>
              </label>
              <select
                id={createRoleId}
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value as UserRole)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs sm:text-sm text-slate-800 bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="OPERATOR">OPERATOR - Day-to-day operations and task management</option>
                <option value="APPROVER">APPROVER - Governance and approval request sign-off</option>
                <option value="ADMIN">ADMIN - Full administrative access and user management</option>
              </select>

              {createRole === 'ADMIN' && (
                <div className="mt-2 p-2.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-800 text-[11px] flex items-start gap-1.5">
                  <ShieldCheck size={14} className="shrink-0 mt-0.5 text-purple-600" />
                  <span>
                    Administrators have complete control over all business settings, sensitive financial operations, and user credentials.
                  </span>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor={createPasswordId} className="text-xs font-semibold text-slate-700">
                  Custom Temporary Password (Optional)
                </label>
                <span className="text-[10px] text-slate-400">Leave blank to auto-generate</span>
              </div>
              <div className="relative">
                <input
                  id={createPasswordId}
                  type={showCreatePassword ? 'text' : 'password'}
                  value={createCustomPassword}
                  onChange={(e) => setCreateCustomPassword(e.target.value)}
                  placeholder="Min 8 characters, or leave blank"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 pr-10 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showCreatePassword ? 'Hide password' : 'Show password'}
                >
                  {showCreatePassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeCreateModal}>
                Cancel
              </Button>
              <Button type="submit" variant="purple-gradient" loading={createSubmitting}>
                Create Account
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 2: Edit User */}
      {/* ========================================================= */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit User Details & Role"
        subtitle={`Updating settings for ${selectedUser?.email || ''}`}
        maxWidth="md"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {editFormError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{editFormError}</span>
            </div>
          )}

          <div>
            <label htmlFor={editNameId} className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              id={editNameId}
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs sm:text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div>
            <label htmlFor={editRoleId} className="block text-xs font-semibold text-slate-700 mb-1">
              User Role
            </label>
            <select
              id={editRoleId}
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as UserRole)}
              disabled={currentUser?.id === selectedUser?.id}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs sm:text-sm text-slate-800 bg-white disabled:bg-slate-100 disabled:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="OPERATOR">OPERATOR</option>
              <option value="APPROVER">APPROVER</option>
              <option value="ADMIN">ADMIN</option>
            </select>

            {currentUser?.id === selectedUser?.id ? (
              <p className="text-[11px] text-amber-700 mt-1.5 flex items-center gap-1 font-medium">
                <AlertTriangle size={13} />
                You cannot demote your own account. Another administrator must change your role.
              </p>
            ) : selectedUser?.role === 'ADMIN' && editRole !== 'ADMIN' ? (
              <p className="text-[11px] text-amber-700 mt-1.5 flex items-center gap-1 font-medium">
                <AlertTriangle size={13} />
                Warning: Demoting an administrator removes their administrative privileges. The system requires at least one active administrator.
              </p>
            ) : editRole === 'ADMIN' && selectedUser?.role !== 'ADMIN' ? (
              <p className="text-[11px] text-purple-700 mt-1.5 flex items-center gap-1 font-medium">
                <ShieldCheck size={13} />
                Promoting this user to ADMIN will grant them full administrative and user-management control.
              </p>
            ) : null}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={editSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 3: Status Confirmation (Activate / Deactivate) */}
      {/* ========================================================= */}
      <Modal
        isOpen={statusConfirmOpen}
        onClose={() => setStatusConfirmOpen(false)}
        title={selectedUser?.isActive ? 'Deactivate User Account' : 'Activate User Account'}
        subtitle={selectedUser?.email || ''}
        maxWidth="md"
      >
        <div className="space-y-4">
          {statusError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{statusError}</span>
            </div>
          )}

          {selectedUser?.isActive ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs leading-relaxed space-y-2">
              <div className="flex items-center gap-2 font-semibold text-rose-800">
                <AlertTriangle size={16} />
                <span>Confirm Account Deactivation</span>
              </div>
              <p>
                Are you sure you want to deactivate the account for{' '}
                <strong>{selectedUser?.name}</strong>?
              </p>
              <ul className="list-disc list-inside space-y-1 text-rose-700">
                <li>All active sessions for this user will be revoked immediately.</li>
                <li>The user will be blocked from logging in or making API requests.</li>
                {selectedUser?.role === 'ADMIN' && (
                  <li>
                    <strong>Last-Admin Invariant:</strong> The operation will be rejected if this is the last active Administrator.
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs leading-relaxed space-y-1">
              <div className="flex items-center gap-2 font-semibold text-emerald-800">
                <CheckCircle2 size={16} />
                <span>Confirm Account Activation</span>
              </div>
              <p>
                This will restore access for <strong>{selectedUser?.name}</strong>. The user will be able to log in with their existing credentials.
              </p>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStatusConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={selectedUser?.isActive ? 'danger' : 'primary'}
              loading={statusSubmitting}
              onClick={handleStatusSubmit}
            >
              {selectedUser?.isActive ? 'Yes, Deactivate Account' : 'Yes, Activate Account'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 4: Reset Password */}
      {/* ========================================================= */}
      <Modal
        isOpen={resetPasswordOpen}
        onClose={closeResetPasswordModal}
        title={resetSuccessPassword ? 'Password Reset Complete' : 'Reset User Password'}
        subtitle={`Target user: ${selectedUser?.name} (${selectedUser?.email})`}
        maxWidth="md"
      >
        {resetSuccessPassword ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-sm text-emerald-800">
                <CheckCircle2 size={18} />
                <span>New Temporary Password Generated</span>
              </div>
              <p className="text-xs leading-relaxed text-emerald-700">
                The password for <strong>{selectedUser?.name}</strong> has been updated, and previous active sessions were invalidated.
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Temporary Password
              </span>
              <div className="flex items-center gap-2 p-2.5 bg-slate-900 rounded-xl text-white font-mono text-xs select-all">
                <span className="flex-1 tracking-wider">{resetSuccessPassword}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(resetSuccessPassword, setCopiedResetPassword)}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-sans font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copiedResetPassword ? (
                    <>
                      <Check size={12} />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
              <span>
                Please provide this temporary password securely. It is not saved in browser storage or plaintext database columns.
              </span>
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="primary" onClick={closeResetPasswordModal}>
                Done & Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            {resetError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor={resetPasswordInputId} className="text-xs font-semibold text-slate-700">
                  Custom Password (Optional)
                </label>
                <span className="text-[10px] text-slate-400">Leave blank to auto-generate</span>
              </div>
              <div className="relative">
                <input
                  id={resetPasswordInputId}
                  type={showResetPassword ? 'text' : 'password'}
                  value={resetCustomPassword}
                  onChange={(e) => setResetCustomPassword(e.target.value)}
                  placeholder="Min 8 characters, or leave blank"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 pr-10 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showResetPassword ? 'Hide password' : 'Show password'}
                >
                  {showResetPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id={resetRevokeCheckboxId}
                checked={resetRevokeSessions}
                onChange={(e) => setResetRevokeSessions(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <label htmlFor={resetRevokeCheckboxId} className="text-xs text-slate-700 font-medium cursor-pointer">
                Revoke all active sessions immediately (Recommended)
              </label>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeResetPasswordModal}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={resetSubmitting}>
                Reset Password
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 5: Sessions Inspector & Revocation */}
      {/* ========================================================= */}
      <Modal
        isOpen={sessionsModalOpen}
        onClose={() => setSessionsModalOpen(false)}
        title="Active User Sessions"
        subtitle={`Inspecting sessions for ${selectedUser?.name || ''} (${selectedUser?.email || ''})`}
        maxWidth="lg"
      >
        <div className="space-y-4">
          {sessionsError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{sessionsError}</span>
            </div>
          )}

          {/* Header Action Bar */}
          <div className="flex items-center justify-between gap-2 pb-2">
            <span className="text-xs text-slate-500 font-medium">
              {sessions.length} active session{sessions.length === 1 ? '' : 's'} registered in PostgreSQL
            </span>
            {sessions.length > 0 && (
              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                loading={revokingAll}
                onClick={handleRevokeAllSessions}
              >
                Revoke All Sessions
              </Button>
            )}
          </div>

          {/* Sessions List */}
          {sessionsLoading ? (
            <div className="py-8 text-center text-slate-400">
              <RefreshCw size={20} className="animate-spin mx-auto text-indigo-600 mb-2" />
              <p className="text-xs font-medium">Retrieving active sessions...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Radio size={24} className="mx-auto text-slate-300 mb-1" />
              <p className="text-xs font-semibold text-slate-700">No active sessions found</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                This user is not currently logged into any active client.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="py-3 px-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 rounded-xl transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-600 shrink-0 mt-0.5">
                      {getDeviceIcon(s.device)}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-800">
                          {s.device || 'Standard Client'}
                        </span>
                        {s.isCurrent && (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 border border-emerald-200">
                            Current Session
                          </span>
                        )}
                        {s.ipPreview && (
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1 py-0.2 rounded">
                            {s.ipPreview}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock size={10} /> Started: {formatDateTime(s.createdAt)}
                        </span>
                        <span>•</span>
                        <span>Last Active: {formatDateTime(s.lastActiveAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Trash2}
                      loading={revokingSessionId === s.id}
                      onClick={() => handleRevokeSingleSession(s.id)}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-100"
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <Button variant="outline" onClick={() => setSessionsModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
