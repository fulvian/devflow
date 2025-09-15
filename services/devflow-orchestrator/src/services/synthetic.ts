import { z } from 'zod';

export const SyntheticCodeRequestSchema = z.object({
  prompt: z.string().min(1),
  context: z.record(z.any()).optional(),
  sessionId: z.string().optional(),
});

export const SyntheticReasoningRequestSchema = z.object({
  prompt: z.string().min(1),
  context: z.record(z.any()).optional(),
  sessionId: z.string().optional(),
});

export const SyntheticResponseSchema = z.object({
  result: z.string(),
  metadata: z.object({
    agentType: z.enum(['code', 'reasoning']),
    processingTime: z.number().int().nonnegative(),
    confidence: z.number().min(0).max(1),
    provider: z.string().optional(),
    model: z.string().optional(),
    tokensIn: z.number().int().nonnegative().optional(),
    tokensOut: z.number().int().nonnegative().optional(),
    costUsd: z.number().nonnegative().optional(),
  }),
});

export type SyntheticCodeRequest = z.infer<typeof SyntheticCodeRequestSchema>;
export type SyntheticReasoningRequest = z.infer<typeof SyntheticReasoningRequestSchema>;
export type SyntheticResponse = z.infer<typeof SyntheticResponseSchema>;

export interface SyntheticProvider {
  code(input: SyntheticCodeRequest, signal?: AbortSignal): Promise<SyntheticResponse>;
  reasoning(input: SyntheticReasoningRequest, signal?: AbortSignal): Promise<SyntheticResponse>;
}

export interface RetryOptions {
  retries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt <= opts.retries) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === opts.retries) break;
      const delay = Math.min(
        opts.baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 100),
        opts.maxDelayMs
      );
      await sleep(delay);
      attempt++;
    }
  }
  throw lastErr;
}

export class LocalSyntheticProvider implements SyntheticProvider {
  constructor(private readonly retry: RetryOptions = { retries: 1, baseDelayMs: 100, maxDelayMs: 1000 }) {}

  async code(input: SyntheticCodeRequest, signal?: AbortSignal): Promise<SyntheticResponse> {
    const start = Date.now();
    const exec = async () => {
      // Placeholder for real provider call
      if (signal?.aborted) throw new Error('ABORT_ERR');
      return {
        result: `Code generation result for: ${input.prompt}`,
        metadata: { agentType: 'code', processingTime: Date.now() - start, confidence: 0.95, provider: 'local' },
      } as const;
    };
    return withRetry(exec, this.retry);
  }

  async reasoning(input: SyntheticReasoningRequest, signal?: AbortSignal): Promise<SyntheticResponse> {
    const start = Date.now();
    const exec = async () => {
      if (signal?.aborted) throw new Error('ABORT_ERR');
      return {
        result: `Reasoning result for: ${input.prompt}`,
        metadata: { agentType: 'reasoning', processingTime: Date.now() - start, confidence: 0.92, provider: 'local' },
      } as const;
    };
    return withRetry(exec, this.retry);
  }
}

export class SyntheticService {
  constructor(private readonly provider: SyntheticProvider) {}

  async runWithTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fn(controller.signal);
    } finally {
      clearTimeout(to);
    }
  }

  async code(input: SyntheticCodeRequest): Promise<SyntheticResponse> {
    return this.runWithTimeout((signal) => this.provider.code(input, signal), 30000);
  }

  async reasoning(input: SyntheticReasoningRequest): Promise<SyntheticResponse> {
    return this.runWithTimeout((signal) => this.provider.reasoning(input, signal), 30000);
  }
}
