/**
 * A model asked one question that it must answer with one JSON object of a given shape. The question is put as a
 * single strict function tool the model has to call, so the provider holds the answer to the schema.
 *
 * It knows nothing of the game: the blind player (blindPlay.ts) builds the questions and reads the answers.
 */

export interface StructuredRequest {
  /** What the model is and how it should answer. */
  instructions: string;
  /** What it is shown this time. */
  input: string;
  /** The answer's name and purpose, as the model's one tool. */
  name: string;
  description: string;
  /** The answer's JSON schema: an object, every property required. */
  schema: Readonly<Record<string, unknown>>;
}

interface StructuredUsage {
  inputTokens: number;
  outputTokens: number;
}

interface StructuredAnswer {
  /** The parsed JSON object, not yet checked against the schema. */
  value: unknown;
  usage?: StructuredUsage;
}

export interface StructuredModel {
  identity: { provider: string; model: string };
  ask(request: StructuredRequest): Promise<StructuredAnswer>;
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export interface OpenAiModelConfig {
  apiKey: string;
  model: string;
  /** Sent as `reasoning.effort`; left out, the model uses its own. */
  reasoningEffort?: string;
  timeoutMs?: number;
  /** How many times a failed request (a network error, 429 or 5xx) is tried again. */
  retries?: number;
  /** Stands in for the global fetch in tests. */
  fetch?: Fetch;
}

const responsesUrl = "https://api.openai.com/v1/responses";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function usageOf(response: Record<string, unknown>): StructuredUsage | null {
  const usage = response.usage;
  return isRecord(usage) &&
    typeof usage.input_tokens === "number" &&
    typeof usage.output_tokens === "number"
    ? { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens }
    : null;
}

/** The arguments of the one function call named `name` in a Responses API answer, parsed. */
function functionCallArguments(response: unknown, name: string): unknown {
  if (!isRecord(response) || !Array.isArray(response.output)) {
    throw new Error("The model's response had no output.");
  }
  const call = response.output.find(
    (item: unknown): item is Record<string, unknown> & { arguments: string } =>
      isRecord(item) &&
      item.type === "function_call" &&
      item.name === name &&
      typeof item.arguments === "string",
  );
  if (call === undefined) {
    throw new Error(`The model did not answer with ${name}.`);
  }
  try {
    return JSON.parse(call.arguments);
  } catch {
    throw new Error(`The model's ${name} was not JSON.`);
  }
}

function retryable(status: number): boolean {
  return status === 429 || status >= 500;
}

/** A structured model on OpenAI's Responses API, called with fetch so that it needs no SDK. */
export function createOpenAiModel(config: OpenAiModelConfig): StructuredModel {
  const timeoutMs = config.timeoutMs ?? 120_000;
  const retries = config.retries ?? 2;
  const send = config.fetch ?? fetch;
  return {
    identity: { provider: "openai", model: config.model },
    async ask(request) {
      const body = JSON.stringify({
        model: config.model,
        ...(config.reasoningEffort === undefined
          ? {}
          : { reasoning: { effort: config.reasoningEffort } }),
        instructions: request.instructions,
        input: [{ role: "user", content: request.input }],
        tools: [
          {
            type: "function",
            name: request.name,
            description: request.description,
            strict: true,
            parameters: request.schema,
          },
        ],
        tool_choice: { type: "function", name: request.name },
        parallel_tool_calls: false,
        store: false,
      });
      let lastError: unknown = null;
      for (let attempt = 0; attempt <= retries; attempt++) {
        let response: Response;
        try {
          response = await send(responsesUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.apiKey}`,
            },
            body,
            signal: AbortSignal.timeout(timeoutMs),
          });
        } catch (error) {
          lastError = error;
          continue;
        }
        if (!response.ok) {
          const detail = (await response.text()).slice(0, 500);
          lastError = new Error(
            `OpenAI answered ${String(response.status)}: ${detail}`,
          );
          if (retryable(response.status)) continue;
          throw lastError;
        }
        const json: unknown = await response.json();
        const value = functionCallArguments(json, request.name);
        const usage = isRecord(json) ? usageOf(json) : null;
        return usage === null ? { value } : { value, usage };
      }
      throw lastError instanceof Error
        ? lastError
        : new Error("The request to OpenAI failed.");
    },
  };
}
