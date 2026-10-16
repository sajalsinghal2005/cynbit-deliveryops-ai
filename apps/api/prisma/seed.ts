import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Database seeding is disabled in production.");
  }

  console.log("🌱 Starting idempotent database seed...");

  // 1. Seed Customers
  const customers = [
    {
      id: "1",
      name: "Rahul Sharma",
      company: "Sharma Infotech Pvt Ltd",
      email: "rahul.s@sharmainfotech.in",
      avatar: "RS",
      totalSpend: "₹4,85,000",
      ordersCount: 18,
      status: "active" as const,
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
      status: "active" as const,
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
      status: "active" as const,
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
      status: "inactive" as const,
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
      status: "active" as const,
      aiHealthScore: 98,
      lastActive: "10 min ago",
    },
  ];

  for (const c of customers) {
    await prisma.customer.upsert({
      where: { id: c.id },
      update: {
        name: c.name,
        company: c.company,
        email: c.email,
        avatar: c.avatar,
        totalSpend: c.totalSpend,
        ordersCount: c.ordersCount,
        status: c.status,
        aiHealthScore: c.aiHealthScore,
        lastActive: c.lastActive,
      },
      create: c,
    });
  }
  console.log(`✓ Seeded ${customers.length} customers.`);

  // 2. Seed Invoices
  const invoices = [
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
      status: "pending" as const,
      autoRemind: true,
      customerId: "1",
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
      status: "paid" as const,
      paidDate: "Oct 5, 2026",
      autoRemind: false,
      customerId: "2",
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
      status: "overdue" as const,
      autoRemind: true,
      customerId: "4",
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
      status: "paid" as const,
      paidDate: "Oct 1, 2026",
      autoRemind: false,
      customerId: "5",
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
      status: "overdue" as const,
      autoRemind: true,
      customerId: "3",
    },
  ];

  for (const inv of invoices) {
    await prisma.invoice.upsert({
      where: { invoiceNumber: inv.invoiceNumber },
      update: {
        clientName: inv.clientName,
        clientCompany: inv.clientCompany,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        amount: inv.amount,
        rawAmount: inv.rawAmount,
        currency: inv.currency,
        status: inv.status,
        paidDate: inv.paidDate,
        autoRemind: inv.autoRemind,
        customerId: inv.customerId,
      },
      create: inv,
    });
  }
  console.log(`✓ Seeded ${invoices.length} invoices.`);

  // 3. Seed Approval Requests
  const approvals = [
    {
      id: "APR-1024",
      title: "Refund customer payment",
      description: "Refund a duplicate customer payment",
      actionType: "REFUND_PAYMENT" as const,
      toolName: "payment-refund",
      customer: "Rahul Sharma",
      amount: "₹25,000",
      risk: "HIGH" as const,
      arguments: { paymentId: "PAY-2048", amount: 25000, recipient: "Rahul Sharma" },
      reason: "The customer requested a refund because the same payment was processed twice.",
      status: "PENDING" as const,
      relatedCustomerId: "1",
      executionStatus: "NOT_EXECUTED" as const,
    },
    {
      id: "APR-1025",
      title: "Send invoice reminder",
      description: "Send overdue invoice reminder emails",
      actionType: "SEND_INVOICE_REMINDER" as const,
      toolName: "send-email",
      customer: "ABC Technologies",
      amount: "₹84,500",
      risk: "MEDIUM" as const,
      arguments: { template: "invoice_reminder", recipients: 3, invoiceNumber: "INV-2047" },
      reason: "Three invoices have been overdue for more than 30 days.",
      status: "PENDING" as const,
      relatedInvoiceId: "INV-2047",
      relatedCustomerId: "2",
      executionStatus: "NOT_EXECUTED" as const,
    },
    {
      id: "APR-1026",
      title: "Cancel customer order",
      description: "Cancel an active customer order",
      actionType: "CANCEL_ORDER" as const,
      toolName: "order-cancel",
      customer: "Neha Verma",
      amount: "₹12,500",
      risk: "HIGH" as const,
      arguments: { orderId: "ORD-1024", customer: "Neha Verma" },
      reason: "The customer requested cancellation through the support channel.",
      status: "PENDING" as const,
      executionStatus: "NOT_EXECUTED" as const,
    },
  ];

  for (const app of approvals) {
    await prisma.approvalRequest.upsert({
      where: { id: app.id },
      update: {
        title: app.title,
        description: app.description,
        actionType: app.actionType,
        toolName: app.toolName,
        arguments: app.arguments,
        reason: app.reason,
        customer: app.customer,
        amount: app.amount,
        risk: app.risk,
        relatedInvoiceId: app.relatedInvoiceId,
        relatedCustomerId: app.relatedCustomerId,
        status: app.status,
        executionStatus: app.executionStatus,
      },
      create: app,
    });
  }
  // 4. Seed Development Users
  console.log("🔐 Seeding development RBAC user accounts...");
  const adminPassword = process.env.DEV_ADMIN_PASSWORD || "AdminDev@123!";
  const approverPassword = process.env.DEV_APPROVER_PASSWORD || "ApproverDev@123!";
  const operatorPassword = process.env.DEV_OPERATOR_PASSWORD || "OperatorDev@123!";

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const approverHash = await bcrypt.hash(approverPassword, 10);
  const operatorHash = await bcrypt.hash(operatorPassword, 10);

  const users = [
    {
      name: "Operations Lead Admin",
      email: "admin@bizops.ai",
      passwordHash: adminHash,
      role: "ADMIN" as const,
      isActive: true,
    },
    {
      name: "Finance & Compliance Approver",
      email: "approver@bizops.ai",
      passwordHash: approverHash,
      role: "APPROVER" as const,
      isActive: true,
    },
    {
      name: "Tier-1 Business Operator",
      email: "operator@bizops.ai",
      passwordHash: operatorHash,
      role: "OPERATOR" as const,
      isActive: true,
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        passwordHash: u.passwordHash,
        role: u.role,
        isActive: u.isActive,
      },
      create: u,
    });
  }
  console.log(`✓ Seeded ${users.length} development RBAC accounts.`);

  // 5. Seed Cynbit POC Software Delivery Domain (Projects, Milestones, Blockers)
  console.log("🚀 Seeding Cynbit POC software delivery projects, milestones, and blockers...");

  const projects = [
    {
      id: "PRJ-101",
      name: "Project Falcon: Cloud Native Migration",
      description: "Enterprise containerization and migration of core billing microservices to AWS EKS.",
      status: "on_track" as const,
      healthScore: 92,
      deliveryLead: "Priya Nair",
      techStack: ["AWS EKS", "Terraform", "Node.js", "PostgreSQL", "Docker"],
      budget: "₹45,00,000",
      startDate: "Aug 15, 2026",
      targetDate: "Dec 15, 2026",
      customerId: "2", // ABC Technologies
    },
    {
      id: "PRJ-102",
      name: "Project Zephyr: Omnichannel Customer Portal",
      description: "Next-gen web & mobile portal for real-time customer onboarding and service tracking.",
      status: "at_risk" as const,
      healthScore: 68,
      deliveryLead: "Arun Varma",
      techStack: ["React", "React Native", "Fastify", "GraphQL", "Redis"],
      budget: "₹28,50,000",
      startDate: "Jul 1, 2026",
      targetDate: "Nov 30, 2026",
      customerId: "1", // Sharma Infotech Pvt Ltd
    },
    {
      id: "PRJ-103",
      name: "Project Titan: Real-time Analytics Engine",
      description: "Distributed stream processing pipeline for campaign analytics and ad performance telemetry.",
      status: "delayed" as const,
      healthScore: 54,
      deliveryLead: "Kavita Reddy",
      techStack: ["Apache Kafka", "ClickHouse", "Go", "Python", "Kubernetes"],
      budget: "₹62,00,000",
      startDate: "Jun 1, 2026",
      targetDate: "Oct 31, 2026",
      customerId: "3", // Zenith Media Global
    },
    {
      id: "PRJ-104",
      name: "Project Apex: Supply Chain Tracking SDK",
      description: "IoT event ingestion and tracking SDK for automated fleet management and freight dispatch.",
      status: "on_track" as const,
      healthScore: 96,
      deliveryLead: "Priya Nair",
      techStack: ["TypeScript", "Rust", "MQTT", "PostgreSQL", "Docker"],
      budget: "₹35,00,000",
      startDate: "Sep 1, 2026",
      targetDate: "Jan 31, 2027",
      customerId: "4", // Global Logistics Hub
    },
  ];

  for (const p of projects) {
    await prisma.project.upsert({
      where: { id: p.id },
      update: {
        name: p.name,
        description: p.description,
        status: p.status,
        healthScore: p.healthScore,
        deliveryLead: p.deliveryLead,
        techStack: p.techStack,
        budget: p.budget,
        startDate: p.startDate,
        targetDate: p.targetDate,
        customerId: p.customerId,
      },
      create: p,
    });
  }
  console.log(`✓ Seeded ${projects.length} Cynbit projects.`);

  const milestones = [
    // Falcon
    {
      id: "MS-101",
      title: "Architecture Review & Infra Baseline",
      description: "Cloud architecture sign-off and baseline Terraform scripts verified in staging.",
      dueDate: "Sep 15, 2026",
      status: "completed" as const,
      progressPercent: 100,
      projectId: "PRJ-101",
    },
    {
      id: "MS-102",
      title: "Data Migration & Schema Validation",
      description: "Dry-run database migration and cross-region replication tests.",
      dueDate: "Oct 25, 2026",
      status: "in_progress" as const,
      progressPercent: 75,
      projectId: "PRJ-101",
    },
    {
      id: "MS-103",
      title: "Production Cutover & Sign-Off",
      description: "Zero-downtime DNS cutover and client sign-off.",
      dueDate: "Dec 10, 2026",
      status: "pending" as const,
      progressPercent: 0,
      projectId: "PRJ-101",
    },
    // Zephyr
    {
      id: "MS-201",
      title: "UI/UX Design System Approval",
      description: "Figma wireframe and component library client sign-off.",
      dueDate: "Aug 10, 2026",
      status: "completed" as const,
      progressPercent: 100,
      projectId: "PRJ-102",
    },
    {
      id: "MS-202",
      title: "Core Payment & Onboarding APIs",
      description: "Integration with third-party KYC verification and payment gateway.",
      dueDate: "Oct 5, 2026",
      status: "delayed" as const,
      progressPercent: 60,
      projectId: "PRJ-102",
    },
    {
      id: "MS-203",
      title: "End-to-End User Acceptance Testing",
      description: "Beta release and UAT sign-off with Sharma Infotech stakeholders.",
      dueDate: "Nov 15, 2026",
      status: "pending" as const,
      progressPercent: 10,
      projectId: "PRJ-102",
    },
    // Titan
    {
      id: "MS-301",
      title: "Event Pipeline Architecture PoC",
      description: "Kafka benchmark testing at 50,000 events/second.",
      dueDate: "Jul 15, 2026",
      status: "completed" as const,
      progressPercent: 100,
      projectId: "PRJ-103",
    },
    {
      id: "MS-302",
      title: "Ad Impression Ingestion Pipeline",
      description: "ClickHouse real-time ingestion workers deployed to staging.",
      dueDate: "Sep 30, 2026",
      status: "delayed" as const,
      progressPercent: 50,
      projectId: "PRJ-103",
    },
    {
      id: "MS-303",
      title: "Executive Reporting Dashboard",
      description: "Real-time dashboard and alerting for campaign managers.",
      dueDate: "Oct 28, 2026",
      status: "pending" as const,
      progressPercent: 0,
      projectId: "PRJ-103",
    },
    // Apex
    {
      id: "MS-401",
      title: "Protocol Specification & Hardware Simulation",
      description: "MQTT payload spec and simulator validation.",
      dueDate: "Sep 30, 2026",
      status: "completed" as const,
      progressPercent: 100,
      projectId: "PRJ-104",
    },
    {
      id: "MS-402",
      title: "Fleet Telemetry Ingestion Service",
      description: "High-throughput telemetry ingestion microservice.",
      dueDate: "Nov 15, 2026",
      status: "in_progress" as const,
      progressPercent: 40,
      projectId: "PRJ-104",
    },
  ];

  for (const m of milestones) {
    await prisma.milestone.upsert({
      where: { id: m.id },
      update: {
        title: m.title,
        description: m.description,
        dueDate: m.dueDate,
        status: m.status,
        progressPercent: m.progressPercent,
        projectId: m.projectId,
      },
      create: m,
    });
  }
  console.log(`✓ Seeded ${milestones.length} Cynbit milestones.`);

  const blockers = [
    {
      id: "BLK-201",
      title: "Third-Party KYC Sandbox Intermittent 504 Timeouts",
      description: "Third-party vendor sandbox experiences intermittent gateway timeouts impacting onboarding test suite.",
      severity: "HIGH" as const,
      status: "open" as const,
      impact: "Delaying MS-202 sign-off by 7 business days; client escalation pending.",
      identifiedDate: "Oct 2, 2026",
      projectId: "PRJ-102",
      milestoneId: "MS-202",
    },
    {
      id: "BLK-301",
      title: "Client Network VPN Access Pending Security Review",
      description: "Zenith InfoSec security review has halted staging cluster provisioning pending firewall rule approval.",
      severity: "CRITICAL" as const,
      status: "open" as const,
      impact: "Full delivery halt on MS-302 ingestion testing; target release date compromised.",
      identifiedDate: "Sep 25, 2026",
      projectId: "PRJ-103",
      milestoneId: "MS-302",
    },
    {
      id: "BLK-302",
      title: "Kafka Staging Cluster Resource Quota Reached",
      description: "Staging Kafka cluster requires node scale-up to support stress test load.",
      severity: "MEDIUM" as const,
      status: "in_progress" as const,
      impact: "Impacting high-volume load testing; awaiting cloud team quota increase.",
      identifiedDate: "Oct 8, 2026",
      projectId: "PRJ-103",
      milestoneId: "MS-302",
    },
  ];

  for (const b of blockers) {
    await prisma.blocker.upsert({
      where: { id: b.id },
      update: {
        title: b.title,
        description: b.description,
        severity: b.severity,
        status: b.status,
        impact: b.impact,
        identifiedDate: b.identifiedDate,
        projectId: b.projectId,
        milestoneId: b.milestoneId,
      },
      create: b,
    });
  }
  console.log(`✓ Seeded ${blockers.length} Cynbit blockers.`);

  console.log("🎉 Database seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
