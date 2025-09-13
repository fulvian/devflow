// Qwen3 Synthetic Agent Adapter for Fallback Chain
// Task ID: CCR-006-FALLBACK-CHAIN

import { Agent, AgentResponse, AgentRequest, Context } from './types';
import { performance } from 'perf_hooks';

/**
 * Configuration interface for Qwen3 Synthetic Agent
 */
export interface Qwen3Config {
  /** API endpoint URL */
  apiUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Maximum number of retries for failed requests */
  maxRetries: number;
  /** Delay between retries in milliseconds */
  retryDelay: number;
  /** Maximum requests per second */
  rateLimit: number;
  /** Timeout for API requests in milliseconds */
  timeout: number;
  /** Batch size for processing multiple requests */
  batchSize: number;
}

/**
 * Default configuration for Qwen3 Synthetic Agent
 */
const DEFAULT_CONFIG: Qwen3Config = {
  apiUrl: 'https://api.qwen3.com/v1/synthetic',
  apiKey: '',
  maxRetries: 3,
  retryDelay: 1000,
  rateLimit: 10,
  timeout: 30000,
  batchSize: 10
};

/**
 * Qwen3 Synthetic Agent Implementation
 * Provides API integration, batch processing, context management, and fallback chain support
 */
export class Qwen3SyntheticAgent implements Agent {
  private config: Qwen3Config;
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private rateLimitResetTime: number = 0;

  /**
   * Creates a new Qwen3SyntheticAgent instance
   * @param config Configuration options
   */
  constructor(config: Partial<Qwen3Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Processes a single agent request
   * @param request The agent request to process
   * @param context Optional context to inject
   * @returns Promise resolving to agent response
   */
  async process(request: AgentRequest, context?: Context): Promise<AgentResponse> {
    // Preserve and inject context
    const enrichedRequest = this.injectContext(request, context);
    
    // Apply rate limiting
    await this.applyRateLimiting();
    
    // Process with retries
    return this.processWithRetries(enrichedRequest);
  }

  /**
   * Processes multiple agent requests in batch
   * @param requests Array of agent requests to process
   * @param context Optional shared context to inject
   * @returns Promise resolving to array of agent responses
   */
  async processBatch(requests: AgentRequest[], context?: Context): Promise<AgentResponse[]> {
    const startTime = performance.now();
    
    try {
      // Split requests into batches
      const batches = this.createBatches(requests, this.config.batchSize);
      const results: AgentResponse[] = [];

      for (const batch of batches) {
        // Process each batch with rate limiting
        await this.applyRateLimiting();
        
        // Enrich all requests in the batch with context
        const enrichedBatch = batch.map(request => this.injectContext(request, context));
        
        // Process batch
        const batchResults = await this.processBatchInternal(enrichedBatch);
        results.push(...batchResults);
      }

      const endTime = performance.now();
      console.log(`Batch processing completed in ${endTime - startTime}ms for ${requests.length} requests`);
      
      return results;
    } catch (error) {
      throw new Error(`Batch processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Injects context into the agent request
   * @param request The original request
   * @param context The context to inject
   * @returns Enriched request with context
   */
  private injectContext(request: AgentRequest, context?: Context): AgentRequest {
    if (!context) return request;
    
    return {
      ...request,
      context: {
        ...request.context,
        ...context
      }
    };
  }

  /**
   * Processes a request with retry logic
   * @param request The enriched request to process
   * @param attempt Current attempt number
   * @returns Promise resolving to agent response
   */
  private async processWithRetries(request: AgentRequest, attempt: number = 1): Promise<AgentResponse> {
    try {
      const startTime = performance.now();
      const response = await this.makeApiRequest(request);
      const endTime = performance.now();
      
      console.log(`API request completed in ${endTime - startTime}ms`);
      return response;
    } catch (error) {
      if (attempt >= this.config.maxRetries) {
        throw new Error(`Max retries exceeded: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      console.warn(`Request failed (attempt ${attempt}), retrying in ${this.config.retryDelay}ms...`);
      await this.delay(this.config.retryDelay);
      return this.processWithRetries(request, attempt + 1);
    }
  }

  /**
   * Processes a batch of requests internally
   * @param requests Array of enriched requests
   * @returns Promise resolving to array of responses
   */
  private async processBatchInternal(requests: AgentRequest[]): Promise<AgentResponse[]> {
    try {
      const response = await this.makeBatchApiRequest(requests);
      return response;
    } catch (error) {
      // If batch fails, process individually as fallback
      console.warn('Batch request failed, falling back to individual processing');
      const results: AgentResponse[] = [];
      
      for (const request of requests) {
        try {
          const result = await this.processWithRetries(request);
          results.push(result);
        } catch (individualError) {
          results.push({
            id: request.id,
            success: false,
            error: individualError instanceof Error ? individualError.message : String(individualError),
            data: null
          });
        }
      }
      
      return results;
    }
  }

  /**
   * Makes a single API request to Qwen3
   * @param request The request to send
   * @returns Promise resolving to agent response
   */
  private async makeApiRequest(request: AgentRequest): Promise<AgentResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    
    try {
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'User-Agent': 'Qwen3-Synthetic-Agent/1.0'
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          if (retryAfter) {
            this.rateLimitResetTime = Date.now() + parseInt(retryAfter, 10) * 1000;
          }
          throw new Error('Rate limit exceeded');
        }
        
        throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return {
        id: request.id,
        success: true,
        data: data,
        error: null
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      throw error;
    }
  }

  /**
   * Makes a batch API request to Qwen3
   * @param requests Array of requests to send
   * @returns Promise resolving to array of responses
   */
  private async makeBatchApiRequest(requests: AgentRequest[]): Promise<AgentResponse[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    
    try {
      const response = await fetch(`${this.config.apiUrl}/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'User-Agent': 'Qwen3-Synthetic-Agent/1.0'
        },
        body: JSON.stringify({ requests }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Batch API request failed with status ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.responses || [];
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Batch request timeout');
      }
      
      throw error;
    }
  }

  /**
   * Applies rate limiting based on configuration
   */
  private async applyRateLimiting(): Promise<void> {
    const now = Date.now();
    
    // Check if we're in a rate limit cooldown period
    if (this.rateLimitResetTime > now) {
      const delayTime = this.rateLimitResetTime - now;
      console.log(`Rate limit enforced, waiting ${delayTime}ms`);
      await this.delay(delayTime);
      return;
    }
    
    // Check if we've exceeded the rate limit
    if (this.requestCount >= this.config.rateLimit) {
      const timeSinceLastRequest = now - this.lastRequestTime;
      const timeToWait = 1000 - timeSinceLastRequest;
      
      if (timeToWait > 0) {
        console.log(`Rate limit applied, waiting ${timeToWait}ms`);
        await this.delay(timeToWait);
      }
      
      // Reset counters for the new second
      this.requestCount = 0;
    }
    
    this.lastRequestTime = now;
    this.requestCount++;
  }

  /**
   * Creates batches from an array of requests
   * @param requests Array of requests to batch
   * @param batchSize Maximum size of each batch
   * @returns Array of request batches
   */
  private createBatches<T>(requests: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < requests.length; i += batchSize) {
      batches.push(requests.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * Delays execution for specified milliseconds
   * @param ms Milliseconds to delay
   * @returns Promise that resolves after delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Example usage:
// const agent = new Qwen3SyntheticAgent({
//   apiKey: 'your-api-key',
//   maxRetries: 3,
//   rateLimit: 5
// });
//
// const response = await agent.process({
//   id: 'request-1',
//   prompt: 'Generate a summary of quantum computing',
//   parameters: { maxTokens: 100 }
// });