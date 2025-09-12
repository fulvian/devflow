/**
 * Rate Limiter Utility for API Request Management
 * 
 * This utility provides a flexible rate limiting mechanism that can be used
 * to control the rate of API requests to comply with service limits.
 */

interface RateLimitConfig {
  /** Maximum number of requests allowed in the time window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Optional identifier for this rate limiter instance */
  identifier?: string;
}

interface QueuedRequest {
  resolve: (value: boolean) => void;
  reject: (reason?: any) => void;
  timestamp: number;
}

class RateLimiter {
  private readonly config: RateLimitConfig;
  private readonly requestQueue: QueuedRequest[] = [];
  private requestHistory: number[] = [];
  private processing: boolean = false;

  /**
   * Creates a new RateLimiter instance
   * @param config Configuration for the rate limiter
   */
  constructor(config: RateLimitConfig) {
    this.config = {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      identifier: config.identifier || 'default'
    };
    
    // Validate configuration
    if (this.config.maxRequests <= 0) {
      throw new Error('maxRequests must be greater than 0');
    }
    
    if (this.config.windowMs <= 0) {
      throw new Error('windowMs must be greater than 0');
    }
  }

  /**
   * Attempts to acquire a token for making a request
   * Returns a promise that resolves when the request can be made
   * 
   * @returns Promise that resolves to true when request can proceed
   */
  async acquire(): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      const now = Date.now();
      
      // Clean up old requests outside the window
      this.cleanupHistory(now);
      
      // If we're under the limit, allow the request immediately
      if (this.requestHistory.length < this.config.maxRequests) {
        this.requestHistory.push(now);
        resolve(true);
        return;
      }
      
      // Otherwise, queue the request
      this.requestQueue.push({
        resolve,
        reject,
        timestamp: now
      });
      
      // Start processing if not already
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Gets the current number of available tokens
   */
  getAvailableTokens(): number {
    this.cleanupHistory(Date.now());
    return Math.max(0, this.config.maxRequests - this.requestHistory.length);
  }

  /**
   * Gets the current queue length
   */
  getQueueLength(): number {
    return this.requestQueue.length;
  }

  /**
   * Clears the rate limiter history and queue
   */
  reset(): void {
    this.requestHistory = [];
    // Reject all queued requests
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        request.reject(new Error('Rate limiter reset'));
      }
    }
    this.processing = false;
  }

  /**
   * Removes requests that are outside the time window
   * @param now Current timestamp
   */
  private cleanupHistory(now: number): void {
    const windowStart = now - this.config.windowMs;
    this.requestHistory = this.requestHistory.filter(timestamp => timestamp > windowStart);
  }

  /**
   * Processes the request queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      while (this.requestQueue.length > 0) {
        const now = Date.now();
        
        // Clean up old requests
        this.cleanupHistory(now);
        
        // If we have available capacity, process the next request
        if (this.requestHistory.length < this.config.maxRequests) {
          const request = this.requestQueue.shift();
          if (request) {
            this.requestHistory.push(now);
            request.resolve(true);
          }
        } else {
          // Calculate time until next token is available
          const oldestRequest = this.requestHistory[0];
          const nextAvailableTime = oldestRequest + this.config.windowMs;
          const delay = Math.max(0, nextAvailableTime - now);
          
          // Wait until a token becomes available
          if (delay > 0) {
            await this.sleep(delay);
          }
        }
      }
    } catch (error) {
      // Handle any unexpected errors by rejecting remaining requests
      while (this.requestQueue.length > 0) {
        const request = this.requestQueue.shift();
        if (request) {
          request.reject(error);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Utility function to create a promise that resolves after a delay
   * @param ms Delay in milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create a rate limiter
 * @param config Rate limiter configuration
 * @returns New RateLimiter instance
 */
function createRateLimiter(config: RateLimitConfig): RateLimiter {
  return new RateLimiter(config);
}

export { RateLimiter, createRateLimiter, RateLimitConfig };
export default RateLimiter;