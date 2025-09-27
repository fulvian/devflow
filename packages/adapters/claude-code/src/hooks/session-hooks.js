export function createSessionHooks(adapter) {
    return {
        onStart: async (payload) => {
            await adapter.onSessionStart({ sessionId: payload.sessionId, taskId: payload.taskId || 'unknown' });
        },
        onEnd: async (payload) => {
            await adapter.onSessionEnd(payload);
        },
    };
}
//# sourceMappingURL=session-hooks.js.map