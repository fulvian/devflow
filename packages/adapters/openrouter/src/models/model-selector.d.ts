import type { CapabilitiesScore } from './capabilities.js';
import type { ModelSpec } from './model-config.js';
export interface ModelSelectionCriteria {
    readonly taskType: 'coding' | 'analysis' | 'creative' | 'reasoning';
    readonly complexity: 'low' | 'medium' | 'high';
    readonly costPriority: number;
    readonly performancePriority: number;
    readonly contextSize: number;
}
export interface SelectionResult {
    readonly model: ModelSpec;
    readonly score: number;
    readonly reasons: string[];
    readonly alternatives: ReadonlyArray<{
        model: ModelSpec;
        score: number;
    }>;
}
export declare function selectModel(criteria: ModelSelectionCriteria, models: ReadonlyArray<ModelSpec>, capabilityPriors?: Record<string, CapabilitiesScore>): SelectionResult;
//# sourceMappingURL=model-selector.d.ts.map