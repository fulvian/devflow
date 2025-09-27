import type { SelectionCriteria } from '../models/task-classifier.js';
import { classifyTask } from '../models/task-classifier.js';
import type { ModelSpec } from '../models/model-config.js';
import { DEFAULT_MODELS } from '../models/model-config.js';
import { selectModel } from '../models/model-selector.js';

export interface RouterInput {
  readonly title?: string;
  readonly description: string;
  readonly contextTokens?: number;
  readonly models?: ReadonlyArray<ModelSpec>;
}

export interface RouteDecision {
  readonly criteria: SelectionCriteria;
  readonly model: ModelSpec;
  readonly reasons: ReadonlyArray<string>;
}

export function route(input: RouterInput): RouteDecision {
  const base: { title?: string; description: string; contextTokens?: number } = { description: input.description };
  if (input.title !== undefined) base.title = input.title;
  if (input.contextTokens !== undefined) base.contextTokens = input.contextTokens;
  const criteria = classifyTask(base);
  const modelList = input.models ?? DEFAULT_MODELS;
  const best = selectModel(criteria, modelList);
  return { criteria, model: best.model, reasons: best.reasons };
}
