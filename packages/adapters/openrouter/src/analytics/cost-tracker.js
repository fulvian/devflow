import { estimateCostUSD } from '../models/model-config.js';
export class CostTracker {
    records = [];
    budgetUsd;
    setBudget(limitUsd) {
        this.budgetUsd = limitUsd;
    }
    add(model, usage) {
        const costUsd = estimateCostUSD(model, usage);
        const rec = {
            timestamp: Date.now(),
            model: model.id,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            costUsd,
        };
        this.records.push(rec);
        return rec;
    }
    summary(rangeMs = 24 * 60 * 60 * 1000) {
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
//# sourceMappingURL=cost-tracker.js.map