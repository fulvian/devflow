export interface RateLimiterOptions {
    readonly requestsPerMinute: number;
    readonly maxQueueSize?: number;
}
export declare class RateLimiter {
    private readonly intervalMs;
    private readonly maxQueueSize;
    private tokens;
    private lastRefill;
    private queue;
    constructor(opts: RateLimiterOptions);
    private refill;
    acquire(): Promise<void>;
}
//# sourceMappingURL=rate-limiter.d.ts.map