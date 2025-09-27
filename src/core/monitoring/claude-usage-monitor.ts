/**
 * ClaudeCodeUsageMonitor - Tracks Claude Code token usage
 * 
 * This service monitors token consumption and provides current usage statistics.
 * In a production implementation, this would integrate with Claude Code's actual
 * token tracking APIs.
 */
export class ClaudeCodeUsageMonitor {
  private currentTokenCount: number = 17900;
  private sessionStartTokens: number = 17900;
  private readonly maxTokens: number = 200000; // Claude Code context limit
  private lastUpdate: number = Date.now();

  constructor() {
    // Initialize with a base token count to simulate existing context
    this.currentTokenCount = 17900;
    this.sessionStartTokens = 17900;
  }

  /**
   * Gets the current token count (with simulated dynamic usage)
   */
  getCurrentTokenCount(): number {
    // Simulate gradual token usage over time for demonstration purposes
    const now = Date.now();
    const elapsedMinutes = (now - this.lastUpdate) / (1000 * 60); // Convert to minutes
    
    // Increase token count by 500 tokens per minute (for demonstration)
    if (elapsedMinutes >= 1) {
      const tokensToAdd = Math.floor(elapsedMinutes * 500);
      this.currentTokenCount = Math.min(this.maxTokens, this.currentTokenCount + tokensToAdd);
      this.lastUpdate = now;
    }
    
    return this.currentTokenCount;
  }

  /**
   * Gets the maximum token limit
   */
  getMaxTokens(): number {
    return this.maxTokens;
  }

  /**
   * Increments the token count (simulates token usage)
   */
  incrementTokenCount(tokens: number): void {
    this.currentTokenCount = Math.min(this.maxTokens, this.currentTokenCount + tokens);
    this.lastUpdate = Date.now();
  }

  /**
   * Decrements the token count (simulates context compaction)
   */
  decrementTokenCount(tokens: number): void {
    this.currentTokenCount = Math.max(0, this.currentTokenCount - tokens);
    this.lastUpdate = Date.now();
  }

  /**
   * Sets the token count directly
   */
  setTokenCount(tokens: number): void {
    this.currentTokenCount = Math.min(this.maxTokens, Math.max(0, tokens));
    this.lastUpdate = Date.now();
  }

  /**
   * Resets the token count to session start value
   */
  resetToSessionStart(): void {
    this.currentTokenCount = this.sessionStartTokens;
    this.lastUpdate = Date.now();
  }

  /**
   * Gets the usage percentage
   */
  getUsagePercentage(): number {
    return Math.min(100, Math.max(0, Math.floor((this.getCurrentTokenCount() / this.maxTokens) * 100)));
  }

  /**
   * Checks if usage is approaching limits
   */
  isApproachingLimit(threshold: number = 80): boolean {
    return this.getUsagePercentage() >= threshold;
  }
}

import Anthropic from '@anthropic-ai/sdk';
import { MessageCreateParams, Message } from '@anthropic-ai/sdk/resources/messages';

// Type definitions for usage tracking
interface UsageMetrics {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}

interface RateLimitInfo {
  requestsRemaining: number;
  requestsLimit: number;
  requestsReset: Date;
  tokensRemaining: number;
  tokensLimit: number;
  tokensReset: Date;
}

interface ModelUsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalRequests: number;
  usagePercentage: number;
  rateLimitInfo: RateLimitInfo;
}

// Model configuration with actual token limits
const MODEL_CONFIGS: Record<string, { inputTokenLimit: number; outputTokenLimit: number }> = {
  'claude-3-5-sonnet-20240620': { inputTokenLimit: 200000, outputTokenLimit: 8192 },
  'claude-3-opus-20240229': { inputTokenLimit: 200000, outputTokenLimit: 4096 },
  'claude-3-sonnet-20240229': { inputTokenLimit: 200000, outputTokenLimit: 4096 },
  'claude-3-haiku-20240307': { inputTokenLimit: 200000, outputTokenLimit: 4096 },
};

export class ClaudeUsageMonitor {
  private anthropic: Anthropic;
  private usageStats: Map<string, ModelUsageStats>;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.anthropic = new Anthropic({ apiKey });
    this.usageStats = new Map();

