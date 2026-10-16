# Cynbit DeliveryOps AI — 5–10 Minute Live Demonstration Script
**Document ID:** CYNBIT-DEMO-GUIDE-2026-V1  
**Project:** Cynbit DeliveryOps AI  
**Context:** Technical Assessment for AI/ML Engineer Intern Position at Cynbit Technologies  
**Target Audience:** Technical Interviewers, Engineering Evaluators, Delivery Leadership  

---

## Demonstration Overview

This step-by-step demonstration guide provides an end-to-end, reproducible walkthrough of **Cynbit DeliveryOps AI**. It takes evaluators through a complete operational journey in **5 to 10 minutes**:

1. **Dashboard & Portfolio Telemetry**: Inspecting active delivery projects, health metrics, and billing indicators.
2. **Role-Based Access Control (RBAC)**: Demonstrating security boundaries between Operators, Approvers, and Administrators.
3. **Conversational Delivery Intelligence**: Querying project statuses, milestones, and active blockers in natural language.
4. **Deterministic Risk Analysis**: Demonstrating mathematical risk calculations with zero LLM hallucination.
5. **Cross-Domain Synthesis**: Unifying engineering delivery progress with commercial receivables.
6. **Consequential Action Proposal**: Requesting a client follow-up email that triggers the Human-in-the-Loop (HITL) proposal gate.
7. **Approver Review & Diff Inspection**: Logging in as an Approver to inspect parameter diffs in the Approval Queue.
8. **Authorized Action Execution**: Executing the simulated Resend email dispatch with atomic concurrency locking.
9. **Immutable Audit Verification**: Inspecting the end-to-end audit lifecycle in the compliance trail.

---

## Pre-Demo Setup & Environment Verification

Before beginning the demonstration, ensure both the Fastify backend and Vite frontend are running:

```bash
# Verify API Health (Terminal 1)
curl http://localhost:4000/health
# Expected: {"success":true,"status":"healthy","uptimeSeconds":...}

# Open Web Interface in Browser (Terminal 2)
# URL: http://localhost:5173
```

### Pre-Configured Test Credentials
| Role | Email | Password | Allowed Actions |
| :--- | :--- | :--- | :--- |
| **Operator** | `operator@bizops.ai` | `OperatorDev@123!` | Query agent, risk analysis, draft proposals |
| **Approver** | `approver@bizops.ai` | `ApproverDev@123!` | Review proposals, approve/reject consequential actions |
| **Admin** | `admin@bizops.ai` | `AdminDev@123!` | All capabilities, user management, metrics telemetry |

---

## 10-Step Demonstration Walkthrough

### Step 1: System Overview & Delivery Dashboard
- **Action**: Navigate to `http://localhost:5173/login` and log in as `operator@bizops.ai`.
- **What to Observe**:
  - The browser redirects to the **Operations Dashboard** (`/`).
  - View the Delivery Operations KPIs:
    - **Active Delivery Projects**: 4 projects (`PRJ-101`, `PRJ-102`, `PRJ-103`, `PRJ-104`).
    - **Total Milestones**: 11 tracked milestones.
    - **Active Blockers**: 3 engineering impediments.
    - **Overdue Invoices**: ₹1,07,000 across 2 receivables.
  - Notice the **Delivery Portfolio Health** breakdown showing projects in green, amber, and red health status.

---

### Step 2: Projects Portfolio Deep-Dive
- **Action**: Click on **"Projects"** in the sidebar navigation (`/projects`).
- **What to Observe**:
  - Review the 4 active delivery engagements:
    - **PRJ-101 (Cloud Migration & Microservices)**: Client Acme Corp. Health Score: **45 (High Risk)**. Active Critical Blocker: *Production AWS VPC peering pending client security sign-off*.
    - **PRJ-102 (Mobile Banking SDK)**: Client Stark Industries. Health Score: **68 (Medium Risk)**. Active High Blocker: *Biometric auth SDK iOS 18 compatibility crash*.
    - **PRJ-103 (Enterprise Data Warehouse)**: Client Wayne Enterprises. Health Score: **95 (Low Risk)**. On track.
    - **PRJ-104 (AI Customer Support Agent)**: Client Cyberdyne Systems. Health Score: **88 (Low Risk)**. On track.
  - Highlight to evaluators how the UI displays the milestone timeline and open blocker cards directly alongside project health scores.

---

### Step 3: Natural Language Delivery Portfolio Query
- **Action**: Navigate to the **"AI Agent"** tab (`/agent`). Type the following prompt into the chat box:
  ```text
  Show all active delivery projects
  ```
- **What to Observe**:
  - The AI Orchestrator classifies the intent and dispatches tool `project-search`.
  - The response returns a structured markdown dossier of all 4 active projects with codes, health scores, and client affiliations.
  - Point out the **Provenance Badge**: `Tool Used: project-search | Type: READ_ONLY | Grounding: PostgreSQL Database`.
  - Emphasize that this was resolved autonomously without human intervention because read-only queries pose zero risk.

---

### Step 4: Deterministic Project Risk Analysis
- **Action**: In the AI Agent chat, type:
  ```text
  Which projects are currently at risk?
  ```
- **What to Observe**:
  - The orchestrator invokes `project-risk-analysis` for portfolio-wide risk evaluation.
  - The response highlights **PRJ-101** as highest risk (Health Score: 45) and **PRJ-102** as moderate risk (Health Score: 68).
  - Evaluator Talking Point: *"Notice the risk score 45 is not an LLM hallucination. It is calculated deterministically via our multi-factor scoring engine: 100 base score minus 25 points for the CRITICAL VPC peering blocker minus 15 points for the delayed milestone, minus 15 points for the impending deadline."*

