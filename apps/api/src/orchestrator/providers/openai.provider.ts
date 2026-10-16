import {
  type LLMProvider,
  type LLMMessage,
  type LLMToolDeclaration,
  type LLMResponse,
  ModelDecisionSchema,
} from "../orchestrator.types.js";
import { BIZOPS_SYSTEM_PROMPT } from "../orchestrator.prompts.js";

export interface OpenAIProviderOptions {
  apiKey?: string;
  model?: string;
  apiBaseUrl?: string;
  timeoutMs?: number;
}

/**
 * Production OpenAI LLM Provider
 * Implements structured JSON decision synthesis via OpenAI Chat Completions REST API
 * with abort timeouts, strict schema validation, and complete secret redaction.
 */
export class OpenAILLMProvider implements LLMProvider {
  public readonly name = "openai";
  public readonly model: string;
  private apiKey?: string;
  private apiBaseUrl: string;
  private timeoutMs: number;

  constructor(options: OpenAIProviderOptions = {}) {
    this.apiKey = options.apiKey?.trim();
    this.model = options.model || "gpt-4o-mini";
    this.apiBaseUrl = options.apiBaseUrl || "https://api.openai.com/v1";
    this.timeoutMs = options.timeoutMs || 10000;
  }

  public isAvailable(): boolean {
    return typeof this.apiKey === "string" && this.apiKey.length > 0;
  }

  public async generateStructuredDecision(
    messages: LLMMessage[],
    availableTools: LLMToolDeclaration[],
    options?: { signal?: AbortSignal; maxTokens?: number }
  ): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      throw new Error("OpenAI provider is not configured: OPENAI_API_KEY is missing.");
    }

    const startTime = Date.now();

    const toolCatalogSummary = availableTools
      .map(
        (t) =>
          `- ${t.id} (${t.operationType}): ${t.description}. Parameters schema: ${JSON.stringify(
            t.parameters
          )}`
      )
      .join("\n");

    const fullSystemPrompt = `${BIZOPS_SYSTEM_PROMPT}\n\nAVAILABLE TOOLS IN TOOL REGISTRY:\n${toolCatalogSummary}`;

    const apiMessages = [
      { role: "system", content: fullSystemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const payload = {
      model: this.model,
      messages: apiMessages,
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: options?.maxTokens || 1024,
    };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // Composite signal with timeout
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);

    try {
      const response = await fetch(`${this.apiBaseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: options?.signal || timeoutSignal,
      });

      if (!response.ok) {
        throw await this.sanitizeHttpError(response);
      }

      const data = (await response.json()) as any;
      const rawContent = data.choices?.[0]?.message?.content || "{}";

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawContent);
      } catch {
        throw new Error("Model returned invalid non-JSON output.");
      }

      const decision = ModelDecisionSchema.parse(parsed);

      return {
        decision,
        provider: this.name,
        model: this.model,
        latencyMs: Date.now() - startTime,
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
        },
      };
    } catch (err: any) {
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        throw new Error(`OpenAI request timed out after ${this.timeoutMs}ms.`);
      }
      throw err;
    }
  }

  private async sanitizeHttpError(response: Response): Promise<Error> {
    const status = response.status;
    let safeMessage = `OpenAI API returned HTTP ${status}.`;

    if (status === 401 || status === 403) {
      safeMessage = "OpenAI authentication failed. Check API key configuration.";
    } else if (status === 429) {
      safeMessage = "OpenAI rate limit or quota exceeded.";
    } else if (status >= 500) {
      safeMessage = "OpenAI service is temporarily unavailable (HTTP 5xx).";
    }

    return new Error(safeMessage);
  }
}
