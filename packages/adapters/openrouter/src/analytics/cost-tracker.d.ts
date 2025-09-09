import type { ModelSpec, ModelUsage } from '../models/model-config.js';
export interface CostRecord {
    readonly timestamp: number;
    readonly model: string;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly costUsd: number;
}
export declare class CostTracker {
    private readonly records;
    private budgetUsd;
    setBudget(limitUsd: number | undefined): void;
    add(model: ModelSpec, usage: ModelUsage): CostRecord;
    summary(rangeMs?: number): {
        totalCostUsd: number;
        totalTokens: number;
        inputTokens: number;
        outputTokens: number;
        overBudget: boolean;
    };
}
//# sourceMappingURL=cost-tracker.d.ts.map