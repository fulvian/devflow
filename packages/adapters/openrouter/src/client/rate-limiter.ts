export interface RateLimiterOptions {
  readonly requestsPerMinute: number;
  readonly maxQueueSize?: number;
}

export class RateLimiter {
  private readonly intervalMs: number;
  private readonly maxQueueSize: number;
  private tokens: number;
  private lastRefill: number;
  private queue: Array<() => void> = [];

  constructor(opts: RateLimiterOptions) {
    this.intervalMs = 60_000 / Math.max(1, opts.requestsPerMinute);
    this.tokens = 1;
    this.lastRefill = Date.now();
    this.maxQueueSize = opts.maxQueueSize ?? 100;
  }

  private refill(): void {
    const now = Date.now();
    const delta = now - this.lastRefill;
    if (delta >= this.intervalMs) {
      const tokensToAdd = Math.floor(delta / this.intervalMs);
      this.tokens = Math.min(this.tokens + tokensToAdd, 1);
      this.lastRefill = now;
    }
  }

  async acquire(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const tryConsume = (): void => {
        this.refill();
        if (this.tokens >= 1) {
          this.tokens -= 1;
          resolve();
        } else {
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
