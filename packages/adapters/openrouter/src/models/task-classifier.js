export function classifyTask(input) {
    const text = `${input.title ?? ''} ${input.description}`.toLowerCase();
    let taskType = 'analysis';
    if (/(code|implement|function|refactor|test|bug|fix)/.test(text))
        taskType = 'coding';
    else if (/(story|write|creative|idea|brainstorm)/.test(text))
        taskType = 'creative';
    else if (/(reason|prove|derive|plan|architecture)/.test(text))
        taskType = 'reasoning';
    let complexity = 'medium';
    const words = text.split(/\s+/).length;
    if (words < 50)
        complexity = 'low';
    else if (words > 400)
        complexity = 'high';
    const contextSize = input.contextTokens ?? Math.min(Math.max(words * 1.2, 256), 20_000);
    return {
        taskType,
        complexity,
        costPriority: 0.6,
        performancePriority: 0.6,
        contextSize: Math.floor(contextSize),
    };
}
//# sourceMappingURL=task-classifier.js.map