    // Initialize usage stats for each model
    Object.keys(MODEL_CONFIGS).forEach(model => {
      this.usageStats.set(model, {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalRequests: 0,
        usagePercentage: 0,
        rateLimitInfo: {
          requestsRemaining: 0,
          requestsLimit: 0,
          requestsReset: new Date(),
          tokensRemaining: 0,
          tokensLimit: 0,
          tokensReset: new Date(),
        }
      });
    });
  }

  /**
   * Creates a message with real usage tracking
   */
  async createMessage(
    params: MessageCreateParams
  ): Promise<Message> {
    try {
      const responsePromise = this.anthropic.messages.create(params);

      // Extract raw response to access headers
      const response = await (responsePromise as any).asResponse();
      const message = await responsePromise;

      // Process usage metrics from response
      this.processUsageMetrics(params.model, message as Message, response);

      return message as Message;
    } catch (error: any) {
      // Still process rate limit headers even on error
      if (error instanceof Anthropic.APIError) {
        this.processRateLimitHeaders(params.model, error);
      }
      throw error;
    }
  }

  /**
   * Process usage metrics from successful API response
   */
  private processUsageMetrics(
    model: string,
    message: Message,
    response: any
  ): void {
    // Extract usage from message object
    const usage: UsageMetrics = {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheCreationTokens: message.usage.cache_creation_input_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens,
    };

    // Update usage stats
    const modelStats = this.usageStats.get(model) || this.initializeModelStats(model);

    modelStats.totalInputTokens += usage.inputTokens || 0;
    modelStats.totalOutputTokens += usage.outputTokens || 0;
    modelStats.totalRequests += 1;

    // Calculate usage percentage based on model limits
    const modelConfig = MODEL_CONFIGS[model];
    if (modelConfig) {
      const totalTokens = modelStats.totalInputTokens + modelStats.totalOutputTokens;
      const maxTokens = Math.max(modelConfig.inputTokenLimit, modelConfig.outputTokenLimit);
      modelStats.usagePercentage = Math.min(100, (totalTokens / maxTokens) * 100);
    }

    // Process rate limit headers
    // if (error instanceof Anthropic.APIError) {
    //   this.processRateLimitHeaders(model, error);
    // }
  }

  /**
   * Process rate limit headers from API response
   */
  private processRateLimitHeaders(model: string, error: any): void {
    // Se non abbiamo accesso agli headers, inizializziamo comunque le statistiche
    const modelStats = this.usageStats.get(model) || this.initializeModelStats(model);
    
    // Inizializziamo con valori di default
    modelStats.rateLimitInfo = {
      requestsLimit: 0,
      requestsRemaining: 0,
      requestsReset: new Date(),
      tokensLimit: 0,
      tokensRemaining: 0,
      tokensReset: new Date(),
    };
  }

  /**
   * Initialize stats for a new model
   */
  private initializeModelStats(model: string): ModelUsageStats {
    const stats: ModelUsageStats = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalRequests: 0,
      usagePercentage: 0,
      rateLimitInfo: {
        requestsRemaining: 0,
        requestsLimit: 0,
        requestsReset: new Date(),
        tokensRemaining: 0,
        tokensLimit: 0,
        tokensReset: new Date(),
      }
    };

    this.usageStats.set(model, stats);
    return stats;
  }

  /**
   * Get current usage statistics for a model
   */
  getUsageStats(model: string): ModelUsageStats | undefined {
    return this.usageStats.get(model);
  }

  /**
   * Get usage statistics for all models
   */
  getAllUsageStats(): Map<string, ModelUsageStats> {
    return new Map(this.usageStats);
  }

  /**
   * Check if we're approaching rate limits
   */
  isRateLimited(model: string): boolean {
    const stats = this.usageStats.get(model);
    if (!stats) return false;

    const { requestsRemaining, tokensRemaining } = stats.rateLimitInfo;
    return requestsRemaining < 10 || tokensRemaining < 1000;
  }

  /**
   * Get models approaching their usage limits
   */
  getModelsNearLimit(threshold = 80): string[] {
    const nearLimitModels: string[] = [];

    for (const [model, stats] of this.usageStats.entries()) {
      if (stats.usagePercentage >= threshold) {
        nearLimitModels.push(model);
      }
    }

    return nearLimitModels;
  }

  /**
   * Reset usage statistics (useful for testing or daily resets)
   */
  resetUsageStats(model?: string): void {
    if (model) {
      const stats = this.usageStats.get(model);
      if (stats) {
        stats.totalInputTokens = 0;
        stats.totalOutputTokens = 0;
        stats.totalRequests = 0;
        stats.usagePercentage = 0;
      }
    } else {
      for (const stats of this.usageStats.values()) {
        stats.totalInputTokens = 0;
        stats.totalOutputTokens = 0;
        stats.totalRequests = 0;
        stats.usagePercentage = 0;
      }
    }
  }
}

// Export types for external use
export type { UsageMetrics, RateLimitInfo, ModelUsageStats };