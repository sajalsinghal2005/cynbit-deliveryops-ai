import { config } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { toolRegistry } from "../tools/tool.registry.js";
import { approvalStore } from "../data/approvals.js";
import { businessAgent, type AgentProcessResult } from "../agents/business.agent.js";
import type { SafeUserProfile } from "../services/auth.service.js";
import type {
  LLMProvider,
  LLMMessage,
  OrchestrationResult,
  OrchestratorContext,
} from "./orchestrator.types.js";
import { formatToolDeclarations } from "./orchestrator.prompts.js";
import { DeterministicLLMProvider } from "./providers/deterministic.provider.js";
import { OpenAILLMProvider } from "./providers/openai.provider.js";
import { AnthropicLLMProvider } from "./providers/anthropic.provider.js";
import { GeminiLLMProvider } from "./providers/gemini.provider.js";

/**
 * Enterprise AI Orchestrator
 * Coordinates real LLM provider decisions, tool governance, role-based authorization,
 * consequential approval gating, and deterministic fallback.
 */
export class AIOrchestrator {
  private activeProvider: LLMProvider;

  constructor() {
    this.activeProvider = this.createDefaultProvider();
  }

  private createDefaultProvider(): LLMProvider {
    switch (config.LLM_PROVIDER) {
      case "openai":
        return new OpenAILLMProvider({
          apiKey: config.OPENAI_API_KEY || config.LLM_API_KEY,
          model: config.LLM_MODEL,
          timeoutMs: config.LLM_TIMEOUT_MS,
        });

      case "anthropic":
        return new AnthropicLLMProvider({
          apiKey: config.ANTHROPIC_API_KEY || config.LLM_API_KEY,
          model: config.LLM_MODEL,
          timeoutMs: config.LLM_TIMEOUT_MS,
        });

      case "gemini":
        return new GeminiLLMProvider({
          apiKey: config.GEMINI_API_KEY || config.LLM_API_KEY,
          model: config.LLM_MODEL,
          timeoutMs: config.LLM_TIMEOUT_MS,
        });

      case "deterministic":
      default:
        return new DeterministicLLMProvider();
    }
  }

  /**
   * Overrides the active LLM provider adapter.
   * Enables simulated failure, timeout, and mock verification in test suites.
   */
  public setProvider(provider: LLMProvider): void {
    this.activeProvider = provider;
  }

  /**
   * Resets active provider to environment configuration default.
   */
  public resetProvider(): void {
    this.activeProvider = this.createDefaultProvider();
  }

  /**
   * Returns current active provider name and model.
   */
  public getProviderInfo(): { name: string; model: string } {
    return {
      name: this.activeProvider.name,
      model: this.activeProvider.model,
    };
  }

