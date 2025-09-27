// src/embedding/SyntheticEmbeddingModel.ts
import { EmbeddingModel } from './EmbeddingModel';
import { EmbeddingRequest, EmbeddingResponse } from '../types/embedding';
import { ConfigurationError, EmbeddingError } from '../errors/EmbeddingErrors';
import { logger } from '../utils/logger';

/**
 * Configuration interface for the Synthetic API
 */
export interface SyntheticAPIConfig {
  /** API endpoint URL */
  apiUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Model identifier */
  model: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Maximum batch size for requests */
  maxBatchSize?: number;
  /** Retry attempts for failed requests */
  maxRetries?: number;
}

/**
 * Production implementation of EmbeddingModel using Synthetic API
 * Provides cost-optimized batch processing for embedding generation
 */
export class SyntheticEmbeddingModel implements EmbeddingModel {
  private readonly config: SyntheticAPIConfig;
  private readonly defaultTimeout = 10000;
  private readonly defaultMaxBatchSize = 100;
  private readonly defaultMaxRetries = 3;

  constructor(config: SyntheticAPIConfig) {
    this.validateConfig(config);
    this.config = {
      timeout: this.defaultTimeout,
      maxBatchSize: this.defaultMaxBatchSize,
      maxRetries: this.defaultMaxRetries,
      ...config
    };
  }

  /**
   * Generate embeddings for a batch of texts
   * @param texts Array of texts to embed
   * @returns Array of embedding vectors
   */
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    try {
      // Optimize by batching requests to reduce API calls
      const batches = this.createBatches(texts);
      const results: number[][] = [];

      for (const batch of batches) {
        const embeddings = await this.processBatchWithRetry(batch);
        results.push(...embeddings);
      }

      return results;
    } catch (error: any) {
      logger.error('Failed to generate embeddings', { error, texts });
      throw new EmbeddingError(`Embedding generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate embedding for a single text
   * @param text Text to embed
   * @returns Embedding vector
   */
  async embedOne(text: string): Promise<number[]> {
    const results = await this.embed([text]);
    return results[0];
  }

  /**
   * Split texts into optimized batches based on maxBatchSize
   * @param texts Array of texts to batch
   * @returns Array of text batches
   */
  private createBatches(texts: string[]): string[][] {
    const batches: string[][] = [];
    const batchSize = this.config.maxBatchSize || this.defaultMaxBatchSize;

    for (let i = 0; i < texts.length; i += batchSize) {
      batches.push(texts.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Process a batch with retry logic
   * @param batch Batch of texts to process
   * @returns Embeddings for the batch
   */
  private async processBatchWithRetry(batch: string[]): Promise<number[][]> {
    let lastError: Error;

    for (let attempt = 0; attempt <= this.config.maxRetries!; attempt++) {
      try {
        return await this.processBatch(batch);
      } catch (error) {
        lastError = error;
        if (attempt < this.config.maxRetries!) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          logger.warn(`Embedding request failed, retrying in ${delay}ms`, { 
            attempt: attempt + 1, 
            error: error instanceof Error ? error.message : String(error)
          });
          await this.sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  /**
   * Process a single batch of texts
   * @param texts Texts to embed
   * @returns Embeddings for the texts
   */
  private async processBatch(texts: string[]): Promise<number[][]> {
    const requestBody: EmbeddingRequest = {
      model: this.config.model,
      input: texts
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new EmbeddingError(`API request failed with status ${response.status}: ${errorText}`);
      }

      const data: EmbeddingResponse = await response.json();
      
      if (!data.data || !Array.isArray(data.data)) {
        throw new EmbeddingError('Invalid response format from embedding API');
      }

      return data.data.map((item: any) => item.embedding);
    } catch (error) {
      clearTimeout(timeout);
      
      if (error.name === 'AbortError') {
        throw new EmbeddingError('Request timeout exceeded');
      }
      
      throw error as any;
    }
  }

  /**
   * Validate the configuration
   * @param config Configuration to validate
   */
  private validateConfig(config: SyntheticAPIConfig): void {
    if (!config.apiUrl) {
      throw new ConfigurationError('API URL is required');
    }
    
    if (!config.apiKey) {
      throw new ConfigurationError('API key is required');
    }
    
    if (!config.model) {
      throw new ConfigurationError('Model identifier is required');
    }
    
    if (config.timeout !== undefined && config.timeout <= 0) {
      throw new ConfigurationError('Timeout must be positive');
    }
    
    if (config.maxBatchSize !== undefined && config.maxBatchSize <= 0) {
      throw new ConfigurationError('Max batch size must be positive');
    }
    
    if (config.maxRetries !== undefined && config.maxRetries < 0) {
      throw new ConfigurationError('Max retries cannot be negative');
    }
  }

  /**
   * Utility function for sleep/delay
   * @param ms Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}