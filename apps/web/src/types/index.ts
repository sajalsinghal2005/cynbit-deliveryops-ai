export type ApprovalRisk = 'LOW' | 'MEDIUM' | 'HIGH';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalItem {
  id: string;
  title: string;
  description: string;
  amount?: string;
  entity: string;
  risk: ApprovalRisk;
  status: ApprovalStatus;
  timestamp: string;
  type: 'refund' | 'invoice_reminder' | 'order_cancel' | 'discount' | 'vendor_payout';
  reason?: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'success' | 'info' | 'warning' | 'purple';
  category: 'invoice' | 'customer' | 'approval' | 'email' | 'order' | 'analytics';
}

export interface StatMetric {
  id: string;
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  description: string;
  sparkline: number[];
  color: 'indigo' | 'amber' | 'emerald' | 'blue';
}

export interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  avatar: string;
  totalSpend: string;
  ordersCount: number;
  status: 'active' | 'inactive' | 'lead';
  aiHealthScore: number;
  lastActive: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerCompany: string;
  date: string;
  amount: string;
  status: 'completed' | 'processing' | 'pending_approval' | 'cancelled';
  itemsCount: number;
  aiRiskLevel: 'low' | 'medium' | 'high';
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientCompany: string;
  issueDate: string;
  dueDate: string;
  amount: string;
  status: 'paid' | 'pending' | 'overdue';
  autoRemind: boolean;
}

export interface AgentTask {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'completed' | 'running' | 'queued' | 'failed';
  executedAt: string;
  duration: string;
  toolsUsed: string[];
}

export interface SanitizedApprovalSummary {
  id: string;
  title: string;
  description: string;
  actionType: string;
  toolName: string;
  customer: string;
  amount: string | null;
  risk: string;
  status: string;
  executionStatus: string;
  relatedInvoiceId: string | null;
  relatedCustomerId: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface AuditEventRecord {
  id: string;
  approvalRequestId: string | null;
  eventType: string;
  actor: string;
  payload: Record<string, any>;
  timestamp: string;
  approvalRequest?: SanitizedApprovalSummary | null;
}

export interface AuditPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface AuditStats {
  total: number;
  approved: number;
  rejected: number;
  proposals: number;
}

export interface AuditApiResponse {
  success: boolean;
  data: AuditEventRecord[];
  pagination: AuditPagination;
  stats: AuditStats;
  message?: string;
}

export * from './auth';
export * from './user-admin';
export * from './agent';


