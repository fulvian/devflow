import { createSessionHooks } from './session-hooks.js';
import { createToolHooks } from './tool-hooks.js';
export function registerHooks(cc, adapter) {
    const session = createSessionHooks(adapter);
    const tools = createToolHooks(adapter);
    cc.on('session:start', (payload) => void session.onStart(payload));
    cc.on('session:end', (payload) => void session.onEnd(payload));
    cc.on('tool:used', (payload) => void tools.onToolUsed(payload));
}
//# sourceMappingURL=index.js.map