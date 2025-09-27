export type ModelFamily = 'claude' | 'gpt' | 'gemini' | 'mistral' | 'other';

export interface ModelCost {
  readonly inputPer1k: number; // USD per 1k input tokens
  readonly outputPer1k: number; // USD per 1k output tokens
}

export interface ModelSpec {
  readonly id: string; // openrouter model id
  readonly family: ModelFamily;
  readonly displayName: string;
  readonly contextWindow: number; // tokens
  readonly capabilities: ReadonlyArray<string>;
  readonly cost: ModelCost;
  readonly speed: 'slow' | 'medium' | 'fast' | 'very_fast';
}

export const DEFAULT_MODELS: ReadonlyArray<ModelSpec> = [
  {
    id: 'anthropic/claude-3-sonnet',
    family: 'claude',
    displayName: 'Claude 3 Sonnet',
    contextWindow: 200_000,
    capabilities: ['reasoning', 'coding', 'analysis'],
    cost: { inputPer1k: 0.003, outputPer1k: 0.015 },
    speed: 'fast',
  },
  {
    id: 'openai/gpt-4o-mini',
    family: 'gpt',
    displayName: 'GPT-4o mini',
    contextWindow: 128_000,
    capabilities: ['coding', 'analysis', 'creative'],
    cost: { inputPer1k: 0.00015, outputPer1k: 0.0006 },
    speed: 'very_fast',
  },
  {
    id: 'google/gemini-1.5-pro',
    family: 'gemini',
    displayName: 'Gemini 1.5 Pro',
    contextWindow: 1_000_000,
    capabilities: ['reasoning', 'analysis'],
    cost: { inputPer1k: 0.0035, outputPer1k: 0.0105 },
    speed: 'medium',
  },
];

export interface ModelUsage {
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export function estimateCostUSD(spec: ModelSpec, usage: ModelUsage): number {
  const inputTokens = Number.isFinite(usage.inputTokens) && usage.inputTokens >= 0 ? usage.inputTokens : 0;
  const outputTokens = Number.isFinite(usage.outputTokens) && usage.outputTokens >= 0 ? usage.outputTokens : 0;
  const inputRate = Number.isFinite(spec.cost.inputPer1k) && spec.cost.inputPer1k >= 0 ? spec.cost.inputPer1k : 0;
  const outputRate = Number.isFinite(spec.cost.outputPer1k) && spec.cost.outputPer1k >= 0 ? spec.cost.outputPer1k : 0;
  const inputCost = (inputTokens / 1000) * inputRate;
  const outputCost = (outputTokens / 1000) * outputRate;
  const total = inputCost + outputCost;
  return Number((Number.isFinite(total) ? total : 0).toFixed(6));
}

export function findModelSpec(id: string, list: ReadonlyArray<ModelSpec> = DEFAULT_MODELS): ModelSpec | undefined {
  return list.find((m) => m.id === id);
}
