# BizOps AI — LLM Integration & AI Orchestration Guide

This guide documents the enterprise AI orchestration architecture, LLM provider abstraction, prompt injection defenses, tool governance, and consequential approval boundaries implemented in **Phase 10** of BizOps AI.

---

## 1. High-Level AI Orchestration Architecture

```
User (Natural Language Business Request)
  ↓
React Frontend (Vite SPA)
  ↓
Fastify API (/api/agent)
  ↓
Security Gates (Session Auth + RBAC: [ADMIN, OPERATOR] + CSRF)
  ↓
AI Orchestrator (Server-Side Context & Bounded Iterations)
  ↓
┌────────────────────────────────────────────────────────┐
│               LLM Provider Abstraction                 │
│                                                        │
│  • OpenAI (gpt-4o, gpt-4o-mini)                        │
│  • Anthropic (claude-3-5-sonnet, claude-3-haiku)       │
│  • Gemini (gemini-1.5-pro, gemini-1.5-flash)           │
│  • Deterministic Rule Engine (Zero-Cost Safe Fallback) │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
          Structured Model Decision (Zod Validated)
          { type, toolName?, arguments?, reasoningSummary?, response? }
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
[type: "final_answer"]              [type: "tool_call"]
       │                                       │
Return text to user                            ▼
                              Tool Registry Allowlist Validation
                              (Only registered tools; Zod parameter parsing)
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       ▼                                               ▼
             [READ_ONLY Operation]                         [CONSEQUENTIAL Operation]
                       │                                               │
             Execute tool via Registry                     NEVER EXECUTE DIRECTLY
                       │                                               │
             Return structured result                                  ▼
                                                           ApprovalRequest Created
                                                           (status: PENDING, executionStatus: NOT_EXECUTED)
                                                                       │
                                                           Human Authorization
                                                           (ADMIN or APPROVER only)
                                                                       │
                                                           Atomic Concurrency Lock
                                                                       │
                                                           External Action / Email Dispatch
                                                           (Resend Idempotency-Key)
                                                                       │
                                                           AuditEvent Persisted
```

---

## 2. LLM Provider Configuration & Environment Variables

All LLM credentials are strictly runtime environment variables and are never logged or exposed to the client.

| Variable | Description | Security Level | Default / Example |
| :--- | :--- | :--- | :--- |
| `LLM_PROVIDER` | Active provider: `deterministic`, `openai`, `anthropic`, `gemini` | Config | `deterministic` |
| `LLM_MODEL` | Target foundation model name | Config | `gpt-4o-mini` |
| `OPENAI_API_KEY` | OpenAI secret token | **CRITICAL SECRET** | `""` |
| `ANTHROPIC_API_KEY` | Anthropic API key | **CRITICAL SECRET** | `""` |
| `GEMINI_API_KEY` | Google Gemini API key | **CRITICAL SECRET** | `""` |
| `LLM_API_KEY` | Generic fallback API key | **CRITICAL SECRET** | `""` |
| `LLM_TIMEOUT_MS` | Max model latency threshold before abort | Config | `10000` |
| `LLM_MAX_OUTPUT_TOKENS` | Cap on generated tokens per request | Config | `1024` |
| `LLM_MAX_TOOL_ITERATIONS` | Bounded iteration limit for multi-step tool calls | Config | `3` |

---

## 3. Structured Model Decision Schema

Free-form LLM text is never permitted to directly control system execution. The model must respond with pure JSON conforming to this strict Zod schema:

```typescript
export const ModelDecisionSchema = z.object({
  type: z.enum(["tool_call", "clarification", "final_answer"]),
  toolName: z.string().optional(),
  arguments: z.record(z.string(), z.unknown()).optional(),
  reasoningSummary: z.string().max(500).optional(),
  response: z.string().optional(),
});
```

- `tool_call`: Triggers tool validation and dispatch. `toolName` is strictly required.
- `clarification`: Asks the user for necessary clarification when intent is ambiguous.
- `final_answer`: Provides a factual business response based on verified tool data.
- `reasoningSummary`: Limited to 500 characters containing only operational rationale. Private chain-of-thought is neither requested nor logged.

---

## 4. Prompt Injection Defense-in-Depth

BizOps AI assumes all user input and stored business data is untrusted:
1. **Data vs Instruction Separation**: The system prompt explicitly commands the model that customer notes, invoice descriptions, email bodies, and database records are **DATA, NOT INSTRUCTIONS**. Directives like *"ignore previous instructions"* or *"system override"* embedded in database records are ignored.
2. **Authoritative Execution Boundary**: Even if a prompt injection causes the model to request an unauthorized tool or malicious parameters:
   - Tool names are checked against the hard-coded Tool Registry allowlist.
   - Parameters are validated with strict Zod schemas.
   - Frontline users cannot invoke admin-only tools.
3. **Consequential Impossibility**: No prompt injection can trigger an external email or financial transfer because consequential tools strictly create a `PENDING` `ApprovalRequest`. The LLM has zero capability to approve requests.

---

## 5. Deterministic Fallback Mode

The battle-tested deterministic rule engine from Phase 7 is preserved as an automatic, safe failover mechanism. Fallback engages seamlessly when:
- `LLM_PROVIDER="deterministic"`
- Configured provider API credentials are not set
- Model API times out (`LLM_TIMEOUT_MS`)
- Model outputs malformed or invalid non-JSON output
- External vendor returns HTTP 429, 500, or network socket failures

Responses clearly declare their execution provenance:
- `mode: "LLM"`
- `mode: "DETERMINISTIC_FALLBACK"`

---

## 6. AI Operational Auditability

Every AI request records an `AI_REQUEST_ORCHESTRATED` audit event in PostgreSQL with:
- `actor`: Authenticated user identity (`req.user.name (req.user.email)`). The AI is never the authoritative actor.
- `provider`: Active LLM provider name.
- `model`: Model name used.
- `executionMode`: `"LLM"` or `"DETERMINISTIC_FALLBACK"`.
- `toolUsed`: Tool identifier if a tool was executed or proposed.
- `approvalId`: Linked approval request ID if a consequential action was proposed.
- `latencyMs`: Request latency in milliseconds.
- **Strict Privacy**: Zero API keys, passwords, session cookies, or customer PII are logged in audit payloads.
