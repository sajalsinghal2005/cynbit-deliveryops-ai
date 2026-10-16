import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z
    .string()
    .default("dev-session-cookie-secret-min-32-chars-change-for-production"),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  ALLOWED_ORIGINS: z.string().optional(),
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .default("info"),

  // Rate Limiting
  RATE_LIMIT_MAX_PER_MINUTE: z.coerce.number().positive().default(100),
  AUTH_RATE_LIMIT_MAX_PER_MINUTE: z.coerce.number().positive().default(15),
  AGENT_RATE_LIMIT_MAX_PER_MINUTE: z.coerce.number().positive().default(30),

  // Email Integration (Phase 9)
  EMAIL_PROVIDER: z.enum(["simulation", "resend", "sendgrid"]).default("simulation"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("BizOps AI <billing@bizops.ai>"),
  EMAIL_WEBHOOK_SECRET: z.string().optional(),
  EMAIL_TIMEOUT_MS: z.coerce.number().positive().default(5000),
  TEST_EMAIL_RECIPIENT: z.string().optional(),

  // Phase 10 LLM Orchestration
  LLM_PROVIDER: z.enum(["deterministic", "openai", "anthropic", "gemini"]).default("deterministic"),
  LLM_MODEL: z.string().default("gpt-4o-mini"),
  LLM_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  LLM_TIMEOUT_MS: z.coerce.number().positive().default(10000),
  LLM_MAX_OUTPUT_TOKENS: z.coerce.number().positive().default(1024),
  LLM_MAX_TOOL_ITERATIONS: z.coerce.number().positive().default(3),
});

export type AppConfig = z.infer<typeof envSchema>;

function loadConfig(): AppConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue: z.ZodIssue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    console.error("❌ CRITICAL: Invalid environment configuration:\n" + errorDetails);
    throw new Error("Invalid environment configuration. Aborting server startup.");
  }

  const config = result.data;

  // Enforce production security invariants
  if (config.NODE_ENV === "production") {
    if (
      config.SESSION_SECRET === "dev-session-cookie-secret-min-32-chars-change-for-production" ||
      config.SESSION_SECRET.length < 32
    ) {
      throw new Error(
        "CRITICAL: In production mode, SESSION_SECRET must be set to a secure secret of at least 32 characters."
      );
    }

    try {
      const frontendUrl = new URL(config.FRONTEND_URL);
      if (frontendUrl.hostname === "localhost" || frontendUrl.hostname === "127.0.0.1") {
        throw new Error(
          "CRITICAL: In production mode, FRONTEND_URL must be configured with a valid public domain, not localhost."
        );
      }
    } catch (urlErr: any) {
      if (urlErr.message.includes("CRITICAL")) throw urlErr;
      throw new Error("CRITICAL: In production mode, FRONTEND_URL must be a valid URL.");
    }

    if (config.EMAIL_PROVIDER === "simulation") {
      throw new Error(
        "CRITICAL: In production mode, EMAIL_PROVIDER must be explicitly configured with a production provider (e.g. 'resend'), not 'simulation'."
      );
    }
  }

  // Provider-specific credential requirements
  if (config.EMAIL_PROVIDER === "resend") {
    if (!config.RESEND_API_KEY || config.RESEND_API_KEY.trim().length === 0) {
      throw new Error(
        "CRITICAL: EMAIL_PROVIDER is set to 'resend', but RESEND_API_KEY is missing or empty."
      );
    }
  }

  if (config.LLM_PROVIDER === "gemini") {
    const geminiKey = config.GEMINI_API_KEY || config.LLM_API_KEY;
    if (!geminiKey || geminiKey.trim().length === 0) {
      throw new Error(
        "CRITICAL: LLM_PROVIDER is set to 'gemini', but GEMINI_API_KEY is missing or empty."
      );
    }
  }

  return config;
}

export const config: AppConfig = loadConfig();
