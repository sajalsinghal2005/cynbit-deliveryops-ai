# BizOps AI — Production API Reference & Architecture Guide

## 1. Overview & Security Architecture
BizOps AI is a hardened, production-oriented API built on Fastify 5 and PostgreSQL with Prisma ORM.

### Security Invariants & Defense-in-Depth
- **Authentication**: Database-backed sessions. Random 256-bit session tokens hashed via SHA-256 and verified per request. Transported via `bizops_session` HTTP-only cookie or `Authorization: Bearer <token>`.
- **RBAC**: Server-side role verification (`ADMIN`, `OPERATOR`, `APPROVER`). Frontend route guards are purely advisory.
- **CSRF Protection**: Double-submit CSRF cookie protection (`bizops_csrf` cookie + `X-CSRF-Token` header) enforced on all state-mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`).
- **Request Correlation**: Traceable `X-Request-ID` generated or safely propagated across all requests, logs, tool executions, and error responses.
- **Security Headers**: Standard production headers injected via Fastify hooks:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-XSS-Protection: 0`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

## 2. Standard Response & Error Envelope

### Standard Success Envelope
```json
{
  "success": true,
  "data": { ... }
}
```

### Standard Sanitized Error Envelope
```json
{
  "success": false,
  "code": "VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | RATE_LIMITED | INTERNAL_SERVER_ERROR",
  "message": "Human-readable sanitized error description.",
  "requestId": "req-9c8e1f0a-4b2a-4422-92bb-18a09f3e4c01"
}
```
*Note: Stack traces, internal Prisma ORM errors, raw SQL queries, and file paths are strictly redacted from client responses.*

---

## 3. Core Endpoints Reference

### 3.1 Health & Operational Probes
| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Public | **Liveness Probe**: Confirms the Fastify process is running. |
| `GET` | `/ready` | Public | **Readiness Probe**: Verifies PostgreSQL connectivity via ping query. Returns 503 if DB is unreachable. |
| `GET` | `/api/metrics` | `ADMIN` only | **Observability Telemetry**: In-memory telemetry covering request latencies, status codes, error distributions, tool executions, and approval decisions. |

### 3.2 Authentication & Session Management
| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public (Rate Limited) | Authenticate via email & password (`bcrypt`). Sets `bizops_session` & `bizops_csrf` cookies. |
| `POST` | `/api/auth/logout` | Authenticated + CSRF | Revokes current session token in PostgreSQL and clears cookies. |
| `GET` | `/api/auth/me` | Authenticated | Returns current authenticated user profile (`SafeUserProfile`). |

### 3.3 AI Operations Agent
| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/agent` | `ADMIN`, `OPERATOR` + CSRF | Evaluates user business intent against the 21-tool Tool Registry. Read-only tools resolve autonomously; consequential tools return `APPROVAL_REQUIRED` and queue an `ApprovalRequest`. |

### 3.4 Delivery Operations & Projects
| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/projects` | Authenticated | List all delivery projects with client metadata, health scores, milestones summary, and active blockers. |
| `GET` | `/api/projects/:id` | Authenticated | Retrieve single delivery project details, complete milestone timeline, and detailed blocker tickets. |

### 3.5 Governance & Human-in-the-Loop Approvals
| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/approvals` | `ADMIN`, `OPERATOR`, `APPROVER` | List approval requests with filtering by `status`, `risk`, and search term. |
| `GET` | `/api/approvals/:id` | `ADMIN`, `OPERATOR`, `APPROVER` | Retrieve single approval request details. |
| `POST` | `/api/approvals/:id/approve` | `ADMIN`, `APPROVER` + CSRF | Atomically approve proposal and execute simulated action. Idempotent under retries and concurrent clicks. |
| `POST` | `/api/approvals/:id/reject` | `ADMIN`, `APPROVER` + CSRF | Atomically reject proposal. Prevents execution. |

### 3.6 Tool Registry Introspection
| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/tools` | Authenticated | List all 21 registered business tools (19 read-only, 2 consequential), schemas, risk ratings, and operational classifications. |

### 3.7 Audit Trail & Compliance
| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/audit-events` | `ADMIN`, `APPROVER` | Paginated immutable audit trail with actor attribution and metadata inspection. |

### 3.8 User & Administrative Governance
| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/users` | `ADMIN` only | List system users. |
| `POST` | `/api/admin/users` | `ADMIN` only + CSRF | Create new user account. |
| `PATCH` | `/api/admin/users/:id` | `ADMIN` only + CSRF | Update user role / details with last-active-admin protection. |
| `PATCH` | `/api/admin/users/:id/status`| `ADMIN` only + CSRF | Activate or deactivate user account with session revocation. |
| `POST` | `/api/admin/users/:id/reset-password` | `ADMIN` only + CSRF | Administrative password reset with forced session invalidation. |
