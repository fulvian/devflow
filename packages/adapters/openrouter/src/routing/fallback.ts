export interface FallbackChain {
  readonly primary: string;
  readonly alternates: ReadonlyArray<string>;
}

export const DEFAULT_FALLBACKS: ReadonlyArray<FallbackChain> = [
  {
    primary: 'anthropic/claude-3-sonnet',
    alternates: ['openai/gpt-4o-mini', 'google/gemini-1.5-pro'],
  },
  {
    primary: 'openai/gpt-4o-mini',
    alternates: ['anthropic/claude-3-sonnet', 'google/gemini-1.5-pro'],
  },
];

export function getFallbacks(model: string, chains: ReadonlyArray<FallbackChain> = DEFAULT_FALLBACKS): ReadonlyArray<string> {
  const found = chains.find((c) => c.primary === model);
  return found?.alternates ?? [];
}

