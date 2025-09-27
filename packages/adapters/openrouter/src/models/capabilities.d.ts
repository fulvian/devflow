export type TaskKind = 'coding' | 'analysis' | 'creative' | 'reasoning';
export interface CapabilitiesScore {
    readonly coding: number;
    readonly analysis: number;
    readonly creative: number;
    readonly reasoning: number;
}
export declare const DEFAULT_CAPABILITY_PRIORS: Record<string, CapabilitiesScore>;
//# sourceMappingURL=capabilities.d.ts.map