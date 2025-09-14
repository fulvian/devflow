/**
 * OllamaEmbeddingModel - Production embedding integration via Ollama
 * Implements EmbeddingModel interface for seamless DevFlow integration
 * 
 * Task: DEVFLOW-OLLAMA-002
 */

import { EmbeddingModel } from '../semantic-memory/semantic-memory-service';

/**
 * Configuration interface for Ollama embedding integration
 */
export interface OllamaEmbeddingConfig {
  /** Base URL for Ollama API */
  baseUrl?: string;
  /** Model name to use for embeddings */
  model?: string;
  /** Timeout for API requests in milliseconds */
  timeout?: number;
  /** Cache size for embedding results */
  cacheSize?: number;
  /** Batch size for processing multiple texts */
  batchSize?: number;
}

/**
 * Response structure from Ollama embeddings API
 */
interface OllamaEmbeddingResponse {
  /** Embedding vector */
  embedding: number[];
}

/**
 * Cache entry structure
 */
interface CacheEntry {
  embedding: number[];
  timestamp: number;
}

/**
 * OllamaEmbeddingModel - Production-ready embedding model using Ollama
 * Drop-in replacement for MockEmbeddingModel with enhanced capabilities
 */
export class OllamaEmbeddingModel implements EmbeddingModel {
  public readonly id: string = 'embeddinggemma-ollama';
  public readonly name: string = 'EmbeddingGemma via Ollama';
  public readonly dimensions: number = 768;

  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeout: number;
  private readonly batchSize: number;
  private readonly cache: Map<string, CacheEntry>;
  private readonly cacheSize: number;
  private readonly cacheTTL: number = 60 * 60 * 1000; // 1 hour

  /**
   * Creates a new OllamaEmbeddingModel instance
   * @param config Configuration options
   */
  constructor(config: OllamaEmbeddingConfig = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.model = config.model || 'embeddinggemma:300m';
    this.timeout = config.timeout || 30000;
    this.batchSize = config.batchSize || 10;
    this.cacheSize = config.cacheSize || 1000;
    
    // Initialize simple LRU cache
    this.cache = new Map();
  }

  /**
   * Generate embedding for a single text content
   * @param content Text content to embed
   * @returns Promise resolving to embedding vector
   */
  async generateEmbedding(content: string): Promise<number[]> {
    if (!content || content.trim().length === 0) {
      throw new Error('Content cannot be empty');
    }

    // Check cache first
    const cacheKey = this.getCacheKey(content);
    const cached = this.getCachedEmbedding(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Generate new embedding
      const embedding = await this.callOllamaAPI(content);
      
      // Store in cache
      this.setCachedEmbedding(cacheKey, embedding);
      
      return embedding;
    } catch (error) {
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   * @param embedding1 First embedding vector
   * @param embedding2 Second embedding vector
   * @returns Promise resolving to similarity score (0-1)
   */
  async calculateSimilarity(embedding1: number[], embedding2: number[]): Promise<number> {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embedding dimensions must match');
    }

    if (embedding1.length !== this.dimensions) {
      throw new Error(`Expected embeddings of ${this.dimensions} dimensions`);
    }

    // Calculate cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      const val1 = embedding1[i] || 0;
      const val2 = embedding2[i] || 0;
      
      dotProduct += val1 * val2;
      norm1 += val1 * val1;
      norm2 += val2 * val2;
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Check if Ollama service is healthy and model is available
   * @returns Promise resolving to health status
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // Quick health check

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return false;
      }

      const data = await response.json() as { models?: Array<{ name: string }> };
      
      // Check if our model exists
      return data.models?.some((model) => model.name === this.model) || false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   * @param texts Array of texts to embed
   * @returns Promise resolving to array of embeddings
   */
  async batchEmbed(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    // Process in batches
    const results: number[][] = [];
    const batches = this.createBatches(texts, this.batchSize);

    for (const batch of batches) {
      const batchPromises = batch.map(text => this.generateEmbedding(text));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Get cache statistics
   * @returns Cache statistics object
   */
  getCacheStats(): { size: number; hitRate: number; maxSize: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need hit/miss tracking for accurate calculation
      maxSize: this.cacheSize
    };
  }

  /**
   * Clear the embedding cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Call Ollama API to generate embedding
   * @param text Text to embed
   * @returns Promise resolving to embedding vector
   */
  private async callOllamaAPI(text: string): Promise<number[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          prompt: text
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as OllamaEmbeddingResponse;
      
      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error('Invalid embedding response from Ollama');
      }

      if (data.embedding.length !== this.dimensions) {
        throw new Error(`Expected ${this.dimensions} dimensions, got ${data.embedding.length}`);
      }

      return data.embedding;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout while generating embedding');
      }
      
      throw error;
    }
  }

  /**
   * Get cached embedding if available and not expired
   * @param cacheKey Cache key to lookup
   * @returns Cached embedding or null
   */
  private getCachedEmbedding(cacheKey: string): number[] | null {
    const entry = this.cache.get(cacheKey);
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.embedding;
  }

  /**
   * Store embedding in cache with LRU eviction
   * @param cacheKey Cache key
   * @param embedding Embedding to store
   */
  private setCachedEmbedding(cacheKey: string, embedding: number[]): void {
    // Implement simple LRU eviction
    if (this.cache.size >= this.cacheSize) {
      // Remove oldest entry (first key)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(cacheKey, {
      embedding: [...embedding], // Clone array
      timestamp: Date.now()
    });
  }

  /**
   * Generate cache key for text content
   * @param content Text content
   * @returns Cache key string
   */
  private getCacheKey(content: string): string {
    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `${this.model}:${hash.toString(36)}`;
  }

  /**
   * Create batches from array
   * @param items Array of items to batch
   * @param batchSize Size of each batch
   * @returns Array of batches
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }
}