export interface SyntheticModelSpec {
    readonly id: string;
    readonly provider: 'synthetic';
    readonly displayName: string;
    readonly contextLimit: number;
    readonly capabilities: ReadonlyArray<string>;
    readonly specialty: 'code' | 'reasoning' | 'context' | 'general';
    readonly costPerMonth: number;
}
export declare const SYNTHETIC_MODELS: ReadonlyArray<SyntheticModelSpec>;
export declare const DEFAULT_SYNTHETIC_MODELS: {
    code: string;
    reasoning: string;
    context: string;
    general: string;
};
export declare function findSyntheticModel(modelId: string): SyntheticModelSpec | undefined;
export declare function getModelsBySpecialty(specialty: SyntheticModelSpec['specialty']): ReadonlyArray<SyntheticModelSpec>;
//# sourceMappingURL=model-config.d.ts.map