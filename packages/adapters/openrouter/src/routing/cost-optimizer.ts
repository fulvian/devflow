import type { ModelSpec, ModelUsage } from '../models/model-config.js';
import { estimateCostUSD } from '../models/model-config.js';

export interface CostDecision {
  readonly model: ModelSpec;
  readonly estimatedCostUsd: number;
}

export function chooseCheapest(
  candidates: ReadonlyArray<ModelSpec>,
  expectedUsage: ModelUsage,
): CostDecision {
  const ranked = candidates
    .map((m) => ({ model: m, estimatedCostUsd: estimateCostUSD(m, expectedUsage) }))
    .sort((a, b) => a.estimatedCostUsd - b.estimatedCostUsd);
  if (ranked.length === 0) throw new Error('No candidates provided');
  return ranked[0]!;
}
