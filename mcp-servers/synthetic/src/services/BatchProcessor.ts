/**
 * Intelligent Batch Processor for Synthetic API
 * Optimizes API calls by batching requests intelligently
 */

import { SYNTHETIC_API_LIMITS, BATCH_OPTIMIZATION_CONFIG } from '../config/apiLimits.js';
import { apiRateLimiter } from '../utils/ApiRateLimiter.js';

export interface BatchRequest {
  id: string;
  type: 'code' | 'reasoning' | 'context' | 'qa-deployment';
  filePath: string;
  objective: string;
  language: string;
  priority: number; // 0-1, higher = more urgent
  complexity: number; // 0-1, estimated complexity
  timestamp: number;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

export interface BatchGroup {
  id: string;
  requests: BatchRequest[];
  strategy: 'fileType' | 'taskId' | 'agentType' | 'complexity';
  estimatedTokens: number;
  priority: number;
}

export interface BatchResult {
  batchId: string;
  success: boolean;
  results: Array<{
    requestId: string;
    success: boolean;
    result?: any;
    error?: string;
  }>;
  tokensUsed: number;
  executionTime: number;
}

export class IntelligentBatchProcessor {
  private requestQueue: BatchRequest[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private processingBatch = false;
  private batchCounter = 0;

  constructor() {
    console.log('🚀 Intelligent Batch Processor initialized');
    console.log(`📊 Batch size: ${SYNTHETIC_API_LIMITS.batchSize}, Timeout: ${BATCH_OPTIMIZATION_CONFIG.batchTimeoutMs}ms`);
  }

  /**
   * Enqueue a request for batch processing
   */
  async enqueueRequest(
    type: 'code' | 'reasoning' | 'context' | 'qa-deployment',
    filePath: string,
    objective: string,
    language: string,
    priority: number = 0.5,
    complexity: number = 0.5
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const request: BatchRequest = {
        id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        filePath,
        objective,
        language,
        priority,
        complexity,
        timestamp: Date.now(),
        resolve,
        reject,
      };

      this.requestQueue.push(request);
      
      // High priority requests bypass batching
      if (priority >= BATCH_OPTIMIZATION_CONFIG.priorityThreshold) {
        console.log(`⚡ High priority request ${request.id}, processing immediately`);
        this.processImmediateRequest(request);
        return;
      }

      // Check if we should flush the batch
      if (this.shouldFlushBatch()) {
        this.flushBatch();
      } else if (!this.batchTimer) {
        // Set timer for batch timeout
        this.batchTimer = setTimeout(() => {
          this.flushBatch();
        }, BATCH_OPTIMIZATION_CONFIG.batchTimeoutMs);
      }
    });
  }

  /**
   * Process a high-priority request immediately
   */
  private async processImmediateRequest(request: BatchRequest): Promise<void> {
    try {
      if (!apiRateLimiter.canCall()) {
        const waitTime = apiRateLimiter.getTimeUntilNextCall();
        throw new Error(`Rate limit exceeded. Next call allowed in ${Math.ceil(waitTime / 1000)}s`);
      }

      const result = await this.executeSingleRequest(request);
      apiRateLimiter.recordCall(undefined, request.type);
      request.resolve(result);
    } catch (error) {
      apiRateLimiter.recordFailedCall(undefined, request.type);
      request.reject(error);
    }
  }

  /**
   * Check if batch should be flushed
   */
  private shouldFlushBatch(): boolean {
    return this.requestQueue.length >= SYNTHETIC_API_LIMITS.batchSize ||
           this.requestQueue.length >= BATCH_OPTIMIZATION_CONFIG.maxBatchSize;
  }

