import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, FileText, Users, Bot, Sparkles, CheckCircle2, FolderKanban } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

export default function QuickActions() {
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [formFeedback, setFormFeedback] = useState<string | null>(null);

  // Form states for modal actions
  const [orderCustomer, setOrderCustomer] = useState('Acme Corporation');
  const [orderAmount, setOrderAmount] = useState('18,500');

  const [invoiceClient, setInvoiceClient] = useState('ABC Technologies');
  const [invoiceAmount, setInvoiceAmount] = useState('45,000');

  const handleExecute = (actionName: string) => {
    setFormFeedback(`Successfully triggered "${actionName}" via AI pipeline.`);
    setTimeout(() => {
      setFormFeedback(null);
      setActiveModal(null);
    }, 1500);
  };

  const actions = [
    {
      id: 'delivery_projects',
      title: 'Delivery Projects',
      description: 'Track health, milestones & blockers',
      icon: FolderKanban,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:border-indigo-200',
      directNav: '/projects',
    },
    {
      id: 'start_ai_task',
      title: 'Start AI Agent',
      description: 'Prompt AI agent with operations goal',
      icon: Bot,
      color: 'bg-purple-50 text-purple-600 border-purple-100 hover:border-purple-200',
      directNav: '/agent',
    },
    {
      id: 'find_customer',
      title: 'Customer Accounts',
      description: 'Search CRM directory & intelligence',
      icon: Users,
      color: 'bg-blue-50 text-blue-600 border-blue-100 hover:border-blue-200',
      directNav: '/customers',
    },
    {
      id: 'send_invoice',
      title: 'Invoices & Billing',
      description: 'Receivables & auto-reminders',
      icon: FileText,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:border-emerald-200',
      directNav: '/invoices',
    },
  ];

  return (
    <>
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-heading text-base font-bold text-slate-900">
              Quick Actions
            </h3>
            <p className="text-xs text-slate-500">
              Common tasks, faster
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-semibold">
            <Sparkles size={14} />
            <span>AI Powered Automations</span>
          </div>
        </div>

        {/* Actions Grid */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => {
                  if (action.directNav) {
                    navigate(action.directNav);
                  } else {
                    setActiveModal(action.id);
                  }
                }}
                className={`group flex items-center gap-3.5 p-3.5 rounded-2xl border bg-white text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${action.color}`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-2xs border border-current/20 transition-transform group-hover:scale-105">
                  <Icon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {action.title}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {action.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modal for Create Order */}
      <Modal
        isOpen={activeModal === 'create_order'}
        onClose={() => setActiveModal(null)}
        title="Create New Order"
        subtitle="AI will validate customer credit, inventory, and generate fulfillment tickets."
      >
        {formFeedback ? (
          <div className="py-6 text-center text-emerald-600 font-semibold flex flex-col items-center gap-2">
            <CheckCircle2 size={32} />
            <span>{formFeedback}</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Customer Name / Company</label>
              <input
                type="text"
                value={orderCustomer}
                onChange={(e) => setOrderCustomer(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Amount (₹)</label>
              <input
                type="text"
                value={orderAmount}
                onChange={(e) => setOrderAmount(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
            </div>
            <div className="pt-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setActiveModal(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={ShoppingCart}
                onClick={() => handleExecute('Create Order')}
              >
                Submit Order
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal for Send Invoice */}
      <Modal
        isOpen={activeModal === 'send_invoice'}
        onClose={() => setActiveModal(null)}
        title="Send Automated Invoice"
        subtitle="Generate PDF invoice with payment gateway link and send to client."
      >
        {formFeedback ? (
          <div className="py-6 text-center text-emerald-600 font-semibold flex flex-col items-center gap-2">
            <CheckCircle2 size={32} />
            <span>{formFeedback}</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Client / Company</label>
              <input
                type="text"
                value={invoiceClient}
                onChange={(e) => setInvoiceClient(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Invoice Amount (₹)</label>
              <input
                type="text"
                value={invoiceAmount}
                onChange={(e) => setInvoiceAmount(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
            </div>
            <div className="pt-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setActiveModal(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={FileText}
                onClick={() => handleExecute('Send Invoice')}
              >
                Generate & Send
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
