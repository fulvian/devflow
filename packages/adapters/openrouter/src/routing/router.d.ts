import type { SelectionCriteria } from '../models/task-classifier.js';
import type { ModelSpec } from '../models/model-config.js';
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
export declare function route(input: RouterInput): RouteDecision;
//# sourceMappingURL=router.d.ts.map