  /**
   * Flush current batch
   */
  private async flushBatch(): Promise<void> {
    if (this.processingBatch || this.requestQueue.length === 0) {
      return;
    }

    this.processingBatch = true;
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      const batch = this.requestQueue.splice(0, SYNTHETIC_API_LIMITS.batchSize);
      console.log(`🔄 Processing batch of ${batch.length} requests`);
      
      const batchResult = await this.processBatch(batch);
      
      // Resolve all requests in the batch
      batch.forEach((request, index) => {
        const result = batchResult.results[index];
        if (result.success) {
          request.resolve(result.result);
        } else {
          request.reject(new Error(result.error));
        }
      });
      
    } catch (error) {
      console.error('❌ Batch processing failed:', error);
      // Reject all requests in current batch
      const batch = this.requestQueue.splice(0, SYNTHETIC_API_LIMITS.batchSize);
      batch.forEach(request => {
        request.reject(error);
      });
    } finally {
      this.processingBatch = false;
      
      // Process remaining requests if any
      if (this.requestQueue.length > 0) {
        setTimeout(() => this.flushBatch(), 100);
      }
    }
  }

  /**
   * Process a batch of requests
   */
  private async processBatch(requests: BatchRequest[]): Promise<BatchResult> {
    const batchId = `batch_${++this.batchCounter}_${Date.now()}`;
    const startTime = Date.now();
    
    // Check rate limits
    if (!apiRateLimiter.canCall()) {
      const waitTime = apiRateLimiter.getTimeUntilNextCall();
      throw new Error(`Rate limit exceeded. Next call allowed in ${Math.ceil(waitTime / 1000)}s`);
    }

    // Group requests by strategy
    const groups = this.groupRequestsByStrategy(requests);
    const results: BatchResult['results'] = [];
    
    try {
      // Process each group
      for (const group of groups) {
        const groupResults = await this.processGroup(group);
        results.push(...groupResults);
      }
      
      // Record successful batch call
      apiRateLimiter.recordCall(undefined, 'batch');
      
      const executionTime = Date.now() - startTime;
      const tokensUsed = this.estimateTokensUsed(requests);
      
      console.log(`✅ Batch ${batchId} completed: ${results.length} requests, ${executionTime}ms, ~${tokensUsed} tokens`);
      
      return {
        batchId,
        success: true,
        results,
        tokensUsed,
        executionTime,
      };
      
    } catch (error) {
      apiRateLimiter.recordFailedCall(undefined, 'batch');
      
      // Return failed results for all requests
      const failedResults = requests.map(request => ({
        requestId: request.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }));
      
      return {
        batchId,
        success: false,
        results: failedResults,
        tokensUsed: 0,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Group requests by intelligent strategy
   */
  private groupRequestsByStrategy(requests: BatchRequest[]): BatchGroup[] {
    const groups: Map<string, BatchGroup> = new Map();
    
    for (const request of requests) {
      let groupKey: string;
      let strategy: BatchGroup['strategy'];
      
      // Determine grouping strategy based on configuration
      if (BATCH_OPTIMIZATION_CONFIG.strategies.byFileType) {
        const fileExt = request.filePath.split('.').pop() || 'unknown';
        groupKey = `filetype_${fileExt}`;
        strategy = 'fileType';
      } else if (BATCH_OPTIMIZATION_CONFIG.strategies.byAgentType) {
        groupKey = `agent_${request.type}`;
        strategy = 'agentType';
      } else if (BATCH_OPTIMIZATION_CONFIG.strategies.byComplexity) {
        const complexityLevel = Math.floor(request.complexity * 3); // 0, 1, 2
        groupKey = `complexity_${complexityLevel}`;
        strategy = 'complexity';
      } else {
        groupKey = 'default';
        strategy = 'fileType';
      }
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          id: groupKey,
          requests: [],
          strategy,
          estimatedTokens: 0,
          priority: 0,
        });
      }
      
      const group = groups.get(groupKey)!;
      group.requests.push(request);
      group.estimatedTokens += this.estimateRequestTokens(request);
      group.priority = Math.max(group.priority, request.priority);
    }
    
    return Array.from(groups.values());
  }

  /**
   * Process a group of requests
   */
  private async processGroup(group: BatchGroup): Promise<BatchResult['results']> {
    const results: BatchResult['results'] = [];
    
    // Create optimized prompt for the group
    const groupPrompt = this.createGroupPrompt(group);
    
    try {
      // Execute the group request
      const response = await this.executeGroupRequest(groupPrompt, group);
      
      // Parse and distribute results
      const parsedResults = this.parseGroupResponse(response, group);
      
      for (let i = 0; i < group.requests.length; i++) {
        const request = group.requests[i];
        const result = parsedResults[i];
        
        results.push({
          requestId: request.id,
          success: true,
          result,
        });
      }
      
    } catch (error) {
      // If group processing fails, try individual requests
      console.warn(`⚠️ Group processing failed for ${group.id}, falling back to individual requests`);
      
      for (const request of group.requests) {
        try {
          const result = await this.executeSingleRequest(request);
          results.push({
            requestId: request.id,
            success: true,
            result,
          });
        } catch (individualError) {
          results.push({
            requestId: request.id,
            success: false,
            error: individualError instanceof Error ? individualError.message : String(individualError),
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Create optimized prompt for a group of requests
   */
  private createGroupPrompt(group: BatchGroup): string {
    const requests = group.requests;
    const strategy = group.strategy;
    
    let prompt = `# Batch Code Generation Request\n\n`;
    prompt += `Strategy: ${strategy}\n`;
    prompt += `Requests: ${requests.length}\n\n`;
    
    switch (strategy) {
      case 'fileType':
        const fileType = requests[0].filePath.split('.').pop();
        prompt += `Generate ${fileType} code for the following objectives:\n\n`;
        break;
      case 'agentType':
        prompt += `Generate ${requests[0].type} solutions for the following objectives:\n\n`;
        break;
      case 'complexity':
        prompt += `Generate code solutions of similar complexity:\n\n`;
        break;
    }
    
    requests.forEach((request, index) => {
      prompt += `## Request ${index + 1}\n`;
      prompt += `File: ${request.filePath}\n`;
      prompt += `Objective: ${request.objective}\n`;
      prompt += `Language: ${request.language}\n`;
      prompt += `Priority: ${request.priority}\n\n`;
    });
    
    prompt += `\nProvide structured JSON response with individual results:\n`;
    prompt += `{\n`;
    prompt += `  "results": [\n`;
    requests.forEach((_, index) => {
      prompt += `    {\n`;
      prompt += `      "index": ${index},\n`;
      prompt += `      "code": "generated code here",\n`;
      prompt += `      "explanation": "brief explanation"\n`;
      prompt += `    }${index < requests.length - 1 ? ',' : ''}\n`;
    });
    prompt += `  ]\n`;
    prompt += `}\n`;
    
    return prompt;
  }

  /**
   * Execute a group request
   */
  private async executeGroupRequest(prompt: string, group: BatchGroup): Promise<any> {
    // This would integrate with the actual Synthetic API
    // For now, return a mock response
    return {
      choices: [{
        message: {
          content: JSON.stringify({
            results: group.requests.map((_, index) => ({
              index,
              code: `// Generated code for request ${index + 1}`,
              explanation: `Generated solution for ${group.requests[index].objective}`,
            })),
          }),
        },
      }],
      usage: {
        total_tokens: this.estimateRequestTokens(group.requests[0]) * group.requests.length,
      },
    };
  }

  /**
   * Execute a single request
   */
  private async executeSingleRequest(request: BatchRequest): Promise<any> {
    // This would integrate with the actual Synthetic API
    // For now, return a mock response
    return {
      code: `// Generated code for ${request.filePath}`,
      explanation: `Generated solution for ${request.objective}`,
    };
  }

  /**
   * Parse group response and distribute to individual requests
   */
  private parseGroupResponse(response: any, group: BatchGroup): any[] {
    try {
      const content = response.choices[0].message.content;
      const parsed = JSON.parse(content);
      return parsed.results || [];
    } catch (error) {
      console.error('Failed to parse group response:', error);
      // Return empty results for all requests
      return group.requests.map(() => ({}));
    }
  }

  /**
   * Estimate tokens for a request
   */
  private estimateRequestTokens(request: BatchRequest): number {
    const baseTokens = 100;
    const objectiveTokens = Math.ceil(request.objective.length / 4);
    const complexityMultiplier = 1 + request.complexity;
    
    return Math.ceil((baseTokens + objectiveTokens) * complexityMultiplier);
  }

  /**
   * Estimate total tokens used
   */
  private estimateTokensUsed(requests: BatchRequest[]): number {
    return requests.reduce((total, request) => {
      return total + this.estimateRequestTokens(request);
    }, 0);
  }

  /**
   * Get current queue status
   */
  getQueueStatus(): {
    queueLength: number;
    processingBatch: boolean;
    rateLimitStatus: any;
  } {
    return {
      queueLength: this.requestQueue.length,
      processingBatch: this.processingBatch,
      rateLimitStatus: apiRateLimiter.getStatus(),
    };
  }

  /**
   * Clear all pending requests
   */
  clearQueue(): void {
    this.requestQueue.forEach(request => {
      request.reject(new Error('Queue cleared'));
    });
    this.requestQueue = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }
}

// Global batch processor instance
export const batchProcessor = new IntelligentBatchProcessor();
