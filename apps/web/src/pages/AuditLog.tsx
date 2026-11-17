import { useState, useEffect, useCallback } from 'react';
import {
  History,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Sparkles,
  Bot,
  User,
  FileCode2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  AlertTriangle,
  Layers,
  Key,
  ShieldAlert,
  Mail,
  UserCheck,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import type { AuditEventRecord, AuditApiResponse, AuditStats } from '../types';
import { api } from '../lib/api';

// Authoritative Event Metadata Registry
interface EventMetadata {
  label: string;
  badgeClass: string;
  icon: React.ElementType;
  iconClass: string;
  outcomeText: string;
  outcomeClass: string;
  outcomeIcon: React.ElementType;
}

const EVENT_METADATA_REGISTRY: Record<string, EventMetadata> = {
  DECISION_APPROVED: {
    label: 'DECISION_APPROVED',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
    icon: CheckCircle2,
    iconClass: 'text-emerald-600',
    outcomeText: 'Executed (Simulated / Resend)',
    outcomeClass: 'text-emerald-700 font-semibold',
    outcomeIcon: CheckCircle2,
  },
  DECISION_APPROVED_EXECUTION_FAILED: {
    label: 'EXECUTION_FAILED',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/70',
    icon: AlertTriangle,
    iconClass: 'text-amber-600',
    outcomeText: 'Execution Failed',
    outcomeClass: 'text-amber-800 font-semibold',
    outcomeIcon: AlertTriangle,
  },
  DECISION_REJECTED: {
    label: 'DECISION_REJECTED',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/70',
    icon: XCircle,
    iconClass: 'text-rose-600',
    outcomeText: 'Rejected & Blocked',
    outcomeClass: 'text-rose-700 font-semibold',
    outcomeIcon: XCircle,
  },
  PROPOSAL_CREATED: {
    label: 'PROPOSAL_CREATED',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200/70',
    icon: Sparkles,
    iconClass: 'text-purple-600',
    outcomeText: 'Awaiting Authorization',
    outcomeClass: 'text-purple-700 font-semibold',
    outcomeIcon: Sparkles,
  },
  AI_REQUEST_ORCHESTRATED: {
    label: 'AI_ORCHESTRATED',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/70',
    icon: Bot,
    iconClass: 'text-blue-600',
    outcomeText: 'Query Processed by AI',
    outcomeClass: 'text-blue-700 font-semibold',
    outcomeIcon: Bot,
  },
  USER_LOGIN_SUCCESS: {
    label: 'LOGIN_SUCCESS',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200/70',
    icon: ShieldCheck,
    iconClass: 'text-teal-600',
    outcomeText: 'Session Authenticated',
    outcomeClass: 'text-teal-700 font-semibold',
    outcomeIcon: CheckCircle2,
  },
  USER_LOGIN_FAILURE: {
    label: 'LOGIN_FAILURE',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/70',
    icon: ShieldAlert,
    iconClass: 'text-rose-600',
    outcomeText: 'Authentication Denied',
    outcomeClass: 'text-rose-700 font-semibold',
    outcomeIcon: XCircle,
  },
  USER_LOGOUT: {
    label: 'USER_LOGOUT',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: LogOut,
    iconClass: 'text-slate-500',
    outcomeText: 'Session Terminated',
    outcomeClass: 'text-slate-600 font-medium',
    outcomeIcon: LogOut,
  },
  EMAIL_WEBHOOK_PROCESSED: {
    label: 'EMAIL_WEBHOOK',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/70',
    icon: Mail,
    iconClass: 'text-indigo-600',
    outcomeText: 'Webhook Lifecycle Recorded',
    outcomeClass: 'text-indigo-700 font-semibold',
    outcomeIcon: CheckCircle2,
  },
  USER_CREATED: {
    label: 'USER_CREATED',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
    icon: UserCheck,
    iconClass: 'text-emerald-600',
    outcomeText: 'Account Provisioned',
    outcomeClass: 'text-emerald-700 font-semibold',
    outcomeIcon: CheckCircle2,
  },
  USER_UPDATED: {
    label: 'USER_UPDATED',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/70',
    icon: User,
    iconClass: 'text-sky-600',
    outcomeText: 'User Profile Updated',
    outcomeClass: 'text-sky-700 font-semibold',
    outcomeIcon: CheckCircle2,
  },
  USER_ACTIVATED: {
    label: 'USER_ACTIVATED',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
    icon: CheckCircle2,
    iconClass: 'text-emerald-600',
    outcomeText: 'Account Enabled',
    outcomeClass: 'text-emerald-700 font-semibold',
    outcomeIcon: CheckCircle2,
  },
  USER_DEACTIVATED: {
    label: 'USER_DEACTIVATED',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/70',
    icon: XCircle,
    iconClass: 'text-rose-600',
    outcomeText: 'Account Disabled',
    outcomeClass: 'text-rose-700 font-semibold',
    outcomeIcon: XCircle,
  },
  USER_PASSWORD_RESET: {
    label: 'PASSWORD_RESET',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/70',
    icon: Key,
    iconClass: 'text-amber-600',
    outcomeText: 'Credentials Rotated',
    outcomeClass: 'text-amber-800 font-semibold',
    outcomeIcon: Key,
  },
  USER_SESSION_REVOKED: {
    label: 'SESSION_REVOKED',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/70',
    icon: ShieldAlert,
    iconClass: 'text-amber-600',
    outcomeText: 'Session Terminated',
    outcomeClass: 'text-amber-800 font-semibold',
    outcomeIcon: ShieldAlert,
  },
  USER_ALL_SESSIONS_REVOKED: {
    label: 'ALL_SESSIONS_REVOKED',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/70',
    icon: ShieldAlert,
    iconClass: 'text-rose-600',
    outcomeText: 'All Sessions Cleared',
    outcomeClass: 'text-rose-700 font-semibold',
    outcomeIcon: ShieldAlert,
  },
};

function getEventMetadata(eventType: string): EventMetadata {
  return (
    EVENT_METADATA_REGISTRY[eventType] || {
      label: eventType,
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      icon: History,
      iconClass: 'text-slate-500',
      outcomeText: 'Event Persisted',
      outcomeClass: 'text-slate-600 font-medium',
      outcomeIcon: History,
    }
  );
}

function getEventContext(event: AuditEventRecord): { title: string; subtitle: string; tag?: string } {
  if (event.approvalRequest?.title) {
    return {
      title: event.approvalRequest.title,
      subtitle: [
        event.approvalRequest.customer,
        event.approvalRequest.amount,
      ].filter(Boolean).join(' • '),
      tag: event.approvalRequest.actionType,
    };
  }

  const p = event.payload || {};

  switch (event.eventType) {
    case 'USER_LOGIN_SUCCESS':
      return {
        title: 'User Login Successful',
        subtitle: `Role: ${p.role || 'User'} • IP: ${p.ipAddress || 'unknown'}`,
        tag: 'AUTH_SESSION',
      };
    case 'USER_LOGIN_FAILURE':
      return {
        title: 'Failed Login Attempt',
        subtitle: `Reason: ${p.reason || 'Invalid credentials'} • Attempted: ${p.attemptedEmail || event.actor}`,
        tag: 'SECURITY_ALERT',
      };
    case 'USER_LOGOUT':
      return {
        title: 'User Session Logged Out',
        subtitle: `IP: ${p.ipAddress || 'unknown'}`,
        tag: 'AUTH_LOGOUT',
      };
    case 'AI_REQUEST_ORCHESTRATED':
      return {
        title: p.reasoningSummary || p.requestId || 'AI Operational Query',
        subtitle: `Provider: ${p.provider || 'LLM'} (${p.model || 'default'}) • Latency: ${p.latencyMs ? `${p.latencyMs}ms` : 'N/A'}`,
        tag: p.decisionType || 'AI_QUERY',
      };
    case 'PROPOSAL_CREATED':
      return {
        title: p.title || `Approval Proposal Created (${event.approvalRequestId || ''})`,
        subtitle: `Customer: ${p.customer || 'N/A'} • Tool: ${p.toolName || 'consequential'}`,
        tag: p.actionType || 'HITL_PROPOSAL',
      };
    case 'DECISION_APPROVED':
      return {
        title: 'Approval Proposal Authorized',
        subtitle: `Action: ${p.action || 'Approved'} • Approver: ${p.decidedByEmail || event.actor}`,
        tag: 'HITL_EXECUTION',
      };
    case 'DECISION_REJECTED':
      return {
        title: 'Approval Proposal Rejected',
        subtitle: `Reason: ${p.rejectionReason || 'Blocked by reviewer'} • Reviewer: ${p.decidedByEmail || event.actor}`,
        tag: 'HITL_BLOCKED',
      };
    case 'DECISION_APPROVED_EXECUTION_FAILED':
      return {
        title: 'Proposal Execution Failed',
        subtitle: `Action: ${p.action || 'Consequential'} • Error: ${p.executionResult?.error || 'Execution failure'}`,
        tag: 'EXECUTION_ERROR',
      };
    case 'EMAIL_WEBHOOK_PROCESSED':
      return {
        title: `Email Lifecycle: ${p.deliveryEventType || 'Event'}`,
        subtitle: `Subject: ${p.subject || 'Transactional Email'}`,
        tag: 'WEBHOOK',
      };
    default:
      if (event.eventType.startsWith('USER_')) {
        return {
          title: `User Administration: ${event.eventType.replace('USER_', '')}`,
          subtitle: `Target: ${p.userEmail || p.targetUserId || p.userId || 'User account'}`,
          tag: 'RBAC_ADMIN',
        };
      }
      return {
        title: p.title || event.eventType,
        subtitle: `Actor: ${event.actor}`,
        tag: 'OPERATIONAL',
      };
  }
}

function getActorAttribution(event: AuditEventRecord): {
  displayName: string;
  roleBadge: string;
  isAgent: boolean;
  isSystem: boolean;
} {
  const actor = event.actor || 'Unknown';
  const isAgent = actor === 'AI_AGENT' || actor.includes('via AI_AGENT') || actor.includes('AI Agent');
  const isSystem = actor.startsWith('SYSTEM') || actor === 'ANONYMOUS';

  let roleBadge = 'Authenticated User';
  if (isAgent) {
    roleBadge = actor.includes('via AI_AGENT') ? 'Operator via AI' : 'Autonomous Agent';
  } else if (isSystem) {
    roleBadge = actor === 'ANONYMOUS' ? 'Unauthenticated' : 'System Service';
  } else if (event.eventType.startsWith('DECISION_')) {
    roleBadge = 'Human Authorizer';
  } else if (event.eventType.startsWith('USER_LOGIN')) {
    roleBadge = event.eventType === 'USER_LOGIN_SUCCESS' ? 'Authenticated User' : 'Login Attempt';
  }

  return {
    displayName: actor,
    roleBadge,
    isAgent,
    isSystem,
  };
}

export default function AuditLog() {
  const [events, setEvents] = useState<AuditEventRecord[]>([]);
  const [stats, setStats] = useState<AuditStats>({
    total: 0,
    approved: 0,
    rejected: 0,
    proposals: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters and Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Selected event for payload modal inspector
  const [selectedEvent, setSelectedEvent] = useState<AuditEventRecord | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Build query and fetch from Fastify backend
  const fetchAuditEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams();
      queryParams.set('page', String(currentPage));
      queryParams.set('limit', String(pageSize));

      if (searchQuery.trim()) {
        queryParams.set('search', searchQuery.trim());
      }
      if (eventTypeFilter !== 'ALL') {
        queryParams.set('eventType', eventTypeFilter);
      }
      if (statusFilter !== 'ALL') {
        queryParams.set('status', statusFilter);
      }

      // Handle date filters
      if (dateRangeFilter === 'TODAY') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        queryParams.set('startDate', today.toISOString());
      } else if (dateRangeFilter === '7D') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        queryParams.set('startDate', d.toISOString());
      } else if (dateRangeFilter === '30D') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        queryParams.set('startDate', d.toISOString());
      }

      const json = await api.get<AuditApiResponse>(`/api/audit-events?${queryParams.toString()}`);

      if (json.success && Array.isArray(json.data)) {
        setEvents(json.data);
        setTotalPages(json.pagination?.totalPages || 1);
        setTotalCount(json.pagination?.total || 0);
        if (json.stats) {
          setStats(json.stats);
        }
      } else {
        throw new Error(json.message || 'Malformed response from audit API');
      }
    } catch (err: any) {
      console.error('Audit log fetch error:', err);
      setError(err?.message || 'Unable to connect to BizOps backend audit service.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchQuery, eventTypeFilter, statusFilter, dateRangeFilter]);

  // Trigger fetch when dependency variables update
  useEffect(() => {
    fetchAuditEvents();
  }, [fetchAuditEvents]);

  // Handle Search Input Change (reset to page 1)
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleEventTypeChange = (val: string) => {
    setEventTypeFilter(val);
    setCurrentPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  const handleDateRangeChange = (val: string) => {
    setDateRangeFilter(val);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setEventTypeFilter('ALL');
    setStatusFilter('ALL');
    setDateRangeFilter('ALL');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    eventTypeFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    dateRangeFilter !== 'ALL';

  // Format timestamp nicely
  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return {
        formatted: date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }),
        relative: getRelativeTime(date),
      };
    } catch {
      return { formatted: isoString || 'N/A', relative: '' };
    }
  };

  const getRelativeTime = (date: Date) => {
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const handleCopyPayload = (payload: any) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20">
              <History size={19} strokeWidth={2.2} />
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900">
              Activity & Audit Log
            </h1>
            <Badge variant="purple" size="sm" dot>
              PostgreSQL Audit Trail
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-2xl">
            Persistent audit trail of AI actions, proposal generation, and human authorization decisions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAuditEvents}
            disabled={loading}
            className="border-slate-200 hover:border-slate-300"
          >
            <RefreshCw size={14} className={`mr-1.5 ${loading ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </Button>
        </div>
      </div>

      {/* 2. KPI Summary Cards (Derive strictly from actual PostgreSQL AuditEvent counts) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Audit Records in Scope */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Events</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Layers size={14} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mt-2">{stats.total}</h3>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            {dateRangeFilter === 'ALL' ? 'Persisted to PostgreSQL' : 'Matching selected scope'}
          </p>
        </div>

        {/* Decisions Approved */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Decisions Approved</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={14} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-emerald-600 mt-2">{stats.approved}</h3>
          <p className="text-[11px] text-emerald-700 font-medium mt-1">Actions executed by human authorizer</p>
        </div>

        {/* Decisions Rejected */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Decisions Rejected</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <XCircle size={14} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-rose-600 mt-2">{stats.rejected}</h3>
          <p className="text-[11px] text-rose-700 font-medium mt-1">Proposals blocked by reviewer</p>
        </div>

        {/* AI Proposals Created */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Proposals</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <Sparkles size={14} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-purple-600 mt-2">{stats.proposals}</h3>
          <p className="text-[11px] text-purple-700 font-medium mt-1">Consequential actions staged</p>
        </div>
      </div>

      {/* 3. Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Keyword Search */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by actor, event type, request ID, customer, or title..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 transition-colors focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Filter Select Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Event Type Filter (Populated with all existing backend event types) */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">Event:</span>
              <select
                value={eventTypeFilter}
                onChange={(e) => handleEventTypeChange(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:outline-none"
              >
                <option value="ALL">All Event Types</option>
                <optgroup label="HITL Governance">
                  <option value="DECISION_APPROVED">DECISION_APPROVED</option>
                  <option value="DECISION_REJECTED">DECISION_REJECTED</option>
                  <option value="PROPOSAL_CREATED">PROPOSAL_CREATED</option>
                  <option value="DECISION_APPROVED_EXECUTION_FAILED">EXECUTION_FAILED</option>
                </optgroup>
                <optgroup label="AI Operations">
                  <option value="AI_REQUEST_ORCHESTRATED">AI_REQUEST_ORCHESTRATED</option>
                </optgroup>
                <optgroup label="Authentication & Security">
                  <option value="USER_LOGIN_SUCCESS">USER_LOGIN_SUCCESS</option>
                  <option value="USER_LOGIN_FAILURE">USER_LOGIN_FAILURE</option>
                  <option value="USER_LOGOUT">USER_LOGOUT</option>
                </optgroup>
                <optgroup label="User Administration">
                  <option value="USER_CREATED">USER_CREATED</option>
                  <option value="USER_UPDATED">USER_UPDATED</option>
                  <option value="USER_ACTIVATED">USER_ACTIVATED</option>
                  <option value="USER_DEACTIVATED">USER_DEACTIVATED</option>
                  <option value="USER_PASSWORD_RESET">USER_PASSWORD_RESET</option>
                  <option value="USER_SESSION_REVOKED">USER_SESSION_REVOKED</option>
                </optgroup>
                <optgroup label="Integrations">
                  <option value="EMAIL_WEBHOOK_PROCESSED">EMAIL_WEBHOOK_PROCESSED</option>
                </optgroup>
              </select>
            </div>

            {/* Approval Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="PENDING">PENDING</option>
              </select>
            </div>

            {/* Date Range Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">Range:</span>
              <select
                value={dateRangeFilter}
                onChange={(e) => handleDateRangeChange(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:outline-none"
              >
                <option value="ALL">All Time</option>
                <option value="TODAY">Today</option>
                <option value="7D">Past 7 Days</option>
                <option value="30D">Past 30 Days</option>
              </select>
            </div>

            {/* Reset Filters button */}
            {hasActiveFilters && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleResetFilters}
                className="text-xs"
              >
                Reset Filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Error State (Non-blocking alert banner) */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-xs text-rose-800 flex items-start gap-3 animate-in fade-in">
          <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-rose-900">Database Connection Notice</h4>
            <p className="mt-0.5 text-rose-700">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAuditEvents}
              className="mt-2.5 bg-white border-rose-200 text-rose-700 hover:bg-rose-100"
            >
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* 5. Main Audit Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        {loading && events.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 animate-spin mb-3">
              <RefreshCw size={20} />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Loading audit trail...</h3>
            <p className="text-xs text-slate-500 mt-1">Retrieving verified events from PostgreSQL database.</p>
          </div>
        ) : error && events.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 mb-3">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Unable to load audit records</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              The backend audit service could not be reached. Check your connection or database status.
            </p>
            <Button variant="outline" size="sm" onClick={fetchAuditEvents} className="mt-4">
              Retry Query
            </Button>
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
              <History size={24} />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">No audit events matched</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {hasActiveFilters
                ? 'Try adjusting your search query, event filter, or date range.'
                : 'No audit records have been generated yet in the database.'}
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="mt-4"
              >
                Clear All Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Timestamp</th>
                  <th className="py-3.5 px-4">Event Type</th>
                  <th className="py-3.5 px-4">Actor</th>
                  <th className="py-3.5 px-4">Context & Entity</th>
                  <th className="py-3.5 px-4">Approval Ref</th>
                  <th className="py-3.5 px-4">Status / Outcome</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((event) => {
                  const { formatted, relative } = formatTimestamp(event.timestamp);
                  const meta = getEventMetadata(event.eventType);
                  const context = getEventContext(event);
                  const actorInfo = getActorAttribution(event);

                  const EventIcon = meta.icon;
                  const OutcomeIcon = meta.outcomeIcon;

                  return (
                    <tr
                      key={event.id}
                      className="hover:bg-indigo-50/30 transition-colors group"
                    >
                      {/* Timestamp */}
                      <td className="py-4 px-4 sm:px-6 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{formatted}</div>
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">{relative}</div>
                      </td>

                      {/* Event Type Badge (Authoritative mapping) */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border ${meta.badgeClass}`}>
                          <EventIcon size={12} className={meta.iconClass} />
                          {meta.label}
                        </span>
                      </td>

                      {/* Actor (Authoritative attribution) */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                              actorInfo.isAgent
                                ? 'bg-gradient-to-tr from-purple-500 to-indigo-600 text-white'
                                : actorInfo.isSystem
                                ? 'bg-slate-700 text-white'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {actorInfo.isAgent ? (
                              <Bot size={12} />
                            ) : actorInfo.isSystem ? (
                              <ShieldAlert size={12} />
                            ) : (
                              <User size={12} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 text-xs truncate max-w-[150px]" title={actorInfo.displayName}>
                              {actorInfo.displayName}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {actorInfo.roleBadge}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Context & Entity */}
                      <td className="py-4 px-4">
                        <div className="min-w-0 max-w-xs">
                          <p className="font-semibold text-slate-900 truncate" title={context.title}>
                            {context.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            {context.subtitle && (
                              <span className="text-[11px] text-slate-600 font-medium truncate max-w-[200px]" title={context.subtitle}>
                                {context.subtitle}
                              </span>
                            )}
                            {context.tag && (
                              <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded font-mono">
                                {context.tag}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Approval Reference */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {event.approvalRequestId ? (
                          <div className="space-y-0.5">
                            <span className="font-mono font-bold text-indigo-600 bg-indigo-50/70 border border-indigo-100 px-2 py-0.5 rounded text-[11px]">
                              {event.approvalRequestId}
                            </span>
                            {event.approvalRequest?.amount && (
                              <div className="text-[11px] font-semibold text-slate-700 mt-1">
                                {event.approvalRequest.amount}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>

                      {/* Status / Outcome (Always rendered, never blank) */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className={`flex items-center gap-1.5 text-xs ${meta.outcomeClass}`}>
                          <OutcomeIcon size={13} className="shrink-0" />
                          <span>{meta.outcomeText}</span>
                        </div>
                      </td>

                      {/* Action Details Button */}
                      <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedEvent(event)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 transition-all cursor-pointer"
                        >
                          <FileCode2 size={13} className="text-slate-400 group-hover:text-indigo-600" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-slate-50/70 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>
              Showing <span className="font-bold text-slate-900">{events.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to{' '}
              <span className="font-bold text-slate-900">{Math.min(currentPage * pageSize, totalCount)}</span> of{' '}
              <span className="font-bold text-slate-900">{totalCount}</span> events
            </span>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-500">Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || loading}
              className="px-2.5 py-1 text-xs"
            >
              <ChevronLeft size={14} className="mr-1" />
              Previous
            </Button>
            <span className="text-xs font-semibold px-2 text-slate-700">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || loading}
              className="px-2.5 py-1 text-xs"
            >
              Next
              <ChevronRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* 7. Payload & Event Inspector Modal */}
      {selectedEvent && (
        <Modal
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          title="Audit Event Inspector"
          maxWidth="2xl"
        >
          <div className="space-y-4">
            {/* Event Header Info */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Event ID</span>
                <p className="font-mono text-xs font-semibold text-indigo-700">{selectedEvent.id}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Event Type</span>
                <p className="text-xs font-bold text-slate-800">{selectedEvent.eventType}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Actor</span>
                <p className="text-xs font-semibold text-slate-800">{selectedEvent.actor}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Recorded At</span>
                <p className="text-xs text-slate-600">{formatTimestamp(selectedEvent.timestamp).formatted}</p>
              </div>
            </div>

            {/* Linked Approval Request Details (if present) */}
            {selectedEvent.approvalRequest && (
              <div className="rounded-xl border border-slate-200 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Linked Approval Context ({selectedEvent.approvalRequest.id})
                  </h4>
                  <Badge
                    variant={
                      selectedEvent.approvalRequest.status === 'APPROVED'
                        ? 'success'
                        : selectedEvent.approvalRequest.status === 'REJECTED'
                        ? 'danger'
                        : 'warning'
                    }
                    size="sm"
                  >
                    {selectedEvent.approvalRequest.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400">Action:</span>
                    <p className="font-semibold text-slate-800">{selectedEvent.approvalRequest.actionType}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Client / Target:</span>
                    <p className="font-semibold text-slate-800">{selectedEvent.approvalRequest.customer}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Amount Involved:</span>
                    <p className="font-semibold text-slate-800">{selectedEvent.approvalRequest.amount || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Tool:</span>
                    <p className="font-mono text-slate-700">{selectedEvent.approvalRequest.toolName}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Risk Level:</span>
                    <p className="font-semibold text-amber-600">{selectedEvent.approvalRequest.risk}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Decided By:</span>
                    <p className="font-semibold text-slate-800">{selectedEvent.approvalRequest.decidedBy || 'Pending'}</p>
                  </div>
                </div>
                {selectedEvent.approvalRequest.description && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400">Description:</span>
                    <p className="text-xs text-slate-600 mt-0.5">{selectedEvent.approvalRequest.description}</p>
                  </div>
                )}

                {/* Visual Consequential Action Lifecycle Stepper */}
                <div className="pt-3 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Consequential Action Audit Lifecycle:
                  </span>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[11px] font-semibold bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-purple-700 flex items-center gap-1">
                      <CheckCircle2 size={12} className="text-purple-600" /> PROPOSAL_CREATED
                    </span>
                    <span className="text-slate-300">→</span>
                    <span className={selectedEvent.approvalRequest.status === "PENDING" ? "text-amber-600 font-bold" : "text-slate-600"}>
                      PENDING REVIEW
                    </span>
                    <span className="text-slate-300">→</span>
                    <span className={selectedEvent.approvalRequest.status === "APPROVED" ? "text-emerald-700 font-bold" : selectedEvent.approvalRequest.status === "REJECTED" ? "text-rose-700 font-bold" : "text-slate-400"}>
                      {selectedEvent.approvalRequest.status === "APPROVED" ? "DECISION_APPROVED" : selectedEvent.approvalRequest.status === "REJECTED" ? "DECISION_REJECTED" : "AWAITING_DECISION"}
                    </span>
                    <span className="text-slate-300">→</span>
                    <span className={selectedEvent.approvalRequest.executionStatus === "SUCCESS" ? "text-emerald-700 font-bold" : selectedEvent.approvalRequest.executionStatus === "FAILED" ? "text-rose-700 font-bold" : "text-slate-400"}>
                      {selectedEvent.approvalRequest.executionStatus === "SUCCESS" ? "EXECUTION SUCCESS" : selectedEvent.approvalRequest.executionStatus === "FAILED" ? "EXECUTION FAILED" : "NOT EXECUTED"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Sanitized JSON Payload Viewer */}
            <div className="rounded-xl bg-slate-950 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <FileCode2 size={14} className="text-emerald-400" />
                  <span className="font-mono text-[11px] font-semibold text-slate-300">SANITIZED RAW PAYLOAD</span>
                </div>
                <button
                  onClick={() => handleCopyPayload(selectedEvent.payload)}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  {copiedPayload ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedPayload ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>
              <pre className="overflow-x-auto text-[11px] font-mono leading-relaxed text-emerald-400 max-h-64 p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                {JSON.stringify(selectedEvent.payload, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
