import { useState } from 'react';
import { Plus, Download, Mail, Sparkles } from 'lucide-react';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import type { Invoice } from '../types';

const mockInvoices: Invoice[] = [
  {
    id: '1',
    invoiceNumber: 'INV-2048',
    clientName: 'Rahul Sharma',
    clientCompany: 'Sharma Infotech Pvt Ltd',
    issueDate: 'Oct 7, 2026',
    dueDate: 'Oct 21, 2026',
    amount: '₹84,500',
    status: 'pending',
    autoRemind: true,
  },
  {
    id: '2',
    invoiceNumber: 'INV-2047',
    clientName: 'Ananya Iyer',
    clientCompany: 'ABC Technologies',
    issueDate: 'Oct 1, 2026',
    dueDate: 'Oct 15, 2026',
    amount: '₹1,25,000',
    status: 'paid',
    autoRemind: false,
  },
  {
    id: '3',
    invoiceNumber: 'INV-2046',
    clientName: 'Pooja Verma',
    clientCompany: 'Global Logistics Hub',
    issueDate: 'Sep 20, 2026',
    dueDate: 'Oct 4, 2026',
    amount: '₹42,000',
    status: 'overdue',
    autoRemind: true,
  },
  {
    id: '4',
    invoiceNumber: 'INV-2045',
    clientName: 'Devendra Patel',
    clientCompany: 'CoreCompute Cloud',
    issueDate: 'Sep 18, 2026',
    dueDate: 'Oct 2, 2026',
    amount: '₹3,40,000',
    status: 'paid',
    autoRemind: false,
  },
];

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices);
  const [toast, setToast] = useState<string | null>(null);

  const toggleAutoRemind = (id: string) => {
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === id ? { ...inv, autoRemind: !inv.autoRemind } : inv
      )
    );
  };

  const triggerReminder = (invoiceNumber: string) => {
    setToast(`AI Reminder dispatched for ${invoiceNumber} with payment link.`);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold text-slate-900">
              Invoices & Billing
            </h1>
            <Badge variant="purple" size="md" dot>
              Automated Reminders Active
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Generate, dispatch, track, and automatically follow up on receivables.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="purple-gradient" size="sm" icon={Plus}>
            New Invoice
          </Button>
        </div>
      </div>

      {toast && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/90 p-4 text-xs font-semibold text-indigo-900 shadow-sm flex items-center gap-2 animate-in fade-in">
          <Sparkles size={16} className="text-indigo-600" />
          <span>{toast}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Total Outstanding</span>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">₹1,26,500</h3>
          <p className="text-[11px] text-amber-600 font-medium mt-1">2 pending invoices</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Collected this Month</span>
          <h3 className="text-2xl font-bold text-emerald-600 mt-1">₹4,65,000</h3>
          <p className="text-[11px] text-emerald-700 font-medium mt-1">100% automated matching</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Overdue Recovery</span>
          <h3 className="text-2xl font-bold text-rose-600 mt-1">₹42,000</h3>
          <p className="text-[11px] text-slate-500 font-medium mt-1">1 client overdue (3 days)</p>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Invoice #</th>
                <th className="py-3.5 px-4">Client</th>
                <th className="py-3.5 px-4">Due Date</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">AI Auto-Remind</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-4 px-4 sm:px-6 font-bold text-indigo-600 font-mono">
                    {inv.invoiceNumber}
                  </td>
                  <td className="py-4 px-4">
                    <p className="font-bold text-slate-900">{inv.clientName}</p>
                    <p className="text-[11px] text-slate-500">{inv.clientCompany}</p>
                  </td>
                  <td className="py-4 px-4 text-slate-600">{inv.dueDate}</td>
                  <td className="py-4 px-4 font-bold text-slate-900">{inv.amount}</td>
                  <td className="py-4 px-4">
                    <Badge
                      variant={
                        inv.status === 'paid'
                          ? 'success'
                          : inv.status === 'pending'
                          ? 'warning'
                          : 'danger'
                      }
                      size="sm"
                      dot
                    >
                      {inv.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="py-4 px-4">
                    <button
                      onClick={() => toggleAutoRemind(inv.id)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        inv.autoRemind ? 'bg-indigo-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          inv.autoRemind ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="py-4 px-4 sm:px-6 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        title="Dispatch AI Reminder"
                        onClick={() => triggerReminder(inv.invoiceNumber)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <Mail size={15} />
                      </button>
                      <button
                        title="Download PDF"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                      >
                        <Download size={15} />
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
