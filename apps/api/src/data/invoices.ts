export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientCompany: string;
  issueDate: string;
  dueDate: string;
  amount: string;
  rawAmount: number;
  currency: string;
  status: "paid" | "pending" | "overdue";
  paidDate?: string;
  autoRemind: boolean;
}

/**
 * Deterministic demo reference date: October 9, 2026.
 * Status is validated against due dates and paidDate:
 * - Paid if paidDate is present -> "paid"
 * - Pending if unpaid and dueDate >= demo date -> "pending"
 * - Overdue if unpaid and dueDate < demo date -> "overdue"
 */
export const mockInvoices: Invoice[] = [
  {
    id: "1",
    invoiceNumber: "INV-2048",
    clientName: "Rahul Sharma",
    clientCompany: "Sharma Infotech Pvt Ltd",
    issueDate: "Oct 7, 2026",
    dueDate: "Oct 21, 2026",
    amount: "₹84,500",
    rawAmount: 84500,
    currency: "INR",
    status: "pending",
    autoRemind: true,
  },
  {
    id: "2",
    invoiceNumber: "INV-2047",
    clientName: "Ananya Iyer",
    clientCompany: "ABC Technologies",
    issueDate: "Oct 1, 2026",
    dueDate: "Oct 15, 2026",
    amount: "₹1,25,000",
    rawAmount: 125000,
    currency: "INR",
    status: "paid",
    paidDate: "Oct 5, 2026",
    autoRemind: false,
  },
  {
    id: "3",
    invoiceNumber: "INV-2046",
    clientName: "Pooja Verma",
    clientCompany: "Global Logistics Hub",
    issueDate: "Sep 20, 2026",
    dueDate: "Oct 4, 2026",
    amount: "₹42,000",
    rawAmount: 42000,
    currency: "INR",
    status: "overdue",
    autoRemind: true,
  },
  {
    id: "4",
    invoiceNumber: "INV-2045",
    clientName: "Devendra Patel",
    clientCompany: "CoreCompute Cloud",
    issueDate: "Sep 18, 2026",
    dueDate: "Oct 2, 2026",
    amount: "₹3,40,000",
    rawAmount: 340000,
    currency: "INR",
    status: "paid",
    paidDate: "Oct 1, 2026",
    autoRemind: false,
  },
  {
    id: "5",
    invoiceNumber: "INV-1001",
    clientName: "Vikram Mehta",
    clientCompany: "Zenith Media Global",
    issueDate: "Sep 15, 2026",
    dueDate: "Sep 29, 2026",
    amount: "₹65,000",
    rawAmount: 65000,
    currency: "INR",
    status: "overdue",
    autoRemind: true,
  },
];
