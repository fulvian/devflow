import { CostTracker } from './cost-tracker.js';
import { UsageTracker } from './usage-tracker.js';
import { PerformanceTracker } from '../routing/performance-tracker.js';
export class Reporter {
    cost;
    usage;
    perf;
    constructor(cost, usage, perf) {
        this.cost = cost;
        this.usage = usage;
        this.perf = perf;
    }
    generate(windowMs = 24 * 60 * 60 * 1000) {
        const totals = this.cost.summary(windowMs);
        const counts = this.usage.counts(windowMs);
        const perf = this.perf.getAverages(windowMs);
        const models = Object.keys(counts);
        const byModel = models.map((m) => {
            const base = {
                model: m,
                requests: counts[m],
            };
            if (perf[m]?.avgLatency !== undefined)
                base.avgLatencyMs = perf[m].avgLatency;
            if (perf[m]?.successRate !== undefined)
                base.successRate = perf[m].successRate;
            return base;
        });
        return {
            generatedAt: new Date().toISOString(),
            totals: { costUsd: totals.totalCostUsd, tokens: totals.totalTokens },
            byModel,
        };
    }
}
//# sourceMappingURL=reporter.js.map