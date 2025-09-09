import type { TaskKind } from './capabilities.js';
export interface SelectionCriteria {
    readonly taskType: TaskKind;
    readonly complexity: 'low' | 'medium' | 'high';
    readonly costPriority: number;
    readonly performancePriority: number;
    readonly contextSize: number;
}
export declare function classifyTask(input: {
    title?: string;
    description: string;
    contextTokens?: number;
}): SelectionCriteria;
//# sourceMappingURL=task-classifier.d.ts.map