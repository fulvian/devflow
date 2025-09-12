import { watchContextDir } from '../filesystem/watcher.js';
import type { ClaudeCodeAdapter } from '../adapter.js';

export function createContextHooks(adapter: ClaudeCodeAdapter, contextDir: string) {
  const stop = watchContextDir(contextDir, async (evt) => {
    if (evt.type === 'change' || evt.type === 'create') {
      if (!evt.sessionId || !evt.taskId) return; // requires ids in file hints
      await adapter.onToolUsed({ sessionId: evt.sessionId, taskId: evt.taskId, tool: 'fs-change' });
    }
  });
  return { stop };
}

