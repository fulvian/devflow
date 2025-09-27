import { dirname, resolve } from 'path';
import { tryReadJSON, tryWriteJSON, safeMkdirSafe } from './safe-ops.js';
export class PersistentDebouncer {
    timers = new Map();
    journalPath;
    delayMs;
    constructor(opts) {
        this.delayMs = opts?.delayMs ?? 200;
        this.journalPath = resolve(opts?.journalPath ?? resolve(process.cwd(), '.devflow/claude-debouncer.json'));
        const dir = dirname(this.journalPath);
        safeMkdirSafe(dir);
    }
    load() {
        const loaded = tryReadJSON(this.journalPath);
        return loaded.ok && Array.isArray(loaded.value) ? loaded.value : [];
    }
    save(entries) {
        tryWriteJSON(this.journalPath, entries);
    }
    remove(key) {
        const entries = this.load().filter((e) => e.key !== key);
        this.save(entries);
    }
    run(key, data, fn) {
        const prev = this.timers.get(key);
        if (prev)
            clearTimeout(prev);
        // persist intent
        const now = Date.now();
        const dueAt = now + this.delayMs;
        const remaining = this.load().filter((e) => e.key !== key);
        remaining.push({ key, data, dueAt });
        this.save(remaining);
        const t = setTimeout(() => {
            this.timers.delete(key);
            try {
                fn(data);
            }
            finally {
                this.remove(key);
            }
        }, this.delayMs);
        this.timers.set(key, t);
    }
    // Reschedule previously pending tasks (e.g., after restart)
    resume(fn) {
        const entries = this.load();
        for (const e of entries) {
            const delay = Math.max(0, e.dueAt - Date.now());
            const prev = this.timers.get(e.key);
            if (prev)
                clearTimeout(prev);
            const t = setTimeout(() => {
                this.timers.delete(e.key);
                try {
                    fn(e.key, e.data);
                }
                finally {
                    this.remove(e.key);
                }
            }, delay);
            this.timers.set(e.key, t);
        }
    }
}
//# sourceMappingURL=persistent-debouncer.js.map