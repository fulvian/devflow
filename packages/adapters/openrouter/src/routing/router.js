import { classifyTask } from '../models/task-classifier.js';
import { DEFAULT_MODELS } from '../models/model-config.js';
import { selectModel } from '../models/model-selector.js';
export function route(input) {
    const base = { description: input.description };
    if (input.title !== undefined)
        base.title = input.title;
    if (input.contextTokens !== undefined)
        base.contextTokens = input.contextTokens;
    const criteria = classifyTask(base);
    const modelList = input.models ?? DEFAULT_MODELS;
    const best = selectModel(criteria, modelList);
    return { criteria, model: best.model, reasons: best.reasons };
}
//# sourceMappingURL=router.js.map