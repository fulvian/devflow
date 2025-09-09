import { OpenRouterClient, type ChatMessage, type ChatResponse } from './client/api-client.js';
import { RateLimiter } from './client/rate-limiter.js';
import { withRetries } from './client/retry.js';
import { DEFAULT_MODELS, type ModelSpec, findModelSpec } from './models/model-config.js';
import { route } from './routing/router.js';
import { getFallbacks } from './routing/fallback.js';
import { CostTracker } from './analytics/cost-tracker.js';
import { UsageTracker } from './analytics/usage-tracker.js';
import { PerformanceTracker } from './routing/performance-tracker.js';
import { loadOpenRouterEnv } from '@devflow/shared';

export interface OpenRouterGatewayConfig {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly requestsPerMinute?: number;
  readonly budgetUsd?: number;
  readonly preferredModels?: ReadonlyArray<string>;
}

export interface GenerateInput {
  readonly title?: string;
  readonly description: string;
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly context?: { injected?: string };
}

export interface GenerateResult {
  readonly model: string;
  readonly text: string;
  readonly raw: ChatResponse;
}

export class OpenRouterGateway {
  private readonly client: OpenRouterClient;
  private readonly limiter: RateLimiter | undefined;
  private readonly models: ReadonlyArray<ModelSpec>;
  private readonly cost: CostTracker;
  private readonly usage: UsageTracker;
  private readonly perf: PerformanceTracker;

  constructor(cfg: OpenRouterGatewayConfig = {}) {
    const env = loadOpenRouterEnv();
    const clientCfg: Record<string, unknown> = {};
    if (cfg.baseUrl !== undefined) clientCfg['baseUrl'] = cfg.baseUrl;
    if (cfg.apiKey !== undefined) clientCfg['apiKey'] = cfg.apiKey;
    if (cfg.timeoutMs !== undefined) clientCfg['timeoutMs'] = cfg.timeoutMs;
    if (cfg.maxRetries !== undefined) clientCfg['retries'] = cfg.maxRetries;
    this.client = new OpenRouterClient(clientCfg as never);
    this.limiter = cfg.requestsPerMinute ? new RateLimiter({ requestsPerMinute: cfg.requestsPerMinute }) : undefined;
    const preferred = cfg.preferredModels ?? env.OPENROUTER_PREFERRED_MODELS ?? [];
    const filtered = preferred.length > 0 ? DEFAULT_MODELS.filter((m) => preferred.includes(m.id)) : DEFAULT_MODELS;
    this.models = filtered.length > 0 ? filtered : DEFAULT_MODELS;
    this.cost = new CostTracker();
    this.cost.setBudget(cfg.budgetUsd ?? env.OPENROUTER_COST_BUDGET_USD);
    this.usage = new UsageTracker();
    this.perf = new PerformanceTracker();
  }

  private mergeContext(messages: ReadonlyArray<ChatMessage>, injected?: string): ReadonlyArray<ChatMessage> {
    if (!injected) return messages;
    const sys: ChatMessage = { role: 'system', content: injected };
    return [sys, ...messages];
  }

  async generate(input: GenerateInput): Promise<GenerateResult> {
    // Rough token estimate: 1 token ~= 4 chars
    const approxTokens = Math.floor(input.messages.reduce((acc, m) => acc + m.content.length, 0) / 4);
    const baseRoute: { description: string; title?: string; contextTokens?: number; models?: ReadonlyArray<ModelSpec> } = { description: input.description };
    if (input.title !== undefined) baseRoute.title = input.title;
    baseRoute.contextTokens = approxTokens;
    baseRoute.models = this.models;
    const routed = route(baseRoute);
    const primary = routed.model.id;
    const fallbacks = getFallbacks(primary);
    const order = [primary, ...fallbacks];

    let lastError: unknown;
    for (const modelId of order) {
      const spec = findModelSpec(modelId, this.models) ?? this.models[0];
      if (!spec) throw new Error('No models configured');
      try {
        if (this.limiter) await this.limiter.acquire();
        const started = Date.now();
        const reqBase: { model: string; messages: ReadonlyArray<ChatMessage>; max_tokens?: number; temperature?: number } = {
          model: modelId,
          messages: this.mergeContext(input.messages, input.context?.injected),
        };
        if (input.maxTokens !== undefined) reqBase.max_tokens = input.maxTokens;
        if (input.temperature !== undefined) reqBase.temperature = input.temperature;
        const res = await withRetries(() => this.client.chat(reqBase), { retries: 0, initialDelayMs: 0, maxDelayMs: 0 });
        const latency = Date.now() - started;
        const text = res.choices[0]?.message?.content ?? '';
        const usage = res.usage ?? { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0 };
        this.cost.add(spec, { model: modelId, inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens });
        this.usage.record(modelId);
        this.perf.record({ model: modelId, latencyMs: latency, success: true, timestamp: Date.now() });
        return { model: modelId, text, raw: res };
      } catch (err) {
        lastError = err;
        this.perf.record({ model: modelId, latencyMs: 0, success: false, timestamp: Date.now() });
        // Try next fallback
      }
    }
    throw lastError ?? new Error('OpenRouter request failed');
  }
}
