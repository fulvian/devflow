export interface DebounceEntry<T> {
    readonly key: string;
    readonly data: T;
    readonly dueAt: number;
}
export declare class PersistentDebouncer<T = unknown> {
    private timers;
    private readonly journalPath;
    private readonly delayMs;
    constructor(opts?: {
        journalPath?: string;
        delayMs?: number;
    });
    private load;
    private save;
    private remove;
    run(key: string, data: T, fn: (data: T) => void): void;
    resume(fn: (key: string, data: T) => void): void;
}
//# sourceMappingURL=persistent-debouncer.d.ts.map