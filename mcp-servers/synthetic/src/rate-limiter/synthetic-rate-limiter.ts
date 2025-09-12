/**
 * Synthetic Rate Limiter for MCP Synthetic API
 * 
 * Implements rate limiting to respect the 135 calls per 5-hour window limit
 * with intelligent batching, queue management, and retry logic.
 * 
 * Rate Limit Details:
 * - 135 API calls per 5-hour window (18,000 seconds)
 * - Average rate: 27 calls/hour or 0.0075 calls/second
 * - Window reset: Every 5 hours (18,000 seconds)
 */

interface RateLimitConfig {
  maxCalls: number;        // Maximum calls per window (135)
  windowSeconds: number;   // Window duration in seconds (18,000 = 5 hours)
  batchSize: number;       // Maximum operations per batch call
  maxRetries: number;      // Maximum retry attempts
  baseDelayMs: number;     // Base delay for exponential backoff
  maxDelayMs: number;      // Maximum delay between retries
}

interface QueuedRequest<T = any> {
  id: string;
  priority: number;        // Higher number = higher priority
  operation: string;       // Operation type for batching
  payload: T;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  attempt: number;
  createdAt: number;
}

interface RateLimitStatus {
  remainingCalls: number;
  totalCalls: number;
  windowResetTime: number;
  isRateLimited: boolean;
  queueSize: number;
}

