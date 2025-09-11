export class Debouncer {
    delayMs;
    timers = new Map();
    constructor(delayMs = 200) {
        this.delayMs = delayMs;
    }
    run(key, fn) {
        const prev = this.timers.get(key);
        if (prev)
            clearTimeout(prev);
        const t = setTimeout(() => {
            this.timers.delete(key);
            fn();
        }, this.delayMs);
        this.timers.set(key, t);
    }
}
//# sourceMappingURL=debouncer.js.map