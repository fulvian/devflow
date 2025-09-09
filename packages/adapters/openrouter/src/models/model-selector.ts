import type { CapabilitiesScore } from './capabilities.js';
import { DEFAULT_CAPABILITY_PRIORS } from './capabilities.js';
import type { ModelSpec } from './model-config.js';

export interface ModelSelectionCriteria {
  readonly taskType: 'coding' | 'analysis' | 'creative' | 'reasoning';
  readonly complexity: 'low' | 'medium' | 'high';
  readonly costPriority: number; // 0-1 higher = cost sensitive
  readonly performancePriority: number; // 0-1 higher = speed
  readonly contextSize: number; // tokens
}

export interface SelectionResult {
  readonly model: ModelSpec;
  readonly score: number;
  readonly reasons: string[];
  readonly alternatives: ReadonlyArray<{ model: ModelSpec; score: number }>;
}

export function selectModel(
  criteria: ModelSelectionCriteria,
  models: ReadonlyArray<ModelSpec>,
  capabilityPriors: Record<string, CapabilitiesScore> = DEFAULT_CAPABILITY_PRIORS,
): SelectionResult {
  const reasons: string[] = [];
  const ranked = models
    .filter((m) => m.contextWindow >= criteria.contextSize)
    .map((m) => {
      const caps = capabilityPriors[m.id] ?? { coding: 0.7, analysis: 0.7, creative: 0.7, reasoning: 0.7 };
      const taskAlign = caps[criteria.taskType];
      const speed = m.speed === 'very_fast' ? 1 : m.speed === 'fast' ? 0.85 : m.speed === 'medium' ? 0.7 : 0.5;
      const cost = 1 / (m.cost.inputPer1k + 2 * m.cost.outputPer1k); // weight output higher
      // Normalize cost roughly into 0..1 range
      const costScore = Math.min(1, Math.max(0, (cost - 50) / 50));
      const perfScore = (criteria.performancePriority * speed + (1 - criteria.performancePriority) * taskAlign);
      const finalScore = 0.5 * perfScore + 0.5 * (criteria.costPriority * costScore + (1 - criteria.costPriority) * taskAlign);
      return { model: m, score: Number(finalScore.toFixed(4)) };
    })
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    const alt = [...models].sort((a, b) => b.contextWindow - a.contextWindow)[0];
    if (!alt) {
      throw new Error('No models available for selection');
    }
    return { model: alt, score: 0.5, reasons: ['fallback:context_window'], alternatives: [] };
  }

  const top = ranked[0]!;
  reasons.push('context_fit', 'capability_match', 'cost_performance_tradeoff');

  return { model: top.model, score: top.score, reasons, alternatives: ranked.slice(1, 3) };
}
