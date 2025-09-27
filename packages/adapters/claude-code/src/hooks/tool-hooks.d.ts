import type { ClaudeAdapter } from '../adapter.js';
export declare function createToolHooks(adapter: ClaudeAdapter): {
    onToolUsed: (payload: {
        sessionId: string;
        taskId: string;
        tool: string;
        payload?: unknown;
    }) => Promise<void>;
};
//# sourceMappingURL=tool-hooks.d.ts.map