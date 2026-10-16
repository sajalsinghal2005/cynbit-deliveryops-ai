export interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  avatar: string;
  totalSpend: string;
  ordersCount: number;
  status: "active" | "inactive" | "lead";
  aiHealthScore: number;
  lastActive: string;
}

export const mockCustomers: Customer[] = [
  {
    id: "1",
    name: "Rahul Sharma",
    company: "Sharma Infotech Pvt Ltd",
    email: "rahul.s@sharmainfotech.in",
    avatar: "RS",
    totalSpend: "₹4,85,000",
    ordersCount: 18,
    status: "active",
    aiHealthScore: 94,
    lastActive: "2 min ago",
  },
  {
    id: "2",
    name: "Ananya Iyer",
    company: "ABC Technologies",
    email: "ananya@abctech.io",
    avatar: "AI",
    totalSpend: "₹12,40,000",
    ordersCount: 42,
    status: "active",
    aiHealthScore: 88,
    lastActive: "5 min ago",
  },
  {
    id: "3",
    name: "Vikram Mehta",
    company: "Zenith Media Global",
    email: "vikram@zenithmedia.com",
    avatar: "VM",
    totalSpend: "₹8,90,000",
    ordersCount: 26,
    status: "active",
    aiHealthScore: 96,
    lastActive: "2 hours ago",
  },
  {
    id: "4",
    name: "Pooja Verma",
    company: "Global Logistics Hub",
    email: "pooja.v@globallogistics.co",
    avatar: "PV",
    totalSpend: "₹3,15,000",
    ordersCount: 9,
    status: "inactive",
    aiHealthScore: 62,
    lastActive: "4 days ago",
  },
  {
    id: "5",
    name: "Devendra Patel",
    company: "CoreCompute Cloud",
    email: "dev@corecompute.net",
    avatar: "DP",
    totalSpend: "₹18,50,000",
    ordersCount: 64,
    status: "active",
    aiHealthScore: 98,
    lastActive: "10 min ago",
  },
];
