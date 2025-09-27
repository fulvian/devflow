import type { ClaudeCodeAdapter } from '../adapter.js';

export function createSessionHooks(adapter: ClaudeCodeAdapter) {
  return {
    onStart: async (payload: { sessionId: string; taskId?: string }) => {
      await adapter.onSessionStart({ sessionId: payload.sessionId, taskId: payload.taskId || 'unknown' } as any);
    },
    onEnd: async (payload: { sessionId: string; taskId: string }) => {
      await adapter.onSessionEnd(payload as any);
    },
  };
}

