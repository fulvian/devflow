/**
 * Synthetic API Rate Limiting Configuration
 * Manages API call limits for synthetic.new service
 */

export interface ApiLimitsConfig {
  readonly maxCalls: number;
  readonly windowHours: number;
  readonly batchSize: number;
  readonly costPerCall: number;
  readonly windowMs: number;
}

export const SYNTHETIC_API_LIMITS: ApiLimitsConfig = {
  maxCalls: 135,
  windowHours: 5,
  batchSize: 5,
  costPerCall: 1,
  windowMs: 5 * 60 * 60 * 1000, // 5 hours in milliseconds
};

export const BATCH_OPTIMIZATION_CONFIG = {
  // Batch processing optimization
  maxBatchSize: 10,
  minBatchSize: 2,
  batchTimeoutMs: 2000, // 2 seconds max wait for batch formation
  priorityThreshold: 0.8, // High priority requests bypass batching
  
  // Intelligent batching strategies
  strategies: {
    byFileType: true, // Group by file extension (.ts, .js, etc.)
    byTaskId: true,   // Group by task identifier
    byAgentType: true, // Group by agent specialization
    byComplexity: true, // Group by estimated complexity
  },
  
  // Cost optimization
  costSavings: {
    batchMultiplier: 0.7, // 30% cost reduction for batched calls
    tokenEfficiency: 0.8,  // 20% token efficiency improvement
  },
};

export const RATE_LIMIT_STRATEGIES = {
  // Adaptive rate limiting
  adaptive: {
    enabled: true,
    burstAllowance: 10, // Allow bursts up to 10 calls
    recoveryRate: 0.1, // 10% recovery per minute
  },
  
  // Fallback strategies when limits are reached
  fallback: {
    queueRequests: true,
    maxQueueSize: 50,
    queueTimeoutMs: 30000, // 30 seconds max wait in queue
    retryStrategy: 'exponential', // exponential backoff
  },
  
  // Monitoring and alerting
  monitoring: {
    trackUsage: true,
    alertThreshold: 0.8, // Alert at 80% of limit
    logLevel: 'info',
  },
};