export class SyntheticRateLimiter {
  private config: RateLimitConfig;
  private callHistory: number[] = []; // Timestamps of API calls
  private requestQueue: QueuedRequest[] = [];
  private isProcessingQueue: boolean = false;
  private batchedOperations: Map<string, QueuedRequest[]> = new Map();

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      maxCalls: 135,
      windowSeconds: 18000, // 5 hours
      batchSize: 10,
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      ...config
    };
  }

  /**
   * Execute an API operation with rate limiting
   */
  async execute<T, R>(
    operation: string,
    payload: T,
    priority: number = 0
  ): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      const request: QueuedRequest<T> = {
        id: this.generateId(),
        priority,
        operation,
        payload,
        resolve,
        reject,
        attempt: 0,
        createdAt: Date.now()
      };

      this.requestQueue.push(request);
      this.sortQueueByPriority();
      this.processQueue();
    });
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): RateLimitStatus {
    const windowStart = Date.now() - (this.config.windowSeconds * 1000);
    const callsInWindow = this.callHistory.filter(
      timestamp => timestamp > windowStart
    ).length;

    const remainingCalls = Math.max(0, this.config.maxCalls - callsInWindow);
    const windowResetTime = this.getWindowResetTime();

    return {
      remainingCalls,
      totalCalls: callsInWindow,
      windowResetTime,
      isRateLimited: remainingCalls === 0,
      queueSize: this.requestQueue.length
    };
  }

  /**
   * Clear the request queue (useful for testing or emergency stops)
   */
  clearQueue(): void {
    this.requestQueue = [];
    this.batchedOperations.clear();
  }

  /**
   * Process the request queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      // Check if we're rate limited
      const status = this.getRateLimitStatus();
      if (status.remainingCalls === 0) {
        // Wait until window resets
        const waitTime = status.windowResetTime - Date.now();
        if (waitTime > 0) {
          console.warn(`[Synthetic Rate Limiter] Rate limited. Waiting ${Math.round(waitTime/1000)}s until reset.`);
          await this.sleep(waitTime);
        }
      }

      // Batch operations
      this.batchOperations();

      // Process batches
      for (const [operation, requests] of this.batchedOperations.entries()) {
        if (requests.length === 0) continue;

        // Check if we have available calls
        const status = this.getRateLimitStatus();
        if (status.remainingCalls === 0) {
          break;
        }

        try {
          // Record API call
          this.recordApiCall();
          
          console.log(`[Synthetic Rate Limiter] Processing batch: ${operation} (${requests.length} requests)`);
          
          // Process batch - delegate to actual API implementation
          const results = await this.processBatch(operation, requests);
          
          // Resolve individual requests
          requests.forEach((request, index) => {
            request.resolve(results[index]);
          });
          
          // Remove processed requests from queue
          this.removeProcessedRequests(requests.map(r => r.id));
          
        } catch (error) {
          // Handle retry logic
          await this.handleBatchError(operation, requests, error);
        }
      }
    } finally {
      this.isProcessingQueue = false;
      
      // Continue processing if queue still has items
      if (this.requestQueue.length > 0) {
        setImmediate(() => this.processQueue());
      }
    }
  }

  /**
   * Group queued requests into batches by operation type
   */
  private batchOperations(): void {
    this.batchedOperations.clear();

    // Group requests by operation type
    for (const request of this.requestQueue) {
      if (!this.batchedOperations.has(request.operation)) {
        this.batchedOperations.set(request.operation, []);
      }
      
      const batch = this.batchedOperations.get(request.operation)!;
      if (batch.length < this.config.batchSize) {
        batch.push(request);
      }
    }
  }

  /**
   * Process a batch of requests - to be implemented by specific API handlers
   */
  private async processBatch<T, R>(
    operation: string,
    requests: QueuedRequest<T>[]
  ): Promise<R[]> {
    // This will be overridden or delegated to actual API implementation
    throw new Error(`Batch processing not implemented for operation: ${operation}`);
  }

  /**
   * Set batch processor for specific operations
   */
  setBatchProcessor<T, R>(
    operation: string,
    processor: (requests: QueuedRequest<T>[]) => Promise<R[]>
  ): void {
    // Store processor function - simple implementation
    (this as any)[`_processor_${operation}`] = processor;
  }

  /**
   * Process batch with registered processor
   */
  private async processBatchWithProcessor<T, R>(
    operation: string,
    requests: QueuedRequest<T>[]
  ): Promise<R[]> {
    const processor = (this as any)[`_processor_${operation}`];
    if (processor) {
      return await processor(requests);
    }
    
    // Fallback: process requests individually
    const results: R[] = [];
    for (const request of requests) {
      // This is where individual API calls would be made
      // For now, return success placeholder
      results.push({ success: true, payload: request.payload } as unknown as R);
    }
    return results;
  }

  /**
   * Handle errors during batch processing with retry logic
   */
  private async handleBatchError<T>(
    operation: string,
    requests: QueuedRequest<T>[],
    error: any
  ): Promise<void> {
    console.error(`[Synthetic Rate Limiter] Batch error for ${operation}:`, error.message);
    
    // Check if we should retry
    const shouldRetry = requests.some(req => req.attempt < this.config.maxRetries);
    
    if (shouldRetry) {
      // Increment attempt count
      requests.forEach(req => req.attempt++);
      
      // Calculate delay with exponential backoff
      const maxAttempt = Math.max(...requests.map(r => r.attempt));
      const delay = this.calculateExponentialBackoff(maxAttempt);
      
      console.log(`[Synthetic Rate Limiter] Retrying ${operation} in ${delay}ms (attempt ${maxAttempt})`);
      
      // Wait before retry
      await this.sleep(delay);
      
      // Re-queue failed requests
      // They will be picked up in the next processing cycle
    } else {
      // Reject all requests in the batch
      requests.forEach(request => {
        request.reject(new Error(
          `Max retries exceeded for operation ${operation}: ${error.message}`
        ));
      });
      
      // Remove from queue
      this.removeProcessedRequests(requests.map(r => r.id));
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateExponentialBackoff(attempt: number): number {
    const delay = this.config.baseDelayMs * Math.pow(2, attempt - 1);
    return Math.min(delay, this.config.maxDelayMs);
  }

  /**
   * Record an API call in the history
   */
  private recordApiCall(): void {
    const now = Date.now();
    this.callHistory.push(now);
    
    // Clean up old entries outside the window
    const windowStart = now - (this.config.windowSeconds * 1000);
    this.callHistory = this.callHistory.filter(
      timestamp => timestamp > windowStart
    );

    const status = this.getRateLimitStatus();
    console.log(`[Synthetic Rate Limiter] API call recorded. Remaining: ${status.remainingCalls}/${this.config.maxCalls}`);
  }

  /**
   * Get timestamp when current window resets
   */
  private getWindowResetTime(): number {
    if (this.callHistory.length === 0) {
      return Date.now() + (this.config.windowSeconds * 1000);
    }
    
    const oldestCall = Math.min(...this.callHistory);
    return oldestCall + (this.config.windowSeconds * 1000);
  }

  /**
   * Remove processed requests from the queue
   */
  private removeProcessedRequests(ids: string[]): void {
    this.requestQueue = this.requestQueue.filter(
      request => !ids.includes(request.id)
    );
  }

  /**
   * Sort queue by priority (highest first)
   */
  private sortQueueByPriority(): void {
    this.requestQueue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Generate unique request ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export { RateLimitConfig, RateLimitStatus, QueuedRequest };