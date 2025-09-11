/**
 * Enhanced Synthetic Service with Intelligent Batch Processing
 * Integrates rate limiting and batch optimization
 */

import { batchProcessor } from './BatchProcessor.js';
import { apiRateLimiter } from '../utils/ApiRateLimiter.js';
import { SYNTHETIC_API_LIMITS, BATCH_OPTIMIZATION_CONFIG } from '../config/apiLimits.js';

export interface SyntheticRequest {
  taskId: string;
  filePath: string;
  objective: string;
  language: string;
  agentType: 'code' | 'reasoning' | 'context' | 'qa-deployment';
  priority?: number;
  complexity?: number;
  storageIntegration?: boolean;
}

export interface SyntheticResponse {
  success: boolean;
  result?: any;
  error?: string;
  tokensUsed: number;
  executionTime: number;
  batchOptimized: boolean;
  rateLimitStatus: any;
}

export interface BatchRequest {
  filePath: string;
  objective: string;
  language: string;
}

export class EnhancedSyntheticService {
  private requestCounter = 0;
  private totalTokensSaved = 0;
  private totalCallsOptimized = 0;

  constructor() {
    console.log('🚀 Enhanced Synthetic Service initialized');
    console.log(`📊 Rate Limit: ${SYNTHETIC_API_LIMITS.maxCalls} calls per ${SYNTHETIC_API_LIMITS.windowHours} hours`);
    console.log(`⚡ Batch Size: ${SYNTHETIC_API_LIMITS.batchSize}, Optimization: ${BATCH_OPTIMIZATION_CONFIG.costSavings.batchMultiplier * 100}%`);
  }

