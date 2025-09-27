import { describe, it, expect } from 'vitest';
import { CostTracker } from '../analytics/cost-tracker.js';
import { DEFAULT_MODELS } from '../models/model-config.js';
describe('cost tracker', () => {
    it('accumulates costs and tokens', () => {
        const tracker = new CostTracker();
        const model = DEFAULT_MODELS[0];
        if (!model)
            throw new Error('No default models');
        tracker.add(model, { model: model.id, inputTokens: 1000, outputTokens: 500 });
        const sum = tracker.summary(10_000);
        expect(sum.totalTokens).toBe(1500);
        expect(sum.totalCostUsd).toBeGreaterThan(0);
    });
    it('guards against NaN/invalid values', () => {
        const tracker = new CostTracker();
        const model = DEFAULT_MODELS[0];
        const rec = tracker.add(model, { model: model.id, inputTokens: Number.NaN, outputTokens: -5 });
        expect(Number.isFinite(rec.costUsd)).toBe(true);
        const sum = tracker.summary(10_000);
        expect(Number.isFinite(sum.totalCostUsd)).toBe(true);
    });
});
//# sourceMappingURL=cost-tracker.test.js.map