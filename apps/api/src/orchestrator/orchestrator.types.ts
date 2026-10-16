import { z } from "zod";
import type { SafeUserProfile } from "../services/auth.service.js";
import type { AgentOutcomeType } from "../agents/business.agent.js";

/**
 * Strict Structured Model Decision Schema
 * Enforces that LLM outputs only conform to typed tool calls, clarifications, or final answers.
 */
export const ModelDecisionSchema = z.object({
  type: z.enum(["tool_call", "clarification", "final_answer"]),
  toolName: z.string().optional(),
  arguments: z.record(z.string(), z.unknown()).optional(),
  reasoningSummary: z
    .string()
    .max(500, "Reasoning summary must be at most 500 characters")
    .optional(),
  response: z.string().optional(),
}).refine(
  (data) => {
    if (data.type === "tool_call") {
      return typeof data.toolName === "string" && data.toolName.trim().length > 0;
    }
    if (data.type === "clarification" || data.type === "final_answer") {
      return typeof data.response === "string" && data.response.trim().length > 0;
    }
    return true;
  },
  {
    message:
      "tool_call must include toolName; clarification and final_answer must include response text.",
  }
);

export type ModelDecision = z.infer<typeof ModelDecisionSchema>;

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface LLMToolDeclaration {
  id: string;
  name: string;
  description: string;
  category: string;
  operationType: "READ_ONLY" | "CONSEQUENTIAL";
  parameters: Record<string, unknown>; // JSON Schema representation of parameters
}

export interface LLMTokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface LLMResponse {
  decision: ModelDecision;
  provider: string;
  model: string;
  latencyMs: number;
  usage?: LLMTokenUsage;
}

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  isAvailable(): boolean;
  generateStructuredDecision(
    messages: LLMMessage[],
    availableTools: LLMToolDeclaration[],
    options?: {
      signal?: AbortSignal;
      maxTokens?: number;
    }
  ): Promise<LLMResponse>;
}

export interface OrchestrationResult {
  success: boolean;
  outcome: AgentOutcomeType;
  message: string;
  approvalRequired: boolean;
  approvalId?: string;
  toolUsed?: string;
  data?: any;
  mode: "LLM" | "DETERMINISTIC_FALLBACK";
  provider: string;
  model: string;
  reasoningSummary?: string;
  usage?: LLMTokenUsage;
}

export interface OrchestratorContext {
  requestId?: string;
  user: SafeUserProfile;
}
