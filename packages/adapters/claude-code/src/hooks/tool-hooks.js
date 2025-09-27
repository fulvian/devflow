export function createToolHooks(adapter) {
    return {
        onToolUsed: async (payload) => {
            await adapter.onToolUsed(payload);
        }
    };
}
//# sourceMappingURL=tool-hooks.js.map