import { useState } from 'react';
import { Search, Plus, ArrowUpRight, ShieldCheck, AlertCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import type { Order } from '../types';

const mockOrders: Order[] = [
  {
    id: '1',
    orderNumber: 'ORD-1048',
    customerName: 'Rahul Sharma',
    customerCompany: 'Sharma Infotech Pvt Ltd',
    date: 'Oct 7, 2026',
    amount: '₹84,500',
    status: 'completed',
    itemsCount: 4,
    aiRiskLevel: 'low',
  },
  {
    id: '2',
    orderNumber: 'ORD-1047',
    customerName: 'Ananya Iyer',
    customerCompany: 'ABC Technologies',
    date: 'Oct 7, 2026',
    amount: '₹1,25,000',
    status: 'processing',
    itemsCount: 12,
    aiRiskLevel: 'low',
  },
  {
    id: '3',
    orderNumber: 'ORD-1042',
    customerName: 'Rahul Sharma',
    customerCompany: 'Sharma Infotech Pvt Ltd',
    date: 'Oct 6, 2026',
    amount: '₹25,000',
    status: 'pending_approval',
    itemsCount: 2,
    aiRiskLevel: 'high',
  },
  {
    id: '4',
    orderNumber: 'ORD-1024',
    customerName: 'Pooja Verma',
    customerCompany: 'Global Logistics Hub',
    date: 'Oct 5, 2026',
    amount: '₹12,500',
    status: 'cancelled',
    itemsCount: 1,
    aiRiskLevel: 'high',
  },
  {
    id: '5',
    orderNumber: 'ORD-1019',
    customerName: 'Devendra Patel',
    customerCompany: 'CoreCompute Cloud',
    date: 'Oct 4, 2026',
    amount: '₹3,40,000',
    status: 'completed',
    itemsCount: 8,
    aiRiskLevel: 'low',
  },
];

export default function Orders() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = mockOrders.filter((o) => {
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.customerCompany.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success" size="sm" dot>Completed</Badge>;
      case 'processing':
        return <Badge variant="primary" size="sm" dot>Processing</Badge>;
      case 'pending_approval':
        return <Badge variant="warning" size="sm" dot>Pending Approval</Badge>;
      case 'cancelled':
        return <Badge variant="danger" size="sm">Cancelled</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold text-slate-900">
              Orders & Fulfillment
            </h1>
            <Badge variant="purple" size="md">
              AI Fraud Guard Active
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time order processing, automated stock validation, and anomaly detection.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" icon={Plus}>
            Create Order
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs w-full sm:max-w-md">
          <Search size={18} className="text-slate-400 shrink-0 ml-1" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order # or customer..."
            className="w-full bg-transparent text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none"
          />
        </div>

        <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 self-stretch sm:self-auto justify-between">
          {['all', 'completed', 'processing', 'pending_approval'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all ${
                statusFilter === st
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {st === 'pending_approval' ? 'Approvals' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Order ID</th>
                <th className="py-3.5 px-4">Customer & Company</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">AI Risk Check</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-4 px-4 sm:px-6 font-bold text-indigo-600 font-mono">
                    {order.orderNumber}
                  </td>
                  <td className="py-4 px-4">
                    <p className="font-bold text-slate-900">{order.customerName}</p>
                    <p className="text-[11px] text-slate-500">{order.customerCompany}</p>
                  </td>
                  <td className="py-4 px-4 text-slate-600">{order.date}</td>
                  <td className="py-4 px-4 font-bold text-slate-900">{order.amount}</td>
                  <td className="py-4 px-4">{getStatusBadge(order.status)}</td>
                  <td className="py-4 px-4">
                    {order.aiRiskLevel === 'low' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                        <ShieldCheck size={14} /> Clean
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                        <AlertCircle size={14} /> Flagged
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 sm:px-6 text-right">
                    <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors">
                      <ArrowUpRight size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
