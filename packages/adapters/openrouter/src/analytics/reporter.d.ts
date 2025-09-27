import { CostTracker } from './cost-tracker.js';
import { UsageTracker } from './usage-tracker.js';
import { PerformanceTracker } from '../routing/performance-tracker.js';
export interface ReportSummary {
    readonly generatedAt: string;
    readonly totals: {
        readonly costUsd: number;
        readonly tokens: number;
    };
    readonly byModel: Array<{
        readonly model: string;
        readonly requests: number;
        readonly avgLatencyMs?: number;
        readonly successRate?: number;
    }>;
}
export declare class Reporter {
    private readonly cost;
    private readonly usage;
    private readonly perf;
    constructor(cost: CostTracker, usage: UsageTracker, perf: PerformanceTracker);
    generate(windowMs?: number): ReportSummary;
}
//# sourceMappingURL=reporter.d.ts.map