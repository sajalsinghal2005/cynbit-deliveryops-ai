# Cynbit DeliveryOps AI — AI-Powered Delivery Operations & Business Decision Automation Agent
*Built upon the BizOps AI Enterprise Platform*

[![CI](https://github.com/sajalsinghal2000/cynbit-deliveryops-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/sajalsinghal2000/cynbit-deliveryops-ai/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.0-black.svg)](https://fastify.dev/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-5.21-2D3748.svg)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Evaluation](https://img.shields.io/badge/Eval%20Benchmark-40%2F40%20(100%25)-brightgreen.svg)](docs/EVALUATION.md)

---

## Executive Summary

**Cynbit DeliveryOps AI** is an enterprise AI-powered delivery operations and business decision automation agent developed for the **Cynbit Technologies AI/ML Engineer Intern Technical Assessment**.

The platform unifies delivery project telemetry (milestones, delivery timelines, blocker tickets, engineering risk) with commercial business data (customer accounts, billed invoices, aging receivables) into an intelligent conversational agent backed by a deterministic risk calculation engine, strict schema validation, role-based access control, and mandatory **Human-in-the-Loop (HITL)** governance for consequential actions.

> [!IMPORTANT]
> **Cynbit Opportunity Hypothesis Disclaimer:**
> *This solution is based on an external hypothesis of potential business needs derived from publicly visible technology consulting services, digital transformation offerings, and delivery models at Cynbit Technologies, rather than internal proprietary operations.*

---

## The Business Problem Hypothesis

Modern technology service companies like **Cynbit Technologies** deliver concurrent software engineering, digital transformation, and cloud solutions across diverse enterprise clients. In such high-velocity environments, operational and delivery leadership encounter significant friction:

1. **Fragmented Delivery & Commercial Observability**: Engineering milestones and blockers live in issue trackers (e.g., Jira, GitHub), while billing and invoice telemetry live in accounting systems (e.g., ERPs, QuickBooks). Delivery managers lack instant commercial context, and account managers lack real-time visibility into technical delivery impediments.
2. **Delayed Blocker Escalation & Risk Blindspots**: Blockers with cross-team dependencies (e.g., API gateway provisioning, third-party authentication credentials) often sit unresolved until milestone review meetings, risking contractual SLAs.
3. **Manual, Error-Prone Client Follow-ups**: Account managers spend hours manually drafting client emails reconciling milestone progress with overdue invoices. High cognitive load leads to factual inaccuracies or misaligned commitments.
4. **Autonomous AI Risks (Hallucination & Governance)**: Generic autonomous LLMs hallucinate delivery health metrics, promise unrealistic timelines, or dispatch unvetted emails to clients without executive sign-off, introducing catastrophic reputational and contractual liabilities.

---

## Why AI + Human-in-the-Loop (HITL) Governance?

### Why AI?
- **Natural Language Orchestration**: Cross-domain querying across customers, projects, milestones, blockers, and invoices through natural language without requiring delivery leads to write SQL or hop across multiple dashboards.
- **Context Synthesis**: Synthesizes engineering delivery telemetry alongside financial health to generate comprehensive client summaries and structured follow-up email drafts with explicit provenance.

### Why Mandatory HITL Governance?
- **Zero Autonomous Consequential Actions**: Consequential operations—such as dispatching client follow-up emails (`prepare-client-followup`) or payment reminders (`send-email`)—are **strictly blocked** from direct autonomous execution.
- **Deterministic Proposal Pipeline**: When the agent recognizes consequential intent, it creates a structured `ApprovalRequest` record in PostgreSQL (`status: PENDING`, `executionStatus: NOT_EXECUTED`).
- **Separation of Duties & RBAC**: Only authorized humans (`ADMIN` or `APPROVER` roles) can review, modify, approve, or reject proposals. Operators cannot self-approve.
- **Deterministic Risk Engine**: Critical delivery risk scores and overdue calculations are computed deterministically via code and database aggregates—eliminating LLM hallucination in risk metrics.
- **Auditable Provenance**: Every query, tool execution, proposal review, and action execution is permanently tracked in an immutable `AuditEvent` log.

---

## System Architecture

```mermaid
flowchart TD
    User([User / Operator / Approver]) -->|HTTPS / REST| WebApp[React 18 SPA / Vite]
    WebApp -->|Cookie Auth + CSRF Token| Gateway[Fastify 5 REST API Gateway]
    
    subgraph Security Layer
        Gateway --> AuthGuard[Session Auth Guard / SHA-256]
        Gateway --> CSRFGuard[Double-Submit CSRF Guard]
        Gateway --> RBACGuard[RBAC: ADMIN | OPERATOR | APPROVER]
    end

    RBACGuard --> Orchestrator[AI Orchestrator Engine]

    subgraph AI Orchestration Layer
        Orchestrator --> DualLLM{Dual Provider Router}
        DualLLM -->|Primary| Gemini[Google Gemini 2.5 Flash]
        DualLLM -->|Fallback / Air-Gapped| Deterministic[Deterministic Rule & Regex Engine]
        DualLLM --> SchemaValidator[Zod Output Schema Validation]
    end

    SchemaValidator --> ToolRouter{Tool Execution Router}

    subgraph Tool Registry [21 Hardened Tools]
        ToolRouter -->|19 Read-Only Tools| ReadOnlyExec[Execute & Ground in PostgreSQL]
        ToolRouter -->|2 Consequential Tools| ApprovalGate[HITL Approval Gate]
    end

    subgraph PostgreSQL Database
        ReadOnlyExec --> Prisma[Prisma ORM]
        ApprovalGate -->|Insert Proposal status=PENDING| Prisma
        Prisma --> DB[(PostgreSQL 16 Engine)]
    end

    subgraph Consequential Execution Pipeline
        ApprovalGate -.->|Awaiting Human Review| ApprovalQueue[Approval Dashboard]
        User -->|Approver Decision: POST /approve| ExecEngine[Action Execution Service]
        ExecEngine -->|Simulated Resend API| EmailService[Email Adapter / Simulation]
        ExecEngine -->|Persist Audit Record| Prisma
    end

    ReadOnlyExec --> ReturnEnvelope[Sanitized Response Envelope]
    ApprovalGate --> ReturnEnvelope
    ReturnEnvelope --> WebApp
```

---

## Tool Registry (21 Tools)

The platform enforces a strict allowlist registry containing exactly **21 registered business tools** (19 Read-Only, 2 Consequential). Unregistered tool execution attempts are rejected at the gateway.

### Delivery Operations Tools (Phase 3 & Phase 4)
| Tool Identifier | Type | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `project-search` | `READ_ONLY` | All Authenticated | Search delivery projects by keyword, status, or client name |
| `project-summary` | `READ_ONLY` | All Authenticated | Detailed project dossier with milestones, blockers, and client metadata |
| `project-risk-analysis` | `READ_ONLY` | All Authenticated | Deterministic multi-factor risk scoring (0–100 scale, factors, health rating) |
| `project-milestones` | `READ_ONLY` | All Authenticated | Milestone progress, target delivery dates, completion status |
| `project-blockers` | `READ_ONLY` | All Authenticated | Active delivery impediments, severity breakdown, ownership |
| `client-delivery-summary`| `READ_ONLY` | All Authenticated | Holistic delivery dossier combining projects, blockers, and commercial invoices |
| `prepare-client-followup`| `CONSEQUENTIAL`| Propose: OPERATOR, ADMIN<br>Approve: APPROVER, ADMIN | Drafts client follow-up email incorporating delivery & milestone status into approval queue |

### Financial & Business Intelligence Tools
| Tool Identifier | Type | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `customer-search` | `READ_ONLY` | All Authenticated | Fuzzy search customer database |
| `customer-summary` | `READ_ONLY` | All Authenticated | Customer profile, total invoices, contact info |
| `customer-invoice-history`| `READ_ONLY` | All Authenticated | Historical billing records for a specific client |
| `customer-outstanding-balance`| `READ_ONLY` | All Authenticated | Real-time outstanding debt balance for a customer |
| `invoice-search` | `READ_ONLY` | All Authenticated | Locate invoice by invoice number |
| `invoice-summary` | `READ_ONLY` | All Authenticated | Single invoice breakdown with line items and status |
| `overdue-invoices` | `READ_ONLY` | All Authenticated | List all overdue receivables across company portfolio |
| `outstanding-invoices` | `READ_ONLY` | All Authenticated | All unpaid invoices regardless of due date |
| `invoice-status-summary` | `READ_ONLY` | All Authenticated | Portfolio collection rate and status distribution |
| `bi-outstanding-total` | `READ_ONLY` | All Authenticated | Aggregate sum of all unpaid accounts receivable |
| `bi-overdue-total` | `READ_ONLY` | All Authenticated | Aggregate sum of all overdue invoices |
| `bi-invoice-status-counts` | `READ_ONLY` | All Authenticated | Count distribution of invoices across statuses |
| `bi-customer-outstanding-aggregation` | `READ_ONLY` | All Authenticated | Grouped customer debt aggregation |
| `bi-top-outstanding-customers` | `READ_ONLY` | All Authenticated | Ranked list of top debtors by balance |
| `send-email` | `CONSEQUENTIAL`| Propose: OPERATOR, ADMIN<br>Approve: APPROVER, ADMIN | Creates approval proposal for client invoice reminder email |

---

## Human-in-the-Loop (HITL) State Machine

Consequential operations (`prepare-client-followup`, `send-email`) strictly follow this auditable lifecycle state machine:

```
[Agent Recognition]
        ↓
[Create ApprovalRequest] ──> status: PENDING | executionStatus: NOT_EXECUTED
        ↓
┌───────┴───────┐
▼               ▼
[APPROVE]     [REJECT]
│               │
▼               ▼
status: APPROVED                status: REJECTED
executionStatus: EXECUTED       executionStatus: NOT_EXECUTED
(Simulated Resend API)          (No External Call)
│               │
└───────┬───────┘
        ▼
[AuditEvent Persisted to PostgreSQL]
```

- **Idempotency**: Duplicate calls with identical parameters reuse existing pending proposals.
- **Race Condition Immunity**: Database-level atomic updates prevent double approvals or conflicting concurrent decisions.
- **Full Traceability**: All transitions capture `actorId`, `actorRole`, `timestamp`, `justification`, and `clientIp`.

---

## Evaluation Benchmark & Quality Validation

The platform includes an automated evaluation benchmark suite (`apps/api/evaluation/run_eval.ts`) rigorously assessing **40 comprehensive test cases** across Categories A through P:

```
========================================================================================
                      CYNBIT DELIVERYOPS AI - EVALUATION REPORT                         
========================================================================================
Total Test Cases:                40
Passed:                          40 (100.0%)
Failed:                          0 (0.0%)

ACCURACY BENCHMARKS:
- Intent Recognition Accuracy:   100.0% (40/40)
- Tool Selection Accuracy:       100.0% (40/40)
- Structured Output Validity:    100.0% (40/40)
- Factual & Risk Grounding:      100.0% (40/40)

PERFORMANCE METRICS:
- Average Execution Latency:     1,243 ms
- P95 Execution Latency:         1,890 ms

CRITICAL GOVERNANCE & SAFETY INVARIANTS:
- Unauthorized Consequential Executions: 0 (PASSED)
- Prompt Injection Bypasses:             0 (PASSED)
- Unregistered Tool Executions:          0 (PASSED)
- Secret / Credential Leaks:             0 (PASSED)
- Risk Hallucinations Detected:          0 (PASSED)
- Database Immutability Verified:        100% Data Preserved (PASSED)
========================================================================================
```

For complete methodology, rubric, and individual test cases, see [docs/EVALUATION.md](docs/EVALUATION.md).

---

## Technology Stack

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **API Framework** | [Fastify 5](https://fastify.dev/) | High-throughput (3x faster than Express), built-in schema validation, enterprise plugin architecture |
| **Language** | [TypeScript 5.6](https://www.typescriptlang.org/) | End-to-end type safety, strict null checking, robust interfaces |
| **Database & ORM** | [PostgreSQL 16](https://www.postgresql.org/) + [Prisma 5.21](https://www.prisma.io/) | ACID guarantees, declarative migrations, strongly-typed query builder |
| **Frontend SPA** | [React 18](https://react.dev/) + [Vite](https://vitejs.dev/) | Modern reactive architecture, blazing fast HMR, modular component hierarchy |
| **CSS & Design** | Vanilla Modern CSS + Glassmorphism | Custom responsive design system, zero bloated CSS utility dependencies, dark mode |
| **Validation** | [Zod 3.23](https://zod.dev/) | Runtime input/output contracts, safe sanitization, tool schema enforcement |
| **Primary LLM** | [Google Gemini 2.5 Flash](https://deepmind.google/technologies/gemini/) | State-of-the-art speed, low latency, structured JSON schema output |
| **Fallback Engine** | Deterministic Regex & Rule Provider | Zero API cost, zero downtime fallback, predictable air-gapped testability |
| **Email Gateway** | Resend Adapter (with safe simulation mode) | Industry standard transactional email dispatch with simulated execution fallback |

---

## Getting Started / Local Setup

### Prerequisites
- **Node.js**: `v20.x` or `v22.x`
- **pnpm**: `v9.x`
- **PostgreSQL**: `v16.x` (or Docker Desktop)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/sajalsinghal2000/cynbit-deliveryops-ai.git
cd cynbit-deliveryops-ai
pnpm install
```

### 2. Environment Configuration
Create `.env` inside `apps/api/`:
```env
PORT=4000
NODE_ENV=development
DATABASE_URL="postgresql://bizops_user:bizops_secret_password@localhost:5432/bizops_db?schema=public"
SESSION_SECRET="dev-session-cookie-secret-min-32-chars-change-for-production"
CORS_ORIGIN="http://localhost:5173"
RATE_LIMIT_MAX_PER_MINUTE=100

# LLM Configuration
LLM_PROVIDER="deterministic" # or "gemini"
LLM_MODEL="gemini-2.5-flash"
GEMINI_API_KEY=""             # Add key if testing live Gemini API

# Email Adapter
EMAIL_PROVIDER="simulation"  # or "resend"
RESEND_API_KEY=""
EMAIL_FROM="delivery@cynbit.com"

# Dev User Credentials
DEV_ADMIN_PASSWORD="AdminDev@123!"
DEV_APPROVER_PASSWORD="ApproverDev@123!"
DEV_OPERATOR_PASSWORD="OperatorDev@123!"
```

### 3. Database Migration & Seeding
```bash
# Start PostgreSQL via Docker if not running locally:
docker-compose up -d postgres

# Push schema and seed baseline delivery and business records:
cd apps/api
npx prisma db push
npx prisma db seed
```

### 4. Running the Development Servers
In two separate terminals:
```bash
# Terminal 1: Fastify API Server
cd apps/api
npm run dev

# Terminal 2: React Vite SPA
cd apps/web
npm run dev
```
- Web Application: [http://localhost:5173](http://localhost:5173)
- API Gateway & Health: [http://localhost:4000/health](http://localhost:4000/health)

### 5. Running the Test & Benchmark Suites
```bash
cd apps/api

# Run AI Evaluation Benchmark (40 Test Cases)
npm run evaluate

# Run Phase-Specific Verification Suites
npx tsx test_phase3_deliveryops_tools.ts
npx tsx test_phase4_deliveryops_orchestration.ts
npx tsx test_phase5_client_followup.ts
npx tsx test_phase7_capabilities.ts
npx tsx test_phase8_readiness.ts
```

---

## Default User Accounts (Development / Demo)

| Email | Role | Password | Capabilities |
| :--- | :--- | :--- | :--- |
| `admin@bizops.ai` | `ADMIN` | `AdminDev@123!` | Full system administration, user management, telemetry metrics, agent queries, approvals |
| `operator@bizops.ai` | `OPERATOR` | `OperatorDev@123!` | Delivery operations queries, project risk analysis, consequential proposal drafting |
| `approver@bizops.ai` | `APPROVER` | `ApproverDev@123!` | Human-in-the-Loop proposal review, diff inspection, action authorization / rejection |

---

## Documentation Index

- [AI Opportunity Report (Cynbit Business Analysis)](docs/AI_OPPORTUNITY_REPORT.md)
- [Technical Approach & Architecture Design](docs/TECHNICAL_APPROACH.md)
- [Evaluation & Quality Validation Benchmark](docs/EVALUATION.md)
- [5–10 Minute Demo Script & Walkthrough](docs/DEMO.md)
- [Production API Reference](docs/API_REFERENCE.md)
- [LLM Integration & AI Orchestration Guide](docs/AI_ORCHESTRATION.md)
- [Production Deployment Guide](docs/DEPLOYMENT.md)

---

## Assessment Attribution

This project is submitted by **Sajal Singhal** ([sajalsinghal2000](https://github.com/sajalsinghal2000) / `b241226@skit.ac.in`) for the **Cynbit Technologies AI/ML Engineer Intern** technical assessment.
All components, tests, evaluation benchmarks, and architectural designs have been implemented and verified according to enterprise engineering standards.