  /**
   * Execute a single synthetic operation with intelligent batching
   */
  async executeOperation(request: SyntheticRequest): Promise<SyntheticResponse> {
    const startTime = Date.now();
    const requestId = `synthetic_${++this.requestCounter}_${Date.now()}`;
    
    console.log(`🔄 Processing request ${requestId}: ${request.objective}`);
    
    try {
      // Check rate limits
      const rateLimitStatus = apiRateLimiter.getStatus();
      if (!rateLimitStatus.canCall) {
        const waitTime = apiRateLimiter.getTimeUntilNextCall();
        throw new Error(`Rate limit exceeded. Usage: ${(rateLimitStatus.usagePercentage * 100).toFixed(1)}%. Next call in ${Math.ceil(waitTime / 1000)}s`);
      }

      // Determine if this should be batched or processed immediately
      const shouldBatch = this.shouldBatchRequest(request);
      
      let result: any;
      let batchOptimized = false;
      
      if (shouldBatch) {
        console.log(`📦 Batching request ${requestId} for optimization`);
        result = await batchProcessor.enqueueRequest(
          request.agentType,
          request.filePath,
          request.objective,
          request.language,
          request.priority || 0.5,
          request.complexity || 0.5
        );
        batchOptimized = true;
        this.totalCallsOptimized++;
      } else {
        console.log(`⚡ Processing request ${requestId} immediately`);
        result = await this.executeImmediateRequest(request);
        batchOptimized = false;
      }

      const executionTime = Date.now() - startTime;
      const tokensUsed = this.estimateTokensUsed(request, result);
      
      if (batchOptimized) {
        this.totalTokensSaved += Math.ceil(tokensUsed * (1 - BATCH_OPTIMIZATION_CONFIG.costSavings.batchMultiplier));
      }

      console.log(`✅ Request ${requestId} completed: ${executionTime}ms, ~${tokensUsed} tokens, batch: ${batchOptimized}`);

      return {
        success: true,
        result,
        tokensUsed,
        executionTime,
        batchOptimized,
        rateLimitStatus: apiRateLimiter.getStatus(),
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error(`❌ Request ${requestId} failed:`, errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        tokensUsed: 0,
        executionTime,
        batchOptimized: false,
        rateLimitStatus: apiRateLimiter.getStatus(),
      };
    }
  }

  /**
   * Execute batch operations for multiple files
   */
  async executeBatchOperations(
    taskId: string,
    batchRequests: BatchRequest[],
    agentType: 'code' | 'reasoning' | 'context' | 'qa-deployment' = 'code',
    storageIntegration: boolean = true
  ): Promise<SyntheticResponse> {
    const startTime = Date.now();
    const batchId = `batch_${taskId}_${Date.now()}`;
    
    console.log(`📦 Processing batch ${batchId}: ${batchRequests.length} requests`);
    
    try {
      // Check rate limits for batch
      const rateLimitStatus = apiRateLimiter.getStatus();
      if (!rateLimitStatus.canCall) {
        const waitTime = apiRateLimiter.getTimeUntilNextCall();
        throw new Error(`Rate limit exceeded for batch. Usage: ${(rateLimitStatus.usagePercentage * 100).toFixed(1)}%. Next call in ${Math.ceil(waitTime / 1000)}s`);
      }

      // Process batch requests
      const batchPromises = batchRequests.map((req, index) => 
        batchProcessor.enqueueRequest(
          agentType,
          req.filePath,
          req.objective,
          req.language,
          0.3, // Lower priority for batch items
          0.5  // Medium complexity
        )
      );

      const results = await Promise.all(batchPromises);
      
      const executionTime = Date.now() - startTime;
      const totalTokensUsed = this.estimateBatchTokensUsed(batchRequests, results);
      
      this.totalCallsOptimized += batchRequests.length;
      this.totalTokensSaved += Math.ceil(totalTokensUsed * (1 - BATCH_OPTIMIZATION_CONFIG.costSavings.batchMultiplier));

      console.log(`✅ Batch ${batchId} completed: ${executionTime}ms, ~${totalTokensUsed} tokens, ${batchRequests.length} requests`);

      return {
        success: true,
        result: {
          batchId,
          results,
          summary: `Processed ${batchRequests.length} files successfully`,
        },
        tokensUsed: totalTokensUsed,
        executionTime,
        batchOptimized: true,
        rateLimitStatus: apiRateLimiter.getStatus(),
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error(`❌ Batch ${batchId} failed:`, errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        tokensUsed: 0,
        executionTime,
        batchOptimized: true,
        rateLimitStatus: apiRateLimiter.getStatus(),
      };
    }
  }

  /**
   * Get service statistics and performance metrics
   */
  getServiceStats(): {
    totalRequests: number;
    totalTokensSaved: number;
    totalCallsOptimized: number;
    rateLimitStatus: any;
    batchProcessorStatus: any;
    optimizationEfficiency: number;
  } {
    const rateLimitStatus = apiRateLimiter.getStatus();
    const batchProcessorStatus = batchProcessor.getQueueStatus();
    
    const optimizationEfficiency = this.requestCounter > 0 
      ? (this.totalCallsOptimized / this.requestCounter) * 100 
      : 0;

    return {
      totalRequests: this.requestCounter,
      totalTokensSaved: this.totalTokensSaved,
      totalCallsOptimized: this.totalCallsOptimized,
      rateLimitStatus,
      batchProcessorStatus,
      optimizationEfficiency,
    };
  }

  /**
   * Reset service statistics
   */
  resetStats(): void {
    this.requestCounter = 0;
    this.totalTokensSaved = 0;
    this.totalCallsOptimized = 0;
    apiRateLimiter.reset();
    batchProcessor.clearQueue();
    console.log('🔄 Service statistics reset');
  }

  /**
   * Determine if a request should be batched
   */
  private shouldBatchRequest(request: SyntheticRequest): boolean {
    // High priority requests bypass batching
    if ((request.priority || 0.5) >= BATCH_OPTIMIZATION_CONFIG.priorityThreshold) {
      return false;
    }

    // Complex requests might benefit from individual processing
    if ((request.complexity || 0.5) > 0.8) {
      return false;
    }

    // Check if we're close to rate limits
    const rateLimitStatus = apiRateLimiter.getStatus();
    if (rateLimitStatus.usagePercentage > 0.8) {
      return true; // Batch to conserve API calls
    }

    // Default to batching for optimization
    return true;
  }

  /**
   * Execute an immediate request (bypasses batching)
   */
  private async executeImmediateRequest(request: SyntheticRequest): Promise<any> {
    // This would integrate with the actual Synthetic API
    // For now, return a mock response
    return {
      code: `// Generated code for ${request.filePath}`,
      explanation: `Generated solution for ${request.objective}`,
      agentType: request.agentType,
      timestamp: Date.now(),
    };
  }

  /**
   * Estimate tokens used for a request
   */
  private estimateTokensUsed(request: SyntheticRequest, result: any): number {
    const baseTokens = 200;
    const objectiveTokens = Math.ceil(request.objective.length / 4);
    const resultTokens = result ? Math.ceil(JSON.stringify(result).length / 4) : 0;
    const complexityMultiplier = 1 + (request.complexity || 0.5);
    
    return Math.ceil((baseTokens + objectiveTokens + resultTokens) * complexityMultiplier);
  }

  /**
   * Estimate tokens used for batch requests
   */
  private estimateBatchTokensUsed(requests: BatchRequest[], results: any[]): number {
    return requests.reduce((total, request, index) => {
      const result = results[index];
      const baseTokens = 150; // Reduced for batch efficiency
      const objectiveTokens = Math.ceil(request.objective.length / 4);
      const resultTokens = result ? Math.ceil(JSON.stringify(result).length / 4) : 0;
      
      return total + baseTokens + objectiveTokens + resultTokens;
    }, 0);
  }
}

// Global service instance
export const syntheticService = new EnhancedSyntheticService();
