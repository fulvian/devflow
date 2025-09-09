import type { ModelSpec, ModelUsage } from '../models/model-config.js';
import { estimateCostUSD } from '../models/model-config.js';

export interface CostRecord {
  readonly timestamp: number;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
}

export class CostTracker {
  private readonly records: CostRecord[] = [];
  private budgetUsd: number | undefined;

  setBudget(limitUsd: number | undefined): void {
    this.budgetUsd = limitUsd;
  }

  add(model: ModelSpec, usage: ModelUsage): CostRecord {
    const costUsd = estimateCostUSD(model, usage);
    const rec: CostRecord = {
      timestamp: Date.now(),
      model: model.id,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd,
    };
    this.records.push(rec);
    return rec;
  }

  summary(rangeMs = 24 * 60 * 60 * 1000): { totalCostUsd: number; totalTokens: number; inputTokens: number; outputTokens: number; overBudget: boolean } {
    const now = Date.now();
    const recent = this.records.filter((r) => now - r.timestamp <= rangeMs);
    const inputTokens = recent.reduce((a, b) => a + b.inputTokens, 0);
    const outputTokens = recent.reduce((a, b) => a + b.outputTokens, 0);
    const totalTokens = inputTokens + outputTokens;
    const totalCostUsd = Number(recent.reduce((a, b) => a + b.costUsd, 0).toFixed(6));
    const overBudget = this.budgetUsd !== undefined ? totalCostUsd > this.budgetUsd : false;
    return { totalCostUsd, totalTokens, inputTokens, outputTokens, overBudget };
  }
}

