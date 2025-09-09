export class RateLimiter {
    intervalMs;
    maxQueueSize;
    tokens;
    lastRefill;
    queue = [];
    constructor(opts) {
        this.intervalMs = 60_000 / Math.max(1, opts.requestsPerMinute);
        this.tokens = 1;
        this.lastRefill = Date.now();
        this.maxQueueSize = opts.maxQueueSize ?? 100;
    }
    refill() {
        const now = Date.now();
        const delta = now - this.lastRefill;
        if (delta >= this.intervalMs) {
            const tokensToAdd = Math.floor(delta / this.intervalMs);
            this.tokens = Math.min(this.tokens + tokensToAdd, 1);
            this.lastRefill = now;
        }
    }
    async acquire() {
        return new Promise((resolve, reject) => {
            const tryConsume = () => {
                this.refill();
                if (this.tokens >= 1) {
                    this.tokens -= 1;
                    resolve();
                }
                else {
                    setTimeout(tryConsume, Math.ceil(this.intervalMs / 2));
                }
            };
            if (this.queue.length >= this.maxQueueSize) {
                reject(new Error('RateLimiter queue overflow'));
                return;
            }
            this.queue.push(tryConsume);
            if (this.queue.length === 1) {
                tryConsume();
            }
        }).finally(() => {
            // Remove the resolved consumer from the queue
            void this.queue.shift();
        });
    }
}
//# sourceMappingURL=rate-limiter.js.map