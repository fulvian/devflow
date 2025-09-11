import type { ClaudeAdapter } from '../adapter.js';
export interface SessionEvent {
    on: (event: string, handler: (...args: any[]) => void | Promise<void>) => void;
}
export interface HookRegistrar {
    onSessionStart: (e: {
        sessionId: string;
        taskId?: string;
    }) => Promise<void>;
    onSessionEnd: (e: {
        sessionId: string;
        taskId: string;
    }) => Promise<void>;
    onToolUsed: (e: {
        sessionId: string;
        taskId: string;
        tool: string;
        payload?: unknown;
    }) => Promise<void>;
}
export declare function registerHooks(cc: SessionEvent, adapter: ClaudeAdapter): void;
//# sourceMappingURL=index.d.ts.map