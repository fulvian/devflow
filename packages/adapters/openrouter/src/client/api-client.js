import { getAuthHeaders, resolveApiKey } from './auth.js';
import { withRetries } from './retry.js';
import { z, loadOpenRouterEnv } from '@devflow/shared';
const ChatMessageSchema = z.object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.string(),
});
const ChatResponseSchema = z.object({
    id: z.string(),
    model: z.string(),
    created: z.number(),
    choices: z.array(z.object({
        index: z.number(),
        message: ChatMessageSchema,
        finish_reason: z.string().optional(),
    })),
    usage: z
        .object({
        total_tokens: z.number(),
        prompt_tokens: z.number(),
        completion_tokens: z.number(),
    })
        .optional(),
});
export class HttpError extends Error {
    status;
    body;
    constructor(message, status, body) {
        super(message);
        this.status = status;
        this.body = body;
        this.name = 'HttpError';
    }
}
export class OpenRouterClient {
    baseUrl;
    timeoutMs;
    retryOpts;
    apiKey;
    constructor(cfg = {}) {
        const env = loadOpenRouterEnv();
        this.baseUrl = cfg.baseUrl ?? env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
        this.timeoutMs = cfg.timeoutMs ?? env.OPENROUTER_TIMEOUT_MS ?? 30_000;
        const retries = cfg.retries ?? env.OPENROUTER_MAX_RETRIES ?? 3;
        this.retryOpts = { retries, initialDelayMs: 500, maxDelayMs: 8_000 };
        this.apiKey = resolveApiKey(cfg.apiKey ? { apiKey: cfg.apiKey } : undefined);
    }
    async chat(req) {
        const doFetch = async () => {
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
                    let body;
                    try {
                        body = await res.json();
                    }
                    catch {
                        body = await res.text();
                    }
                    throw new HttpError(`OpenRouter error ${res.status}`, res.status, body);
                }
                const data = await res.json();
                const parsed = ChatResponseSchema.safeParse(data);
                if (!parsed.success) {
                    throw new Error(`Invalid response schema: ${parsed.error.message}`);
                }
                return parsed.data;
            }
            finally {
                clearTimeout(timer);
            }
        };
        return withRetries(doFetch, this.retryOpts);
    }
}
//# sourceMappingURL=api-client.js.map