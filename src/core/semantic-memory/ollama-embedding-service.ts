/**
 * OllamaEmbeddingService - Local Ollama embeddinggemma integration
 * Provides cost-free embeddings using local Ollama embeddinggemma:300m model
 * Implements EmbeddingModel interface for seamless integration
 */

import { EmbeddingModel, EmbeddingError } from './semantic-memory-service';

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  timeout: number;
  maxRetries: number;
}

export interface OllamaEmbeddingRequest {
  model: string;
  input: string;
}

export interface OllamaEmbeddingResponse {
  embeddings: number[][];
}

export class OllamaEmbeddingService implements EmbeddingModel {
  public readonly id = 'ollama-embeddinggemma';
  public readonly name = 'Ollama EmbeddingGemma 300M';
  public readonly dimensions = 768; // embeddinggemma:300m actual dimensions

  private config: OllamaConfig;

  constructor(config?: Partial<OllamaConfig>) {
    this.config = {
      baseUrl: 'http://localhost:11434',
      model: 'embeddinggemma:300m',
      timeout: 30000,
      maxRetries: 3,
      ...config
    };
  }

  /**
   * Generate embedding vector for text content using Ollama
   */
  async generateEmbedding(content: string): Promise<number[]> {
    if (!content?.trim()) {
      throw new EmbeddingError('Content cannot be empty');
    }

    try {
      const embedding = await this.callOllamaWithRetry(content.trim());

      if (!embedding || embedding.length !== this.dimensions) {
        throw new EmbeddingError(`Expected ${this.dimensions} dimensions, got ${embedding?.length || 0}`);
      }

      return embedding;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new EmbeddingError(`Failed to generate embedding: ${message}`);
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  async calculateSimilarity(embedding1: number[], embedding2: number[]): Promise<number> {
    if (embedding1.length !== embedding2.length) {
      throw new EmbeddingError('Embedding dimensions must match');
    }

    const dotProduct = embedding1.reduce((sum, a, i) => sum + a * embedding2[i], 0);
    const magnitude1 = Math.sqrt(embedding1.reduce((sum, a) => sum + a * a, 0));
    const magnitude2 = Math.sqrt(embedding2.reduce((sum, a) => sum + a * a, 0));

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Call Ollama API with retry logic
   */
  private async callOllamaWithRetry(content: string): Promise<number[]> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(`${this.config.baseUrl}/api/embed`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.config.model,
            input: content
          } as OllamaEmbeddingRequest),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json() as OllamaEmbeddingResponse;

        if (!result.embeddings || result.embeddings.length === 0) {
          throw new Error('No embeddings returned from Ollama');
        }

        return result.embeddings[0];
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.config.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new EmbeddingError(`Ollama request failed after ${this.config.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Test Ollama service availability
   */
  async testConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) return false;

      const models = await response.json() as { models?: { name: string }[] };
      return models.models?.some((model) => model.name === this.config.model) || false;
    } catch {
      return false;
    }
  }
}