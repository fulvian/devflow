export const DEFAULT_FALLBACKS = [
    {
        primary: 'anthropic/claude-3-sonnet',
        alternates: ['openai/gpt-4o-mini', 'google/gemini-1.5-pro'],
    },
    {
        primary: 'openai/gpt-4o-mini',
        alternates: ['anthropic/claude-3-sonnet', 'google/gemini-1.5-pro'],
    },
];
export function getFallbacks(model, chains = DEFAULT_FALLBACKS) {
    const found = chains.find((c) => c.primary === model);
    return found?.alternates ?? [];
}
//# sourceMappingURL=fallback.js.map