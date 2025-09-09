import type { ModelSpec, ModelUsage } from '../models/model-config.js';
export interface CostDecision {
    readonly model: ModelSpec;
    readonly estimatedCostUsd: number;
}
export declare function chooseCheapest(candidates: ReadonlyArray<ModelSpec>, expectedUsage: ModelUsage): CostDecision;
//# sourceMappingURL=cost-optimizer.d.ts.map