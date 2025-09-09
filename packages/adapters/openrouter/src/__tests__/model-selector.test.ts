import { describe, it, expect } from 'vitest';
import { DEFAULT_MODELS } from '../models/model-config.js';
import { selectModel } from '../models/model-selector.js';

describe('model selector', () => {
  it('selects a model that fits context', () => {
    const criteria = {
      taskType: 'coding' as const,
      complexity: 'medium' as const,
      costPriority: 0.5,
      performancePriority: 0.5,
      contextSize: 1000,
    };
    const res = selectModel(criteria, DEFAULT_MODELS);
    expect(res.model.contextWindow).toBeGreaterThanOrEqual(1000);
    expect(res.score).toBeGreaterThan(0);
  });
});

