export type ModelFamily = 'claude' | 'gpt' | 'gemini' | 'mistral' | 'other';
export interface ModelCost {
    readonly inputPer1k: number;
    readonly outputPer1k: number;
}
export interface ModelSpec {
    readonly id: string;
    readonly family: ModelFamily;
    readonly displayName: string;
    readonly contextWindow: number;
    readonly capabilities: ReadonlyArray<string>;
    readonly cost: ModelCost;
    readonly speed: 'slow' | 'medium' | 'fast' | 'very_fast';
}
export declare const DEFAULT_MODELS: ReadonlyArray<ModelSpec>;
export interface ModelUsage {
    readonly model: string;
    readonly inputTokens: number;
    readonly outputTokens: number;
}
export declare function estimateCostUSD(spec: ModelSpec, usage: ModelUsage): number;
export declare function findModelSpec(id: string, list?: ReadonlyArray<ModelSpec>): ModelSpec | undefined;
//# sourceMappingURL=model-config.d.ts.map