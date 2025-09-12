/**
 * Task ID: DEVFLOW-PROD-002-IMPL-B
 * 
 * Embedding model interface and production implementation using Synthetic API
 */

import { Logger } from '../utils/logger';

/**
 * Interface for embedding model implementations
 */
export interface EmbeddingModel {
  /**
   * Generate embeddings for the provided texts
   * @param texts - Array of texts to embed
   * @returns Promise resolving to array of embeddings
   */
  generateEmbeddings(texts: string[]): Promise<number[][]>;
  
  /**
   * Get the dimension of the embeddings
   * @returns The embedding dimension
   */
  getEmbeddingDimension(): number;
}

/**
 * Production implementation of EmbeddingModel using Synthetic API
 */
export class SyntheticEmbeddingModel implements EmbeddingModel {
  private readonly logger: Logger;
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly modelDimension: number;
  private readonly modelName: string;

  /**
   * Creates a new SyntheticEmbeddingModel instance
   * @param apiKey - API key for Synthetic service
   * @param apiUrl - Base URL for Synthetic API
   * @param modelName - Name of the embedding model to use
   * @param modelDimension - Dimension of the embeddings
   */
  constructor(
    apiKey: string,
    apiUrl: string = 'https://api.synthetic.com/v1',
    modelName: string = 'synthetic-embeddings-v1',
    modelDimension: number = 1536
  ) {
    this.logger = new Logger('SyntheticEmbeddingModel');
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
    this.modelName = modelName;
    this.modelDimension = modelDimension;
    
    if (!apiKey) {
      throw new Error('API key is required for SyntheticEmbeddingModel');
    }
  }

  /**
   * Generate embeddings for the provided texts using Synthetic API
   * @param texts - Array of texts to embed
   * @returns Promise resolving to array of embeddings
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      // Validate input
      if (!Array.isArray(texts) || texts.length === 0) {
        throw new Error('Input texts must be a non-empty array');
      }

      // Validate each text entry
      for (const [index, text] of texts.entries()) {
        if (typeof text !== 'string') {
          throw new Error(`Text at index ${index} is not a string`);
        }
        
        if (text.length === 0) {
          throw new Error(`Text at index ${index} is empty`);
        }
      }

      this.logger.debug(`Generating embeddings for ${texts.length} texts`);

      // Prepare request payload
      const payload = {
        model: this.modelName,
        input: texts
      };

      // Make API request to Synthetic service
      const response = await fetch(`${this.apiUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      // Handle non-success responses
      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Synthetic API error: ${response.status} - ${errorText}`);
        
        switch (response.status) {
          case 401:
            throw new Error('Unauthorized: Invalid API key');
          case 400:
            throw new Error(`Bad Request: ${errorText}`);
          case 429:
            throw new Error('Rate limit exceeded');
          case 500:
            throw new Error('Synthetic API internal server error');
          default:
            throw new Error(`Synthetic API error: ${response.status} - ${errorText}`);
        }
      }

      // Parse response
      const data = await response.json();
      
      // Validate response structure
      if (!data || !Array.isArray(data.data)) {
        throw new Error('Invalid response format from Synthetic API');
      }

      // Extract embeddings from response
      const embeddings: number[][] = data.data
        .sort((a: any, b: any) => a.index - b.index)
        .map((item: any) => {
          if (!Array.isArray(item.embedding)) {
            throw new Error('Invalid embedding format in response');
          }
          return item.embedding;
        });

      this.logger.debug(`Successfully generated ${embeddings.length} embeddings`);
      return embeddings;

    } catch (error) {
      this.logger.error('Error generating embeddings:', error);
      
      if (error instanceof Error) {
        throw new Error(`Failed to generate embeddings: ${error.message}`);
      }
      
      throw new Error('Failed to generate embeddings: Unknown error');
    }
  }

  /**
   * Get the dimension of the embeddings
   * @returns The embedding dimension
   */
  getEmbeddingDimension(): number {
    return this.modelDimension;
  }
}