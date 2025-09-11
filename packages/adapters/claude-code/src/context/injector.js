import { writeJSONSafe } from '../filesystem/safe-ops.js';
export async function injectToClaudeContext(contextDir, data) {
    writeJSONSafe(`${contextDir}/injected_context.json`, data);
}
//# sourceMappingURL=injector.js.map