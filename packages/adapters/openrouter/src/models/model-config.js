export const DEFAULT_MODELS = [
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
export function estimateCostUSD(spec, usage) {
    const inputTokens = Number.isFinite(usage.inputTokens) && usage.inputTokens >= 0 ? usage.inputTokens : 0;
    const outputTokens = Number.isFinite(usage.outputTokens) && usage.outputTokens >= 0 ? usage.outputTokens : 0;
    const inputRate = Number.isFinite(spec.cost.inputPer1k) && spec.cost.inputPer1k >= 0 ? spec.cost.inputPer1k : 0;
    const outputRate = Number.isFinite(spec.cost.outputPer1k) && spec.cost.outputPer1k >= 0 ? spec.cost.outputPer1k : 0;
    const inputCost = (inputTokens / 1000) * inputRate;
    const outputCost = (outputTokens / 1000) * outputRate;
    const total = inputCost + outputCost;
    return Number((Number.isFinite(total) ? total : 0).toFixed(6));
}
export function findModelSpec(id, list = DEFAULT_MODELS) {
    return list.find((m) => m.id === id);
}
//# sourceMappingURL=model-config.js.map