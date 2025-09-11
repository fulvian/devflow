import type { ClaudeAdapter } from '../adapter.js';

export function createSessionHooks(adapter: ClaudeAdapter) {
  return {
    onStart: async (payload: { sessionId: string; taskId?: string }) => {
      await adapter.onSessionStart({ sessionId: payload.sessionId, taskId: payload.taskId || 'unknown' });
    },
    onEnd: async (payload: { sessionId: string; taskId: string }) => {
      await adapter.onSessionEnd(payload);
    },
  };
}

