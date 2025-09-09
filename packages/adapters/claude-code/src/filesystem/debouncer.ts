export class Debouncer {
  private timers = new Map<string, NodeJS.Timeout>();
  constructor(private delayMs: number = 200) {}
  run(key: string, fn: () => void) {
    const prev = this.timers.get(key);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => {
      this.timers.delete(key);
      fn();
    }, this.delayMs);
    this.timers.set(key, t);
  }
}

