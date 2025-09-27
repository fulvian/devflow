import { getAuthHeaders, resolveApiKey } from './auth.js';
import { withRetries, type RetryOptions } from './retry.js';
import { z, loadOpenRouterEnv } from '@devflow/shared';

export interface HttpClientConfig {
  readonly baseUrl?: string;
  readonly apiKey?: string;
  readonly timeoutMs?: number;
  readonly retries?: number;
}

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string;
}

export interface ChatRequest {
  readonly model: string;
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly max_tokens?: number;
  readonly temperature?: number;
  readonly top_p?: number;
  readonly response_format?: { type: 'text' | 'json_object' };
}

export interface Usage {
  readonly total_tokens: number;
  readonly prompt_tokens: number;
  readonly completion_tokens: number;
}

export interface ChatResponseChoice {
  readonly index: number;
  readonly message: ChatMessage;
  readonly finish_reason?: string;
}

export interface ChatResponse {
  readonly id: string;
  readonly model: string;
  readonly created: number;
  readonly choices: ChatResponseChoice[];
  readonly usage?: Usage;
}

const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string(),
});

const ChatResponseSchema = z.object({
  id: z.string(),
  model: z.string(),
  created: z.number(),
  choices: z.array(
    z.object({
      index: z.number(),
      message: ChatMessageSchema,
      finish_reason: z.string().optional(),
    }),
  ),
  usage: z
    .object({
      total_tokens: z.number(),
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
    })
    .optional(),
});

export class HttpError extends Error {
  constructor(message: string, public readonly status: number, public readonly body?: unknown) {
    super(message);
    this.name = 'HttpError';
  }
}

export class OpenRouterClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly retryOpts: RetryOptions;
  private readonly apiKey: string;

  constructor(cfg: HttpClientConfig = {}) {
    const env = loadOpenRouterEnv();
    this.baseUrl = cfg.baseUrl ?? env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
    this.timeoutMs = cfg.timeoutMs ?? env.OPENROUTER_TIMEOUT_MS ?? 30_000;
    const retries = cfg.retries ?? env.OPENROUTER_MAX_RETRIES ?? 3;
    this.retryOpts = { retries, initialDelayMs: 500, maxDelayMs: 8_000 };
    this.apiKey = resolveApiKey(cfg.apiKey ? { apiKey: cfg.apiKey } : undefined);
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const doFetch = async (): Promise<ChatResponse> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders({ apiKey: this.apiKey }),
          },
          body: JSON.stringify(req),
          signal: controller.signal,
        });
        if (!res.ok) {
          let body: unknown;
          try {
            body = await res.json();
          } catch {
            body = await res.text();
          }
          throw new HttpError(`OpenRouter error ${res.status}`, res.status, body);
        }
        const data = await res.json();
        const parsed = ChatResponseSchema.safeParse(data);
        if (!parsed.success) {
          throw new Error(`Invalid response schema: ${parsed.error.message}`);
        }
        return parsed.data as ChatResponse;
      } finally {
        clearTimeout(timer);
      }
    };

    return withRetries(doFetch, this.retryOpts);
  }
}
