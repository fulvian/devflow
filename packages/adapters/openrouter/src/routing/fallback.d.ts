export interface FallbackChain {
    readonly primary: string;
    readonly alternates: ReadonlyArray<string>;
}
export declare const DEFAULT_FALLBACKS: ReadonlyArray<FallbackChain>;
export declare function getFallbacks(model: string, chains?: ReadonlyArray<FallbackChain>): ReadonlyArray<string>;
//# sourceMappingURL=fallback.d.ts.map