/**
 * SmartTokenClassifier - Classifies tokens in ccusage blocks to separate
 * real user interactions from system/context overhead
 */

import { CcusageBlock, TokenClassification, ClassificationResult, ModelType } from './types/ccusage-types';
import { LRUCache } from '../utils/lru-cache';

/**
 * Configuration interface for the classifier
 */
interface ClassifierConfig {
  cacheSize: number;
  minInteractionTokens: number;
  contextRefreshThreshold: number;
}

/**
 * Pattern definitions for classification
 */
interface ClassificationPatterns {
  contextRefresh: RegExp[];
  systemPrompts: RegExp[];
  syntheticAgents: RegExp[];
  userInteractions: RegExp[];
}

/**
 * SmartTokenClassifier analyzes ccusage blocks to separate real user interactions
 * from system/context overhead tokens
 */
export class SmartTokenClassifier {
  private cache: LRUCache<string, ClassificationResult>;
  private patterns: ClassificationPatterns;
  private config: ClassifierConfig;

  /**
   * Initialize the classifier with optional configuration
   */
  constructor(config?: Partial<ClassifierConfig>) {
    this.config = {
      cacheSize: config?.cacheSize || 100,
      minInteractionTokens: config?.minInteractionTokens || 100,
      contextRefreshThreshold: config?.contextRefreshThreshold || 1000000 // 1M tokens
    };

    this.cache = new LRUCache(this.config.cacheSize);

    // Define classification patterns
    this.patterns = {
      contextRefresh: [
        /context\s*refresh/i,
        /reload\s*context/i,
        /initialize\s*session/i,
        /load\s*workspace/i,
        /cache\s*read/i
      ],
      systemPrompts: [
        /system\s*instruction/i,
        /assistant\s*configuration/i,
        /model\s*parameters/i,
        /^you are claude/i,
        /^important:/i
      ],
      syntheticAgents: [
        /synthetic/i,
        /automated\s*response/i,
        /simulation/i,
        /agent\s*call/i
      ],
      userInteractions: [
        /user:\s*/i,
        /prompt:/i,
        /response:/i,
        /human:\s*/i,
        /assistant:/i
      ]
    };
  }

  /**
   * Classify a ccusage block to separate real user interactions from system overhead
   */
  public classifyBlock(block: CcusageBlock): ClassificationResult {
    // Generate cache key from block metadata
    const cacheKey = this.generateCacheKey(block);

    // Check if result is cached
    const cachedResult = this.cache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    // Perform classification
    const result = this.performClassification(block);

    // Cache the result
    this.cache.set(cacheKey, result);

    return result;
  }

  /**
   * Classify multiple blocks at once
   */
  public classifyBlocks(blocks: CcusageBlock[]): ClassificationResult[] {
    return blocks.map(block => this.classifyBlock(block));
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { hits: number; misses: number } {
    return this.cache.getStats();
  }

  /**
   * Clear the classification cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Perform the actual classification of a block
   */
  private performClassification(block: CcusageBlock): ClassificationResult {
    const result: ClassificationResult = {
      blockId: block.id,
      totalTokens: block.totalTokens,
      classifications: new Map<TokenClassification, number>(),
      userInteractionTokens: 0,
      systemOverheadTokens: 0,
      modelBreakdown: new Map<ModelType, number>(),
      duration: block.duration
    };

    // Initialize classification counts
    Object.values(TokenClassification).forEach(type => {
      result.classifications.set(type, 0);
    });

    // Initialize model breakdown
    block.models.forEach(model => {
      result.modelBreakdown.set(model, 0);
    });

    // Classify the entire block based on patterns and heuristics
    const classification = this.classifyEntireBlock(block);
    result.classifications.set(classification, block.totalTokens);

    // Distribute tokens among models
    const tokensPerModel = Math.floor(block.totalTokens / block.models.length);
    block.models.forEach(model => {
      result.modelBreakdown.set(model, tokensPerModel);
    });

    // Calculate user interaction vs system overhead
    if (classification === TokenClassification.UserInteraction ||
        classification === TokenClassification.UserPrompt ||
        classification === TokenClassification.UserResponse) {
      result.userInteractionTokens = block.totalTokens;
      result.systemOverheadTokens = 0;
    } else {
      result.userInteractionTokens = 0;
      result.systemOverheadTokens = block.totalTokens;
    }

    return result;
  }

  /**
   * Classify an entire block based on size, models, and duration patterns
   */
  private classifyEntireBlock(block: CcusageBlock): TokenClassification {
    // Large token counts are typically context refresh
    if (block.totalTokens > this.config.contextRefreshThreshold) {
      return TokenClassification.ContextRefresh;
    }

    // Check if contains synthetic models
    if (block.models.some(model => model.includes('synthetic'))) {
      return TokenClassification.SyntheticAgent;
    }

    // Short duration with many tokens = likely context refresh
    if (block.duration < 60000 && block.totalTokens > 500000) { // < 1 minute, > 500k tokens
      return TokenClassification.ContextRefresh;
    }

    // Long duration with moderate tokens = likely user interaction
    if (block.duration > 300000 && block.totalTokens < 1000000) { // > 5 minutes, < 1M tokens
      return TokenClassification.UserInteraction;
    }

    // Multiple models in single block = likely complex interaction
    if (block.models.length > 2) {
      return TokenClassification.UserInteraction;
    }

    // Default based on size
    if (block.totalTokens >= this.config.minInteractionTokens) {
      return TokenClassification.UserInteraction;
    }

    return TokenClassification.SystemOverhead;
  }

  /**
   * Generate a cache key for a block
   */
  private generateCacheKey(block: CcusageBlock): string {
    return `${block.id}-${block.startTime}-${block.endTime}-${block.totalTokens}`;
  }
}