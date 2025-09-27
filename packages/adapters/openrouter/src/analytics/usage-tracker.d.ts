export interface UsageRecord {
    readonly timestamp: number;
    readonly model: string;
}
export declare class UsageTracker {
    private readonly records;
    record(model: string): void;
    counts(windowMs?: number): Record<string, number>;
}
//# sourceMappingURL=usage-tracker.d.ts.map