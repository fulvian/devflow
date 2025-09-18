import { EventEmitter } from 'events';

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number;
}

interface CircuitBreaker {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
  threshold: number;
  timeout: number;
}

export class EnhancedResourceManager extends EventEmitter {
  private tokenBuckets: Map<string, TokenBucket> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private priorityQueues: Map<TaskPriority, any[]> = new Map();
  private historicalData: Map<string, number[]> = new Map();
  
  constructor() {
    super();
    Object.values(TaskPriority).forEach(priority => {
      this.priorityQueues.set(priority, []);
    });
  }

  // Token Bucket Rate Limiting
  initializeTokenBucket(key: string, capacity: number, refillRate: number): void {
    this.tokenBuckets.set(key, {
      tokens: capacity,
      lastRefill: Date.now(),
      capacity,
      refillRate
    });
  }

  consumeTokens(key: string, tokens: number): boolean {
    const bucket = this.tokenBuckets.get(key);
    if (!bucket) return false;

    this.refillBucket(bucket);
    
    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return true;
    }
    
    return false;
  }

  private refillBucket(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000; // seconds
    const tokensToAdd = Math.floor(elapsed * bucket.refillRate);
    
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }
  }

  // Priority Queuing
  enqueueTask(task: any, priority: TaskPriority): void {
    const queue = this.priorityQueues.get(priority);
    if (queue) {
      queue.push(task);
      this.emit('task-enqueued', { task, priority });
    }
  }

  dequeueTask(): any | null {
    // Process HIGH priority first, then MEDIUM, then LOW
    for (const priority of [TaskPriority.HIGH, TaskPriority.MEDIUM, TaskPriority.LOW]) {
      const queue = this.priorityQueues.get(priority);
      if (queue && queue.length > 0) {
        const task = queue.shift();
        this.emit('task-dequeued', { task, priority });
        return task;
      }
    }
    return null;
  }

  getQueueLength(priority: TaskPriority): number {
    return this.priorityQueues.get(priority)?.length || 0;
  }

  // Circuit Breaker
  initializeCircuitBreaker(key: string, threshold: number = 5, timeout: number = 60000): void {
    this.circuitBreakers.set(key, {
      failures: 0,
      lastFailure: 0,
      state: 'closed',
      threshold,
      timeout
    });
  }

  canExecute(key: string): boolean {
    const breaker = this.circuitBreakers.get(key);
    if (!breaker) return true;

    switch (breaker.state) {
      case 'closed':
        return true;
      case 'open':
        if (Date.now() - breaker.lastFailure > breaker.timeout) {
          breaker.state = 'half-open';
          return true;
        }
        return false;
      case 'half-open':
        return true;
      default:
        return true;
    }
  }

  recordSuccess(key: string): void {
    const breaker = this.circuitBreakers.get(key);
    if (breaker) {
      breaker.failures = 0;
      if (breaker.state === 'half-open') {
        breaker.state = 'closed';
      }
    }
  }

  recordFailure(key: string): void {
    const breaker = this.circuitBreakers.get(key);
    if (!breaker) return;

    breaker.failures++;
    breaker.lastFailure = Date.now();
    
    if (breaker.failures >= breaker.threshold) {
      breaker.state = 'open';
      this.emit('circuit-opened', key);
    }
  }

  // Predictive Load Management
  recordExecutionTime(key: string, duration: number): void {
    if (!this.historicalData.has(key)) {
      this.historicalData.set(key, []);
    }
    
    const data = this.historicalData.get(key)!;
    data.push(duration);
    
    // Keep only last 100 data points
    if (data.length > 100) {
      data.shift();
    }
  }

  predictLoad(key: string): number {
    const data = this.historicalData.get(key);
    if (!data || data.length === 0) return 0;
    
    // Simple average prediction
    const sum = data.reduce((a, b) => a + b, 0);
    return sum / data.length;
  }

  // Synthetic Rate Limiter Extension
  adjustRateLimit(key: string, adjustment: number): void {
    const bucket = this.tokenBuckets.get(key);
    if (bucket) {
      bucket.refillRate = Math.max(0.1, bucket.refillRate + adjustment);
      this.emit('rate-limit-adjusted', { key, newRate: bucket.refillRate });
    }
  }

  // Adaptive Thresholds
  updateCircuitThreshold(key: string, newThreshold: number): void {
    const breaker = this.circuitBreakers.get(key);
    if (breaker) {
      breaker.threshold = newThreshold;
    }
  }

  getCircuitState(key: string): string {
    const breaker = this.circuitBreakers.get(key);
    return breaker ? breaker.state : 'unknown';
  }

  getSystemMetrics(): any {
    const metrics: any = {};
    
    // Queue metrics
    metrics.queues = {};
    for (const [priority, queue] of this.priorityQueues.entries()) {
      metrics.queues[priority] = queue.length;
    }
    
    // Token bucket metrics
    metrics.rateLimits = {};
    for (const [key, bucket] of this.tokenBuckets.entries()) {
      metrics.rateLimits[key] = {
        tokens: bucket.tokens,
        capacity: bucket.capacity,
        refillRate: bucket.refillRate
      };
    }
    
    // Circuit breaker metrics
    metrics.circuits = {};
    for (const [key, breaker] of this.circuitBreakers.entries()) {
      metrics.circuits[key] = breaker.state;
    }
    
    return metrics;
  }
}
