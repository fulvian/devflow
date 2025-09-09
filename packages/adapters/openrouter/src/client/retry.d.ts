export interface RetryOptions {
    readonly retries: number;
    readonly initialDelayMs: number;
    readonly maxDelayMs: number;
}
export declare function withRetries<T>(fn: () => Promise<T>, opts: RetryOptions, onRetry?: (info: {
    attempt: number;
    delayMs: number;
    error?: unknown;
    status?: number;
}) => void): Promise<T>;
//# sourceMappingURL=retry.d.ts.map