import { estimateCostUSD } from '../models/model-config.js';
export function chooseCheapest(candidates, expectedUsage) {
    const ranked = candidates
        .map((m) => ({ model: m, estimatedCostUsd: estimateCostUSD(m, expectedUsage) }))
        .sort((a, b) => a.estimatedCostUsd - b.estimatedCostUsd);
    if (ranked.length === 0)
        throw new Error('No candidates provided');
    return ranked[0];
}
//# sourceMappingURL=cost-optimizer.js.map