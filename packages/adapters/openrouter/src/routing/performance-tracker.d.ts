export interface PerformanceSample {
    readonly model: string;
    readonly latencyMs: number;
    readonly success: boolean;
    readonly timestamp: number;
}
export declare class PerformanceTracker {
    private readonly samples;
    record(sample: PerformanceSample): void;
    getAverages(windowMs?: number): Record<string, {
        avgLatency: number;
        successRate: number;
        count: number;
    }>;
}
//# sourceMappingURL=performance-tracker.d.ts.map