import { dirname, resolve } from 'path';
import { tryReadJSON, tryWriteJSON, safeMkdirSafe } from './safe-ops.js';

export interface DebounceEntry<T> {
  readonly key: string;
  readonly data: T;
  readonly dueAt: number;
}

export class PersistentDebouncer<T = unknown> {
  private timers = new Map<string, NodeJS.Timeout>();
  private readonly journalPath: string;
  private readonly delayMs: number;

  constructor(opts?: { journalPath?: string; delayMs?: number }) {
    this.delayMs = opts?.delayMs ?? 200;
    this.journalPath = resolve(opts?.journalPath ?? resolve(process.cwd(), '.devflow/claude-debouncer.json'));
    const dir = dirname(this.journalPath);
    safeMkdirSafe(dir);
  }

  private load(): DebounceEntry<T>[] {
    const loaded = tryReadJSON<DebounceEntry<T>[]>(this.journalPath);
    return loaded.ok && Array.isArray(loaded.value) ? loaded.value : [];
  }

  private save(entries: DebounceEntry<T>[]): void {
    tryWriteJSON(this.journalPath, entries);
  }

  private remove(key: string): void {
    const entries = this.load().filter((e) => e.key !== key);
    this.save(entries);
  }

  run(key: string, data: T, fn: (data: T) => void): void {
    const prev = this.timers.get(key);
    if (prev) clearTimeout(prev);

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
      } finally {
        this.remove(key);
      }
    }, this.delayMs);
    this.timers.set(key, t);
  }

  // Reschedule previously pending tasks (e.g., after restart)
  resume(fn: (key: string, data: T) => void): void {
    const entries = this.load();
    for (const e of entries) {
      const delay = Math.max(0, e.dueAt - Date.now());
      const prev = this.timers.get(e.key);
      if (prev) clearTimeout(prev);
      const t = setTimeout(() => {
        this.timers.delete(e.key);
        try {
          fn(e.key, e.data);
        } finally {
          this.remove(e.key);
        }
      }, delay);
      this.timers.set(e.key, t);
    }
  }
}

