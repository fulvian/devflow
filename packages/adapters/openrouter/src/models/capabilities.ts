export type TaskKind = 'coding' | 'analysis' | 'creative' | 'reasoning';

export interface CapabilitiesScore {
  readonly coding: number;
  readonly analysis: number;
  readonly creative: number;
  readonly reasoning: number;
}

export const DEFAULT_CAPABILITY_PRIORS: Record<string, CapabilitiesScore> = {
  'anthropic/claude-3-sonnet': { coding: 0.9, analysis: 0.95, creative: 0.7, reasoning: 0.95 },
  'openai/gpt-4o-mini': { coding: 0.85, analysis: 0.85, creative: 0.85, reasoning: 0.8 },
  'google/gemini-1.5-pro': { coding: 0.75, analysis: 0.9, creative: 0.7, reasoning: 0.9 },
};