---

### Step 5: Critical Blocker Deep-Dive
- **Action**: In the AI Agent chat, type:
  ```text
  What blockers exist for PRJ-101?
  ```
- **What to Observe**:
  - The orchestrator invokes `project-blockers` with arguments `{ projectId: "PRJ-101" }`.
  - The response displays:
    - **Blocker Title**: *Production AWS VPC peering pending client security sign-off*.
    - **Severity**: `CRITICAL`.
    - **Status**: `OPEN`.
    - **Owner**: DevOps Lead.
    - **Impact**: Halts Milestone M3 (Production Staging Deployment).

---

### Step 6: Cross-Domain Customer Delivery & Commercial Summary
- **Action**: In the AI Agent chat, type:
  ```text
  Customer delivery summary for Ananya Iyer
  ```
- **What to Observe**:
  - The orchestrator invokes `client-delivery-summary`.
  - The agent cross-references data across **both engineering and accounting**:
    - **Client**: Ananya Iyer (Acme Corp).
    - **Delivery Engagement**: PRJ-101 (Cloud Migration).
    - **Milestones**: 3 milestones (1 completed, 1 in progress, 1 delayed).
    - **Blockers**: 1 critical blocker.
    - **Commercial Invoices**: Outstanding invoice INV-1001 for ₹65,000 (Overdue by 16 days).
  - Evaluator Talking Point: *"This demonstrates the core thesis of DeliveryOps AI: an operator gets instant 360-degree synthesis of delivery impediments and unpaid commercial receivables in a single query."*

---

### Step 7: Automated Consequential Proposal Generation
- **Action**: In the AI Agent chat, type:
  ```text
  Prepare a client follow-up for Ananya Iyer regarding project blockers and invoice INV-1001
  ```
- **What to Observe**:
  - The orchestrator recognizes **consequential intent** and selects `prepare-client-followup`.
  - **Crucial Invariant Check**: The email is **NOT sent**. Instead, the agent responds with:
    > **Proposal Created for Human Authorization**  
    > **Proposal ID**: `APR-10xx`  
    > **Status**: `PENDING`  
    > **Action**: `prepare-client-followup`  
    > *This consequential action requires review and sign-off by an authorized Approver in the Approvals queue before execution.*
  - The UI displays an amber alert with a direct link to the **Approvals** screen.

---

### Step 8: RBAC Verification & Approvals Queue Inspection
- **Action**:
  1. Click **"Approvals"** in the sidebar. Note that as an `OPERATOR`, the **Approve** and **Reject** buttons are disabled with an explicit badge: *"Requires APPROVER or ADMIN role to execute"*.
  2. Click **"Logout"** in the top right.
  3. Log back in as `approver@bizops.ai` (Password: `ApproverDev@123!`).
  4. Navigate to **"Approvals"** (`/approvals`).
- **What to Observe**:
  - The newly created proposal `APR-10xx` appears at the top of the queue.
  - Review the proposed details:
    - **Recipient**: `ananya.iyer@acmecorp.com`
    - **Subject**: *Project PRJ-101 Update & Milestone M3 Next Steps*
    - **Body Diff**: Review the professional draft addressing the VPC peering blocker and referencing invoice INV-1001.
    - **Proposed By**: `operator@bizops.ai`.
  - The **"Approve & Execute"** and **"Reject"** buttons are now fully enabled for the Approver.

---

### Step 9: Authorized Execution & Safe Email Simulation
- **Action**:
  1. Click the green **"Approve & Execute"** button on the proposal card.
  2. Confirm the action in the confirmation modal.
- **What to Observe**:
  - The button shows a brief loading spinner as the Fastify backend:
    - Acquires an atomic lock on the proposal record in PostgreSQL.
    - Transitions `status` from `PENDING` to `APPROVED`.
    - Dispatches the email via the Resend Email Adapter in safe simulation mode.
    - Updates `executionStatus` to `EXECUTED`.
    - Emits an immutable `AuditEvent`.
  - The proposal card badge updates to green **"APPROVED - EXECUTED"**.
  - A toast notification confirms: *"Proposal APR-10xx approved and executed successfully."*

---

### Step 10: Immutable Audit Trail & Provenance Verification
- **Action**:
  1. Click on **"Audit Log"** in the sidebar navigation (`/audit`).
- **What to Observe**:
  - View the newly appended audit records:
    - **Event 1**: `CREATE_PROPOSAL` — Actor: `operator@bizops.ai` | Action: `prepare-client-followup` | Entity: `ApprovalRequest:APR-10xx`.
    - **Event 2**: `APPROVE_PROPOSAL` — Actor: `approver@bizops.ai` | Status: `APPROVED`.
    - **Event 3**: `EXECUTE_ACTION` — Dispatch Status: `SUCCESS (SIMULATED)` | Provider: `resend-sim`.
  - Inspect the JSON metadata showing the exact timestamp, actor IP, and cryptographic session correlation ID (`x-request-id`).
  - Evaluator Talking Point: *"This satisfies enterprise compliance requirements: complete provenance from operator prompt to approver decision to executed action."*

---

## Conclusion & Demo Wrap-Up

In this 10-minute demonstration, you have verified:
1. **Unified Observability**: Complete visibility across delivery projects and financial health.
2. **Deterministic Risk Precision**: Mathematical risk scoring without hallucination.
3. **Cross-Domain AI Synthesis**: Seamless integration of engineering and accounting data.
4. **Architectural HITL Safety**: Consequential actions are strictly contained until authorized.
5. **Separation of Duties (RBAC)**: Operators propose, Approvers decide, Admins govern.
6. **Immutable Accountability**: Full audit trail tracking every operational decision.
