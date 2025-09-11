import type { ClaudeCodeAdapter } from '../adapter.js';
import { createSessionHooks } from './session-hooks.js';
import { createToolHooks } from './tool-hooks.js';

export interface SessionEvent {
  on: (event: string, handler: (...args: any[]) => void | Promise<void>) => void;
}

export interface HookRegistrar {
  onSessionStart: (e: { sessionId: string; taskId?: string }) => Promise<void>;
  onSessionEnd: (e: { sessionId: string; taskId: string }) => Promise<void>;
  onToolUsed: (e: { sessionId: string; taskId: string; tool: string; payload?: unknown }) => Promise<void>;
}

export function registerHooks(cc: SessionEvent, adapter: ClaudeCodeAdapter) {
  const session = createSessionHooks(adapter);
  const tools = createToolHooks(adapter);

  cc.on('session:start', (payload: any) => void session.onStart(payload));
  cc.on('session:end', (payload: any) => void session.onEnd(payload));
  cc.on('tool:used', (payload: any) => void tools.onToolUsed(payload));
}

