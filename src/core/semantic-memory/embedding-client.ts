// src/core/semantic-memory/embedding-client.ts
import OpenAI from 'openai';

/**
 * OpenAI Embeddings API Client
 * Handles vector generation for semantic memory system
 */

interface EmbeddingConfig {
  apiKey?: string;
  model?: string;
  dimensions?: number;
  maxRetries?: number;
  timeout?: number;
}

interface EmbeddingResult {
  vector: number[];
  tokens: number;
  model: string;
  dimensions: number;
}

export class EmbeddingClient {
  private client: OpenAI;
  private readonly model: string;
  private readonly dimensions: number;
  private readonly maxRetries: number;
  private readonly timeout: number;

  constructor(config: EmbeddingConfig = {}) {
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY
    });

    this.model = config.model || 'text-embedding-3-small';
    this.dimensions = config.dimensions || 1536;
    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 30000;
  }

  /**
   * Generate embedding vector for single text input
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    if (!text?.trim()) {
      throw new Error('Text input cannot be empty');
    }

    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text.trim(),
        dimensions: this.dimensions,
      });

      const embedding = response.data[0];
      if (!embedding?.embedding) {
        throw new Error('No embedding returned from OpenAI API');
      }

      return {
        vector: embedding.embedding,
        tokens: response.usage?.total_tokens || 0,
        model: this.model,
        dimensions: embedding.embedding.length
      };
    } catch (error) {
      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Generate embeddings for multiple text inputs (batch processing)
   */
  async generateBatchEmbeddings(texts: string[], batchSize: number = 100): Promise<EmbeddingResult[]> {
    if (!texts.length) {
      return [];
    }

    const results: EmbeddingResult[] = [];
    const validTexts = texts.filter(text => text?.trim()).map(text => text.trim());

    // Process in batches to respect API limits
    for (let i = 0; i < validTexts.length; i += batchSize) {
      const batch = validTexts.slice(i, i + batchSize);

      try {
        const response = await this.client.embeddings.create({
          model: this.model,
          input: batch,
          dimensions: this.dimensions,
        });

        const batchResults = response.data.map(embedding => ({
          vector: embedding.embedding,
          tokens: response.usage?.total_tokens || 0,
          model: this.model,
          dimensions: embedding.embedding.length
        }));

        results.push(...batchResults);
      } catch (error) {
        throw new Error(`Batch embedding failed: ${error instanceof Error ? error.message : error}`);
      }
    }

    return results;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  calculateSimilarity(vector1: number[], vector2: number[]): number {
    if (vector1.length !== vector2.length) {
      throw new Error('Vectors must have same dimensions');
    }

    const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
    const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Validate API configuration and connectivity
   */
  async validateConnection(): Promise<boolean> {
    try {
      await this.generateEmbedding('test connection');
      return true;
    } catch (error) {
      console.warn('OpenAI API connection validation failed:', error);
      return false;
    }
  }
}

export default EmbeddingClient;