  /**
   * Main AI Orchestration Pipeline
   */
  public async execute(
    message: string,
    user: SafeUserProfile,
    context?: { requestId?: string }
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const requestId = context?.requestId || `orch-${Date.now()}`;
    const actorIdentity = `${user.name} (${user.email})`;

    // 1. RBAC Guard: APPROVER role is restricted to review queue, not agent orchestration
    if (user.role === "APPROVER") {
      throw new Error("Access denied. Agent orchestration is restricted to ADMIN and OPERATOR roles.");
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return {
        success: false,
        outcome: "INVALID_REQUEST",
        message: "Please enter a business request.",
        approvalRequired: false,
        mode: "DETERMINISTIC_FALLBACK",
        provider: "deterministic",
        model: "rule-engine-v1",
      };
    }

    // 2. Fallback to deterministic agent if configured or credentials missing
    if (
      this.activeProvider.name === "deterministic" ||
      !this.activeProvider.isAvailable()
    ) {
      return this.executeDeterministicFallback(
        trimmedMessage,
        user,
        requestId,
        "Configured provider is deterministic or API credentials are not set."
      );
    }

    // 3. Attempt Real LLM Orchestration
    try {
      const availableTools = formatToolDeclarations(toolRegistry.listTools());
      const messages: LLMMessage[] = [{ role: "user", content: trimmedMessage }];

      let iterations = 0;
      const maxIterations = config.LLM_MAX_TOOL_ITERATIONS || 3;

      while (iterations < maxIterations) {
        iterations++;

        const llmResponse = await this.activeProvider.generateStructuredDecision(
          messages,
          availableTools,
          { maxTokens: config.LLM_MAX_OUTPUT_TOKENS }
        );

        const { decision } = llmResponse;

        // CASE A: Direct Final Answer or Clarification
        if (decision.type === "final_answer" || decision.type === "clarification") {
          let outcome: "READ_ONLY_RESULT" | "CLARIFICATION" | "REFUSAL" = "READ_ONLY_RESULT";
          const text = decision.response || "";
          if (decision.type === "clarification" || /(?:please\s+clarify|could\s+you\s+specify|which\s+project)/i.test(text)) {
            outcome = "CLARIFICATION";
          } else if (
            /(?:cannot|not\s+supported|unsupported|unable\s+to|refuse|disallowed|prohibited|not\s+permitted|do\s+not\s+have|can\s+only|safeguards?)/i.test(
              text
            )
          ) {
            outcome = "REFUSAL";
          }

          await this.recordAuditTrail(actorIdentity, {
            requestId,
            provider: this.activeProvider.name,
            model: this.activeProvider.model,
            executionMode: "LLM",
            decisionType: decision.type,
            latencyMs: Date.now() - startTime,
            reasoningSummary: decision.reasoningSummary,
          });

          return {
            success: true,
            outcome,
            message: decision.response || "Request processed successfully.",
            approvalRequired: false,
            mode: "LLM",
            provider: this.activeProvider.name,
            model: this.activeProvider.model,
            reasoningSummary: decision.reasoningSummary,
            usage: llmResponse.usage,
          };
        }

        // CASE B: Tool Call Decision
        if (decision.type === "tool_call" && decision.toolName) {
          const toolName = decision.toolName;

          // 1. Tool Allowlist Check
          if (!toolRegistry.hasTool(toolName)) {
            return this.executeDeterministicFallback(
              trimmedMessage,
              user,
              requestId,
              `LLM requested unregistered tool "${toolName}".`
            );
          }

          const toolDef = toolRegistry.getTool(toolName)!;

          // 2. CONSEQUENTIAL GOVERNANCE BOUNDARY:
          // Consequential tools (e.g. send-email, prepare-client-followup) NEVER execute autonomously!
          if (toolDef.operationType === "CONSEQUENTIAL" || toolDef.requiresApproval) {
            const rawArgs = decision.arguments || {};

            if (toolDef.id === "prepare-client-followup") {
              const followupResult = await toolRegistry.executeTool(
                toolDef.id,
                rawArgs,
                { user, requestId, source: "AI_AGENT" }
              );

              if (!followupResult.success || !followupResult.data) {
                return {
                  success: false,
                  outcome: "TOOL_EXECUTION_FAILURE",
                  message: followupResult.error || "Failed to prepare client follow-up proposal.",
                  approvalRequired: false,
                  toolUsed: toolDef.id,
                  mode: "LLM",
                  provider: this.activeProvider.name,
                  model: this.activeProvider.model,
                  reasoningSummary: decision.reasoningSummary,
                };
              }

              const createdApproval = followupResult.data.approvalRequest;

              await this.recordAuditTrail(actorIdentity, {
                requestId,
                provider: this.activeProvider.name,
                model: this.activeProvider.model,
                executionMode: "LLM",
                decisionType: "tool_call",
                toolUsed: toolDef.id,
                approvalRequestId: createdApproval.id,
                latencyMs: Date.now() - startTime,
              });

              return {
                success: true,
                outcome: "APPROVAL_REQUIRED",
                message: `Client follow-up proposal (${createdApproval.id}) was created for human review and authorization. Zero external emails have been sent.`,
                approvalRequired: true,
                approvalId: createdApproval.id,
                toolUsed: toolDef.id,
                data: followupResult.data,
                mode: "LLM",
                provider: this.activeProvider.name,
                model: this.activeProvider.model,
                reasoningSummary: decision.reasoningSummary,
                usage: llmResponse.usage,
              };
            }

            const invoices = Array.isArray(rawArgs.invoices) ? rawArgs.invoices : [];
            const customerName =
              invoices[0]?.clientName || (rawArgs.customer as string) || "Client Accounts Payable";
            const amount = invoices[0]?.amount || (rawArgs.amount as string) || "₹1,00,000";
            const relatedInvoiceId = invoices[0]?.invoiceNumber || undefined;

            const createdApproval = await approvalStore.create({
              title: `Send Reminder: ${invoices.length > 0 ? invoices[0].invoiceNumber : customerName}`,
              description: `Send payment reminder notice for ${customerName} (${amount})`,
              actionType: "SEND_INVOICE_REMINDER",
              toolName: toolDef.id,
              arguments: rawArgs,
              reason: decision.reasoningSummary || "Overdue invoice collection follow-up.",
              customer: customerName,
              amount,
              risk: toolDef.risk,
              relatedInvoiceId,
              requestedBy: {
                id: user.id,
                name: user.name,
                email: user.email,
              },
            });

            await this.recordAuditTrail(actorIdentity, {
              requestId,
              provider: this.activeProvider.name,
              model: this.activeProvider.model,
              executionMode: "LLM",
              decisionType: "tool_call",
              toolUsed: toolDef.id,
              approvalRequestId: createdApproval.id,
              latencyMs: Date.now() - startTime,
            });

            return {
              success: true,
              outcome: "APPROVAL_REQUIRED",
              message: `A consequential action proposal (${createdApproval.id}) was created for human review and authorization. Zero external emails have been sent.`,
              approvalRequired: true,
              approvalId: createdApproval.id,
              toolUsed: toolDef.id,
              data: {
                approvalRequest: createdApproval,
              },
              mode: "LLM",
              provider: this.activeProvider.name,
              model: this.activeProvider.model,
              reasoningSummary: decision.reasoningSummary,
              usage: llmResponse.usage,
            };
          }

          // 3. READ-ONLY TOOL EXECUTION:
          const toolExecResult = await toolRegistry.executeTool(
            toolName,
            decision.arguments,
            { user, requestId, source: "AI_AGENT" }
          );

          if (!toolExecResult.success) {
            return {
              success: false,
              outcome: "TOOL_EXECUTION_FAILURE",
              message: toolExecResult.error || "Tool execution failed.",
              approvalRequired: false,
              toolUsed: toolName,
              mode: "LLM",
              provider: this.activeProvider.name,
              model: this.activeProvider.model,
              reasoningSummary: decision.reasoningSummary,
            };
          }

          await this.recordAuditTrail(actorIdentity, {
            requestId,
            provider: this.activeProvider.name,
            model: this.activeProvider.model,
            executionMode: "LLM",
            decisionType: "tool_call",
            toolUsed: toolName,
            latencyMs: Date.now() - startTime,
          });

          // Grounding & Deterministic Source of Truth: ensure factual tool message is preserved
          let message =
            toolExecResult.data?.message ||
            decision.reasoningSummary ||
            `Successfully executed ${toolDef.name}.`;

          if (toolName === "project-risk-analysis" && toolExecResult.data?.overallRiskLevel) {
            const serverLevel = toolExecResult.data.overallRiskLevel;
            if (decision.reasoningSummary) {
              const lowerReason = decision.reasoningSummary.toLowerCase();
              const hasContradiction =
                (serverLevel === "CRITICAL" && (lowerReason.includes("low risk") || lowerReason.includes("healthy"))) ||
                (serverLevel === "HIGH" && (lowerReason.includes("low risk") || lowerReason.includes("healthy"))) ||
                (serverLevel === "LOW" && (lowerReason.includes("critical risk") || lowerReason.includes("high risk")));
              if (hasContradiction) {
                message = toolExecResult.data.message;
              }
            }
          }

          // Single-turn tool call return
          return {
            success: true,
            outcome: "READ_ONLY_RESULT",
            message,
            approvalRequired: false,
            toolUsed: toolName,
            data: toolExecResult.data,
            mode: "LLM",
            provider: this.activeProvider.name,
            model: this.activeProvider.model,
            reasoningSummary: decision.reasoningSummary,
            usage: llmResponse.usage,
          };
        }
      }

      // Max iterations reached without terminal state
      return this.executeDeterministicFallback(
        trimmedMessage,
        user,
        requestId,
        "Maximum tool execution iterations exceeded."
      );
    } catch (llmError: any) {
      // Safe failover: Provider failure or timeout immediately falls back to deterministic rule engine
      return this.executeDeterministicFallback(
        trimmedMessage,
        user,
        requestId,
        `LLM provider error (${this.activeProvider.name}): ${llmError?.message || "Unknown error"}`
      );
    }
  }

