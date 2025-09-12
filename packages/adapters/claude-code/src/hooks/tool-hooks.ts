import type { ClaudeCodeAdapter } from '../adapter.js';

export function createToolHooks(adapter: ClaudeCodeAdapter) {
  return {
    onToolUsed: async (payload: { sessionId: string; taskId: string; tool: string; payload?: unknown }) => {
      await adapter.onToolUsed(payload as any);
    }
  };
}

