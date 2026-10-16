import { z } from "zod";
import type { SafeUserProfile } from "../services/auth.service.js";

export type ToolRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ToolOperationType = "READ_ONLY" | "CONSEQUENTIAL";
export type ToolCategory = "CRM" | "Finance" | "Analytics" | "Operations" | "DeliveryOps";

export interface ToolExecutionContext {
  user?: SafeUserProfile;
  requestId?: string;
  source?: "AI_AGENT" | "DIRECT_API";
}

export interface ToolDefinition<TInput = any, TOutput = any> {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  operationType: ToolOperationType;
  risk: ToolRisk;
  requiresApproval: boolean;
  schema: z.ZodType<TInput>;
  outputSchema?: z.ZodType<TOutput>;
  execute: (params: TInput, context?: ToolExecutionContext) => Promise<TOutput> | TOutput;
}

export interface ToolExecutionResult<T = any> {
  success: boolean;
  toolId: string;
  data?: T;
  error?: string;
  metadata?: {
    operationType: ToolOperationType;
    requiresApproval: boolean;
    executedAt: string;
  };
}
