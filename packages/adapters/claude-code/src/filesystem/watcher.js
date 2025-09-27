import { watch } from 'fs';
import { PersistentDebouncer } from './persistent-debouncer.js';
export function watchContextDir(dir, onEvent) {
    const debouncer = new PersistentDebouncer({ delayMs: 200 });
    // Resume any pending events on startup
    debouncer.resume((_key, data) => onEvent(data));
    const w = watch(dir, { recursive: true }, (eventType, filename) => {
        if (!filename)
            return;
        const key = `${eventType}:${filename}`;
        const evt = { type: eventType === 'rename' ? 'change' : 'change', file: filename };
        debouncer.run(key, evt, (payload) => onEvent(payload));
    });
    return () => w.close();
}
//# sourceMappingURL=watcher.js.map