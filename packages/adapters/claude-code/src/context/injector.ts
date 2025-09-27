import { writeJSONSafe } from '../filesystem/safe-ops.js';

export async function injectToClaudeContext(contextDir: string, data: unknown): Promise<void> {
  writeJSONSafe(`${contextDir}/injected_context.json`, data);
}

