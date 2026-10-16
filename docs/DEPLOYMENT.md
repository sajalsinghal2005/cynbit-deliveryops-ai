# BizOps AI — Production Deployment & Operations Guide

This guide documents the enterprise deployment architecture, operational considerations, database management, and external integration configurations for **BizOps AI**.

---

## 1. High-Level Production Architecture

```
                      ┌─────────────────────────────────────────┐
                      │          Cloudflare CDN / Vercel        │
                      │       React / Vite Production SPA       │
                      └────────────────────┬────────────────────┘
                                           │ HTTPS
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │          Reverse Proxy / Ingress        │
                      │     (AWS ALB / Nginx / Traefik / SSL)   │
                      └────────────────────┬────────────────────┘
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │          Fastify Node.js API            │
                      │  (Docker Container / ECS / K8s / VM)    │
                      │                                         │
                      │  • Session Auth + CSRF Protection       │
                      │  • RBAC Enforcement (ADMIN/APPROVER)    │
                      │  • Consequential Approval Engine        │
                      │  • Idempotent External Integrations     │
                      └────────────┬──────────────────┬─────────┘
                                   │                  │
                PostgreSQL Wire (5432)                │ HTTPS (Port 443)
                                   │                  │
                                   ▼                  ▼
              ┌───────────────────────────┐   ┌───────────────────────┐
              │    Managed PostgreSQL     │   │   Resend Transactional│
              │  (AWS RDS / Supabase /    │   │      Email Service    │
              │   Neon / Self-Hosted 16)  │   │  (Native Idempotency) │
              └───────────────────────────┘   └───────────────────────┘
```

---

## 2. Environment Variables Specification

All sensitive configuration must be injected via runtime environment variables. Secrets must never be committed to source control or container images.

| Variable | Description | Default | Security Classification | Required in Production |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | Runtime mode (`production` or `development`) | `development` | Public | Yes |
| `PORT` | HTTP port for Fastify server | `4000` | Public | Yes |
| `HOST` | Binding interface IP | `0.0.0.0` | Public | Yes |
| `DATABASE_URL` | PostgreSQL connection string | - | **CRITICAL SECRET** | Yes |
| `SESSION_SECRET` | Cryptographic secret for signing session cookies (min 32 chars) | - | **CRITICAL SECRET** | Yes |
| `FRONTEND_URL` | Canonical origin of production frontend for CORS | `http://localhost:5173` | Config | Yes |
| `ALLOWED_ORIGINS` | Comma-separated list of additional trusted CORS origins | `""` | Config | No |
| `RATE_LIMIT_MAX_PER_MINUTE` | Maximum requests allowed per IP per minute | `300` | Config | No |
| `EMAIL_PROVIDER` | Transactional email provider (`simulation` or `resend`) | `simulation` | Config | Yes |
| `RESEND_API_KEY` | Production API key for Resend integration | `""` | **CRITICAL SECRET** | If provider is `resend` |
| `EMAIL_FROM` | RFC-compliant sender header | `BizOps AI <billing@bizops.ai>` | Config | Yes |
| `EMAIL_WEBHOOK_SECRET` | Webhook signing secret for signature verification | `""` | **CRITICAL SECRET** | If webhooks enabled |
| `EMAIL_TIMEOUT_MS` | External HTTP timeout for email delivery | `5000` | Config | No |
| `LOG_LEVEL` | Pino structured logging verbosity (`info`, `debug`, `error`) | `info` | Config | No |

---

## 3. Database Operations & Production PostgreSQL

### 3.1 Connection Pooling
- **Prisma & Direct Connections**: When connecting to managed PostgreSQL (such as AWS RDS, Neon, or Supabase), configure connection pool limits in the connection URL:
  ```
  DATABASE_URL="postgresql://user:pass@db.internal:5432/bizops_ai?schema=public&connection_limit=20&pool_timeout=10"
  ```
- **PgBouncer / Transaction Poolers**: If using an external PgBouncer in transaction pooling mode, ensure prepared statements are configured properly according to Prisma docs (`pgbouncer=true`).

### 3.2 Migrations & Schema Deployments
- Never run destructive resets (`prisma db push --force-reset`) in production.
- Use Prisma migration deploy:
  ```bash
  pnpm --filter @bizops/api exec prisma migrate deploy
  ```
- Run migrations as part of a pre-deployment step or Kubernetes init-container before switching live traffic.

### 3.3 Automated Backup & Restore Strategy
1. **Automated Daily Backups**:
   ```bash
   pg_dump -Fc -v -h <DB_HOST> -U <DB_USER> -d bizops_ai > /backups/bizops_ai_$(date +\%Y\%m\%d_\%H\%M\%S).dump
   ```
2. **Point-in-Time Recovery (PITR)**: Enable Write-Ahead Log (WAL) archiving on cloud database providers (RDS / Supabase) with minimum 7-day retention.
3. **Disaster Recovery Testing**: Restore dumps periodically into an isolated staging environment to verify backup validity.

---

## 4. Email Integration & Consequential Governance

### 4.1 Safe Simulation Mode
When `EMAIL_PROVIDER="simulation"` or `RESEND_API_KEY` is omitted, the system executes in safe simulation mode:
- All approval gates, RBAC checks, and audit logging remain 100% active.
- Outbound network requests to external vendors are bypassed.
- Detailed simulated metadata is recorded in the PostgreSQL database.

### 4.2 Production Provider Configuration (Resend)
To activate real external email delivery:
1. Provision a verified sending domain on [Resend](https://resend.com).
2. Set environment variables:
   ```env
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_1234567890abcdef...
   EMAIL_FROM=BizOps Finance <billing@yourverifieddomain.com>
   EMAIL_TIMEOUT_MS=5000
   ```
3. Outbound emails are sent with strict header-based idempotency (`Idempotency-Key: bizops-apr-<approvalId>`), preventing duplicate dispatch even during network retry loops.

### 4.3 Webhook Verification
- Webhook endpoint: `POST /api/webhooks/email`
- Requires `svix-signature` or `x-webhook-signature` header verified with HMAC-SHA256 (`EMAIL_WEBHOOK_SECRET`).
- Incoming events are checked for duplicate processing against `AuditEvent` records, ensuring zero duplicate event processing.

---

## 5. Docker Deployment

### 5.1 Standalone Docker Compose
Run the entire stack locally or on a single VM:
```bash
# 1. Create production environment file
cp apps/api/.env.example apps/api/.env.production

# 2. Build and start containers in detached mode
docker compose up -d --build

# 3. View live structured logs
docker compose logs -f api
```

### 5.2 Standalone API Container
To deploy only the API container connected to an existing managed PostgreSQL instance:
```bash
docker build -t bizops-api:latest -f apps/api/Dockerfile .
docker run -d \
  --name bizops-api \
  -p 4000:4000 \
  -e DATABASE_URL="postgresql://..." \
  -e SESSION_SECRET="..." \
  -e FRONTEND_URL="https://app.bizops.ai" \
  bizops-api:latest
```

---

## 6. Health & Readiness Monitoring

The API provides standardized health and telemetry endpoints:
- `GET /health`: Liveness probe (HTTP 200 with uptime and status).
- `GET /health/ready`: Readiness probe (checks PostgreSQL connectivity).
- `GET /metrics`: In-memory runtime telemetry (active requests, latency, total requests, error codes).
