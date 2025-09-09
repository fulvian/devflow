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

export class Reporter {
  constructor(
    private readonly cost: CostTracker,
    private readonly usage: UsageTracker,
    private readonly perf: PerformanceTracker,
  ) {}

  generate(windowMs = 24 * 60 * 60 * 1000): ReportSummary {
    const totals = this.cost.summary(windowMs);
    const counts = this.usage.counts(windowMs);
    const perf = this.perf.getAverages(windowMs);
    const models = Object.keys(counts);
    const byModel = models.map((m) => {
      const base: { model: string; requests: number; avgLatencyMs?: number; successRate?: number } = {
        model: m,
        requests: counts[m] as number,
      };
      if (perf[m]?.avgLatency !== undefined) base.avgLatencyMs = perf[m]!.avgLatency;
      if (perf[m]?.successRate !== undefined) base.successRate = perf[m]!.successRate;
      return base;
    });
    return {
      generatedAt: new Date().toISOString(),
      totals: { costUsd: totals.totalCostUsd, tokens: totals.totalTokens },
      byModel,
    };
  }
}
