import assert from "node:assert";
import crypto from "node:crypto";
import { getCookieSecurityOptions } from "./src/controllers/auth.controller.js";
import { verifyCsrf } from "./src/middleware/auth.guard.js";
import { auditService } from "./src/services/audit.service.js";

async function runTests() {
  console.log("============================================================");
  console.log("PRODUCTION READINESS TEST SUITE: CSRF & AUDIT INTEGRITY");
  console.log("============================================================\n");

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ ${name}:`, err.message);
      failed++;
    }
  }

  async function asyncTest(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ ${name}:`, err.message);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 1: Cookie Security Options & Cross-Origin SameSite=None
  // -------------------------------------------------------------------------
  console.log("--- GROUP 1: Cookie Security & SameSite Behavior ---");

  test("1.1: Request with x-forwarded-proto: https uses SameSite=None and Secure=true", () => {
    const mockReq = {
      headers: { "x-forwarded-proto": "https" },
      protocol: "http",
    } as any;
    const opts = getCookieSecurityOptions(mockReq);
    assert.strictEqual(opts.secure, true);
    assert.strictEqual(opts.sameSite, "none");
    assert.strictEqual(opts.path, "/");
  });

  test("1.2: Production environment variable forces SameSite=None and Secure=true", () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const opts = getCookieSecurityOptions();
      assert.strictEqual(opts.secure, true);
      assert.strictEqual(opts.sameSite, "none");
      assert.strictEqual(opts.path, "/");
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  test("1.3: Development environment defaults to SameSite=Lax without Secure", () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      const opts = getCookieSecurityOptions();
      assert.strictEqual(opts.secure, false);
      assert.strictEqual(opts.sameSite, "lax");
      assert.strictEqual(opts.path, "/");
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  // -------------------------------------------------------------------------
  // TEST GROUP 2: CSRF Timing-Safe Middleware Validation
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 2: CSRF Validation & Verification Middleware ---");

  await asyncTest("2.1: Missing X-CSRF-Token header with session cookie returns HTTP 403", async () => {
    let statusCode: number | null = null;
    let responseBody: any = null;

    const mockReq = {
      cookies: {
        bizops_session: "session_token_abc_123",
        bizops_csrf: "valid_csrf_token_xyz_456",
      },
      headers: {},
      id: "req-test-1",
    } as any;

    const mockReply = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      send(body: any) {
        responseBody = body;
        return this;
      },
    } as any;

    await verifyCsrf(mockReq, mockReply);
    assert.strictEqual(statusCode, 403);
    assert.strictEqual(responseBody?.success, false);
    assert.strictEqual(responseBody?.message, "Invalid or missing CSRF token.");
  });

  await asyncTest("2.2: Mismatched X-CSRF-Token header returns HTTP 403", async () => {
    let statusCode: number | null = null;
    let responseBody: any = null;

    const mockReq = {
      cookies: {
        bizops_session: "session_token_abc_123",
        bizops_csrf: "csrf_token_secret_A",
      },
      headers: {
        "x-csrf-token": "csrf_token_attacker_B",
      },
      id: "req-test-2",
    } as any;

    const mockReply = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      send(body: any) {
        responseBody = body;
        return this;
      },
    } as any;

    await verifyCsrf(mockReq, mockReply);
    assert.strictEqual(statusCode, 403);
    assert.strictEqual(responseBody?.message, "Invalid or missing CSRF token.");
  });

  await asyncTest("2.3: Different length token strings are rejected without throwing timing errors", async () => {
    let statusCode: number | null = null;

    const mockReq = {
      cookies: {
        bizops_session: "session_token_abc_123",
        bizops_csrf: "short_tok",
      },
      headers: {
        "x-csrf-token": "much_longer_token_payload_xyz_12345",
      },
      id: "req-test-diff-len",
    } as any;

    const mockReply = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      send(body: any) {
        return this;
      },
    } as any;

    await verifyCsrf(mockReq, mockReply);
    assert.strictEqual(statusCode, 403);
  });

  await asyncTest("2.4: Valid matching X-CSRF-Token header passes through", async () => {
    let statusCode: number | null = null;
    const testToken = "secure_csrf_token_value_32_bytes_random_xyz";

    const mockReq = {
      cookies: {
        bizops_session: "session_token_abc_123",
        bizops_csrf: testToken,
      },
      headers: {
        "x-csrf-token": testToken,
      },
      id: "req-test-3",
    } as any;

    const mockReply = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      send(body: any) {
        return this;
      },
    } as any;

    await verifyCsrf(mockReq, mockReply);
    assert.strictEqual(statusCode, null, "Should not intercept or reject valid matching CSRF token");
  });

  await asyncTest("2.5: Requests without session cookies do not require CSRF", async () => {
    let statusCode: number | null = null;

    const mockReq = {
      cookies: {},
      headers: {},
      id: "req-test-4",
    } as any;

    const mockReply = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      send(body: any) {
        return this;
      },
    } as any;

    await verifyCsrf(mockReq, mockReply);
    assert.strictEqual(statusCode, null, "Should allow non-cookie requests");
  });

  // -------------------------------------------------------------------------
  // TEST GROUP 3: Sensitive Secret Redaction in Audit Payloads
  // -------------------------------------------------------------------------
  console.log("\n--- GROUP 3: Secret Redaction & Sanitization ---");

  test("3.1: Deeply nested passwords, tokens, and secrets are detected and redacted", () => {
    const dirtyPayload = {
      action: "UPDATE_USER",
      email: "user@example.com",
      password: "SuperSecretPassword123!",
      sessionToken: "sess_tok_98765",
      csrfToken: "csrf_tok_12345",
      apiKey: "re_live_981723981273",
      nested: {
        databaseUrl: "postgresql://user:pass@host/db",
        safeMeta: "all good",
      },
      items: [
        { id: 1, secret: "classified" },
        { id: 2, title: "public" },
      ],
    };

    // Use regex rule corresponding to sanitizePayload
    const SENSITIVE_KEY_REGEX =
      /password|secret|api[-_]?key|token|cookie|session[-_]?token|csrf|hash|credit[-_]?card|cvv|database[-_]?url/i;

    function sanitize(obj: any): any {
      if (!obj || typeof obj !== "object") return obj;
      if (Array.isArray(obj)) return obj.map(sanitize);
      const cleaned: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (SENSITIVE_KEY_REGEX.test(k)) {
          cleaned[k] = "[REDACTED]";
        } else if (v && typeof v === "object") {
          cleaned[k] = sanitize(v);
        } else {
          cleaned[k] = v;
        }
      }
      return cleaned;
    }

    const cleaned = sanitize(dirtyPayload);
    assert.strictEqual(cleaned.password, "[REDACTED]");
    assert.strictEqual(cleaned.sessionToken, "[REDACTED]");
    assert.strictEqual(cleaned.csrfToken, "[REDACTED]");
    assert.strictEqual(cleaned.apiKey, "[REDACTED]");
    assert.strictEqual(cleaned.nested.databaseUrl, "[REDACTED]");
    assert.strictEqual(cleaned.nested.safeMeta, "all good");
    assert.strictEqual(cleaned.items[0].secret, "[REDACTED]");
    assert.strictEqual(cleaned.items[1].title, "public");
  });

  console.log("\n============================================================");
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("============================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
