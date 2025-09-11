import type { ClaudeAdapter } from '../adapter.js';
export declare function createSessionHooks(adapter: ClaudeAdapter): {
    onStart: (payload: {
        sessionId: string;
        taskId?: string;
    }) => Promise<void>;
    onEnd: (payload: {
        sessionId: string;
        taskId: string;
    }) => Promise<void>;
};
//# sourceMappingURL=session-hooks.d.ts.map