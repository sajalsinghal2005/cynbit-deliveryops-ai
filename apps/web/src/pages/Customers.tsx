import { useState } from 'react';
import { Search, Plus, Mail, ArrowUpRight, Building2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import type { Customer } from '../types';

const mockCustomers: Customer[] = [
  {
    id: '1',
    name: 'Rahul Sharma',
    company: 'Sharma Infotech Pvt Ltd',
    email: 'rahul.s@sharmainfotech.in',
    avatar: 'RS',
    totalSpend: '₹4,85,000',
    ordersCount: 18,
    status: 'active',
    aiHealthScore: 94,
    lastActive: '2 min ago',
  },
  {
    id: '2',
    name: 'Ananya Iyer',
    company: 'ABC Technologies',
    email: 'ananya@abctech.io',
    avatar: 'AI',
    totalSpend: '₹12,40,000',
    ordersCount: 42,
    status: 'active',
    aiHealthScore: 88,
    lastActive: '5 min ago',
  },
  {
    id: '3',
    name: 'Vikram Mehta',
    company: 'Zenith Media Global',
    email: 'vikram@zenithmedia.com',
    avatar: 'VM',
    totalSpend: '₹8,90,000',
    ordersCount: 26,
    status: 'active',
    aiHealthScore: 96,
    lastActive: '2 hours ago',
  },
  {
    id: '4',
    name: 'Pooja Verma',
    company: 'Global Logistics Hub',
    email: 'pooja.v@globallogistics.co',
    avatar: 'PV',
    totalSpend: '₹3,15,000',
    ordersCount: 9,
    status: 'inactive',
    aiHealthScore: 62,
    lastActive: '4 days ago',
  },
  {
    id: '5',
    name: 'Devendra Patel',
    company: 'CoreCompute Cloud',
    email: 'dev@corecompute.net',
    avatar: 'DP',
    totalSpend: '₹18,50,000',
    ordersCount: 64,
    status: 'active',
    aiHealthScore: 98,
    lastActive: '10 min ago',
  },
];

export default function Customers() {
  const [search, setSearch] = useState('');
  const [customers] = useState<Customer[]>(mockCustomers);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.company.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold text-slate-900">
              Customers & CRM
            </h1>
            <Badge variant="primary" size="md">
              {mockCustomers.length} Total Accounts
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            AI-enriched customer profiles, satisfaction scoring, and engagement history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="purple-gradient" size="sm" icon={Plus}>
            Add Customer
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs">
        <Search size={18} className="text-slate-400 shrink-0 ml-1" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by customer name, company, or email..."
          className="w-full bg-transparent text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none"
        />
      </div>

      {/* Customers Table / Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Customer / Company</th>
                <th className="py-3.5 px-4">Lifetime Spend</th>
                <th className="py-3.5 px-4">Orders</th>
                <th className="py-3.5 px-4">AI Health Score</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-4 px-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-white shadow-xs">
                        {c.avatar}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{c.name}</p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Building2 size={11} /> {c.company}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-bold text-slate-900">{c.totalSpend}</td>
                  <td className="py-4 px-4 font-medium text-slate-600">{c.ordersCount} orders</td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-indigo-600">{c.aiHealthScore}%</span>
                      <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full"
                          style={{ width: `${c.aiHealthScore}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <Badge variant={c.status === 'active' ? 'success' : 'neutral'} size="sm" dot>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="py-4 px-4 sm:px-6 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                        <Mail size={15} />
                      </button>
                      <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors">
                        <ArrowUpRight size={15} />
                      </button>
                    </div>
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
