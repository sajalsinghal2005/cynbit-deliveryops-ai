import {
  type LLMProvider,
  type LLMMessage,
  type LLMToolDeclaration,
  type LLMResponse,
  ModelDecisionSchema,
} from "../orchestrator.types.js";
import { BIZOPS_SYSTEM_PROMPT } from "../orchestrator.prompts.js";

export interface AnthropicProviderOptions {
  apiKey?: string;
  model?: string;
  apiBaseUrl?: string;
  timeoutMs?: number;
}

/**
 * Production Anthropic LLM Provider
 * Implements structured decision orchestration via Anthropic Messages REST API.
 */
export class AnthropicLLMProvider implements LLMProvider {
  public readonly name = "anthropic";
  public readonly model: string;
  private apiKey?: string;
  private apiBaseUrl: string;
  private timeoutMs: number;

  constructor(options: AnthropicProviderOptions = {}) {
    this.apiKey = options.apiKey?.trim();
    this.model = options.model || "claude-3-5-sonnet-20241022";
    this.apiBaseUrl = options.apiBaseUrl || "https://api.anthropic.com/v1";
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
      throw new Error("Anthropic provider is not configured: ANTHROPIC_API_KEY is missing.");
    }

    const startTime = Date.now();

    const toolCatalogSummary = availableTools
      .map(
        (t) =>
          `- ${t.id} (${t.operationType}): ${t.description}. Schema: ${JSON.stringify(t.parameters)}`
      )
      .join("\n");

    const fullSystemPrompt = `${BIZOPS_SYSTEM_PROMPT}\n\nAVAILABLE TOOLS:\n${toolCatalogSummary}\n\nIMPORTANT: Respond with pure JSON only without markdown code blocks.`;

    const apiMessages = messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    const payload = {
      model: this.model,
      system: fullSystemPrompt,
      messages: apiMessages,
      max_tokens: options?.maxTokens || 1024,
      temperature: 0.1,
    };

    const headers: Record<string, string> = {
      "x-api-key": this.apiKey!,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);

    try {
      const response = await fetch(`${this.apiBaseUrl}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: options?.signal || timeoutSignal,
      });

      if (!response.ok) {
        throw await this.sanitizeHttpError(response);
      }

      const data = (await response.json()) as any;
      const textBlock = data.content?.find((c: any) => c.type === "text");
      const rawContent = textBlock?.text?.trim() || "{}";

      // Strip potential markdown wrapping ```json ... ```
      const cleanJson = rawContent
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();

      let parsed: unknown;
      try {
        parsed = JSON.parse(cleanJson);
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
          promptTokens: data.usage?.input_tokens,
          completionTokens: data.usage?.output_tokens,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
      };
    } catch (err: any) {
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        throw new Error(`Anthropic request timed out after ${this.timeoutMs}ms.`);
      }
      throw err;
    }
  }

  private async sanitizeHttpError(response: Response): Promise<Error> {
    const status = response.status;
    let safeMessage = `Anthropic API returned HTTP ${status}.`;

    if (status === 401 || status === 403) {
      safeMessage = "Anthropic authentication failed. Check API key configuration.";
    } else if (status === 429) {
      safeMessage = "Anthropic rate limit exceeded.";
    } else if (status >= 500) {
      safeMessage = "Anthropic service is temporarily unavailable (HTTP 5xx).";
    }

    return new Error(safeMessage);
  }
}
