import {
  type LLMProvider,
  type LLMMessage,
  type LLMToolDeclaration,
  type LLMResponse,
  ModelDecisionSchema,
} from "../orchestrator.types.js";
import { BIZOPS_SYSTEM_PROMPT } from "../orchestrator.prompts.js";

export interface GeminiProviderOptions {
  apiKey?: string;
  model?: string;
  apiBaseUrl?: string;
  timeoutMs?: number;
}

/**
 * Production Google Gemini LLM Provider
 * Implements structured JSON decision synthesis via Google Generative Language REST API.
 */
export class GeminiLLMProvider implements LLMProvider {
  public readonly name = "gemini";
  public readonly model: string;
  private apiKey?: string;
  private apiBaseUrl: string;
  private timeoutMs: number;

  constructor(options: GeminiProviderOptions = {}) {
    this.apiKey = options.apiKey?.trim();
    this.model = options.model || "gemini-1.5-flash";
    this.apiBaseUrl =
      options.apiBaseUrl || "https://generativelanguage.googleapis.com/v1beta";
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
      throw new Error("Gemini provider is not configured: GEMINI_API_KEY is missing.");
    }

    const startTime = Date.now();

    const toolCatalogSummary = availableTools
      .map(
        (t) =>
          `- ${t.id} (${t.operationType}): ${t.description}. Schema: ${JSON.stringify(t.parameters)}`
      )
      .join("\n");

    const fullSystemPrompt = `${BIZOPS_SYSTEM_PROMPT}\n\nAVAILABLE TOOLS:\n${toolCatalogSummary}`;

    const contents = [
      {
        role: "user",
        parts: [{ text: `[SYSTEM INSTRUCTIONS]\n${fullSystemPrompt}` }],
      },
      ...messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    ];

    const payload = {
      contents,
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: options?.maxTokens || 1024,
        temperature: 0.1,
      },
    };

    const url = `${this.apiBaseUrl}/models/${encodeURIComponent(this.model)}:generateContent`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-goog-api-key": this.apiKey!,
    };

    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: options?.signal || timeoutSignal,
      });

      if (!response.ok) {
        throw await this.sanitizeHttpError(response);
      }

      const data = (await response.json()) as any;
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "{}";

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
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
          promptTokens: data.usageMetadata?.promptTokenCount,
          completionTokens: data.usageMetadata?.candidatesTokenCount,
          totalTokens: data.usageMetadata?.totalTokenCount,
        },
      };
    } catch (err: any) {
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        throw new Error(`Gemini request timed out after ${this.timeoutMs}ms.`);
      }
      throw err;
    }
  }

  private async sanitizeHttpError(response: Response): Promise<Error> {
    const status = response.status;
    let safeMessage = `Gemini API returned HTTP ${status}.`;

    if (status === 400) {
      safeMessage = "Gemini rejected request payload format.";
    } else if (status === 401 || status === 403) {
      safeMessage = "Gemini authentication failed. Verify API key configuration.";
    } else if (status === 429) {
      safeMessage = "Gemini quota or rate limit exceeded.";
    } else if (status >= 500) {
      safeMessage = "Gemini service is temporarily unavailable (HTTP 5xx).";
    }

    return new Error(safeMessage);
  }
}
