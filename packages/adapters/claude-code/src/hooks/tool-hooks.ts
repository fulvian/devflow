import type { ClaudeAdapter } from '../adapter.js';

export function createToolHooks(adapter: ClaudeAdapter) {
  return {
    onToolUsed: async (payload: { sessionId: string; taskId: string; tool: string; payload?: unknown }) => {
      await adapter.onToolUsed(payload);
    }
  };
}