  /**
   * Executes the deterministic business agent fallback while recording mode metadata.
   */
  private async executeDeterministicFallback(
    message: string,
    user: SafeUserProfile,
    requestId: string,
    reason?: string
  ): Promise<OrchestrationResult> {
    const fallbackResult: AgentProcessResult = await businessAgent.execute(message, user);

    const actorIdentity = `${user.name} (${user.email})`;
    await this.recordAuditTrail(actorIdentity, {
      requestId,
      provider: "deterministic",
      model: "rule-engine-v1",
      executionMode: "DETERMINISTIC_FALLBACK",
      fallbackReason: reason,
      outcome: fallbackResult.outcome,
      toolUsed: fallbackResult.toolUsed,
      approvalId: fallbackResult.approvalId,
    });

    return {
      ...fallbackResult,
      mode: "DETERMINISTIC_FALLBACK",
      provider: "deterministic",
      model: "rule-engine-v1",
      reasoningSummary: reason || "Processed via deterministic rule engine.",
    };
  }

  /**
   * Records sanitized operational telemetry in the PostgreSQL audit log.
   */
  private async recordAuditTrail(actor: string, payload: Record<string, any>): Promise<void> {
    try {
      await prisma.auditEvent.create({
        data: {
          eventType: "AI_REQUEST_ORCHESTRATED",
          actor,
          payload: {
            ...payload,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch {
      // Telemetry audit recording failure must not crash business workflow
    }
  }
}

export const aiOrchestrator = new AIOrchestrator();
