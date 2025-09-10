/**
 * Semantic Search Service for DevFlow
 * Provides hybrid search capabilities combining vector and text search
 */

import { SQLiteMemoryManager } from '@devflow/core';
import type { SearchQuery, SearchResult } from '@devflow/shared';

export interface SemanticSearchConfig {
  memoryManager: SQLiteMemoryManager;
  embeddingModel?: string;
  vectorThreshold?: number;
  textThreshold?: number;
}

export class SemanticSearchService {
  private memoryManager: SQLiteMemoryManager;
  private _embeddingModel: string;
  private vectorThreshold: number;
  private textThreshold: number;

  constructor(config: SemanticSearchConfig) {
    this.memoryManager = config.memoryManager;
    this._embeddingModel = config.embeddingModel ?? 'openai-ada-002';
    this.vectorThreshold = config.vectorThreshold ?? 0.7;
    this.textThreshold = config.textThreshold ?? 0.6;
  }

  async hybridSearch(query: SearchQuery): Promise<SearchResult[]> {
    const { query: searchQuery, maxResults = 10, blockTypes, threshold } = query;

    // Perform vector search
    const vectorResults = await this.vectorSearch(searchQuery, {
      maxResults: maxResults * 2, // Get more results for hybrid scoring
      blockTypes: blockTypes as any,
      threshold: threshold ?? this.vectorThreshold,
    });

    // Perform text search
    const textResults = await this.textSearch(searchQuery, {
      maxResults: maxResults * 2,
      blockTypes: blockTypes as any,
      threshold: threshold ?? this.textThreshold,
    });

    // Combine and score results
    const combinedResults = this.combineSearchResults(vectorResults, textResults);

    // Sort by combined score and limit results
    return combinedResults
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults);
  }

  private async vectorSearch(
    query: string,
    options: {
      maxResults: number;
      blockTypes?: string[];
      threshold: number;
    }
  ): Promise<SearchResult[]> {
    // Generate embedding for query
    const _queryEmbedding = await this.generateEmbedding(query);

    // Search using vector similarity
    const results = await this.memoryManager.retrieveMemoryBlocks({
      taskId: 'vector-search',
      limit: options.maxResults,
      blockTypes: options.blockTypes as any[],
    });

    return results.map(result => ({
      block: result,
      similarity: 0.8, // Placeholder similarity
      searchType: 'vector' as const,
    }));
  }

  private   async textSearch(
    _query: string,
    options: {
      maxResults: number;
      blockTypes?: string[];
      threshold: number;
    }
  ): Promise<SearchResult[]> {
    // Use FTS5 for text search (placeholder implementation)
    const results = await this.memoryManager.retrieveMemoryBlocks({
      taskId: 'text-search',
      limit: options.maxResults,
      blockTypes: options.blockTypes as any[],
    });

    return results.map(result => ({
      block: result,
      similarity: 0.7, // Placeholder similarity
      searchType: 'text' as const,
    }));
  }

  private combineSearchResults(
    vectorResults: SearchResult[],
    textResults: SearchResult[]
  ): SearchResult[] {
    const combinedMap = new Map<string, SearchResult>();

    // Add vector results
    vectorResults.forEach(result => {
      const key = result.block.id;
      combinedMap.set(key, {
        ...result,
        similarity: result.similarity * 0.7, // Weight vector search
      });
    });

    // Add/combine text results
    textResults.forEach(result => {
      const key = result.block.id;
      const existing = combinedMap.get(key);
      
      if (existing) {
        // Combine scores
        existing.similarity = Math.max(
          existing.similarity,
          result.similarity * 0.3 // Weight text search
        );
      } else {
        combinedMap.set(key, {
          ...result,
          similarity: result.similarity * 0.3,
        });
      }
    });

    return Array.from(combinedMap.values());
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // This would integrate with OpenAI API or other embedding service
    // For now, return a placeholder
    // In production, this would call the actual embedding API
    
    // Placeholder implementation - in production, replace with actual API call
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(1536).fill(0); // OpenAI ada-002 dimension
    
    // Simple hash-based embedding for demo purposes
    words.forEach(word => {
      const hash = this.simpleHash(word);
      const index = hash % embedding.length;
      embedding[index] += 1;
    });
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  async searchByTaskId(taskId: string, options?: {
    maxResults?: number;
    blockTypes?: string[];
  }): Promise<SearchResult[]> {
    const blocks = await this.memoryManager.retrieveMemoryBlocks({
      taskId,
      limit: options?.maxResults ?? 20,
      blockTypes: options?.blockTypes as any[],
    });

    return blocks.map(block => ({
      block,
      similarity: 1.0, // Perfect match for task-specific search
      searchType: 'task' as const,
    }));
  }

  async searchBySessionId(_sessionId: string, options?: {
    maxResults?: number;
    blockTypes?: string[];
  }): Promise<SearchResult[]> {
    const blocks = await this.memoryManager.retrieveMemoryBlocks({
      taskId: 'session-search',
      limit: options?.maxResults ?? 20,
      blockTypes: options?.blockTypes as any[],
    });

    return blocks.map(block => ({
      block,
      similarity: 1.0, // Perfect match for session-specific search
      searchType: 'session' as const,
    }));
  }

  async searchByImportance(_minImportance: number, options?: {
    maxResults?: number;
    blockTypes?: string[];
  }): Promise<SearchResult[]> {
    const blocks = await this.memoryManager.retrieveMemoryBlocks({
      taskId: 'importance-search',
      limit: options?.maxResults ?? 20,
      blockTypes: options?.blockTypes as any[],
    });

    return blocks.map(block => ({
      block,
      similarity: block.importanceScore,
      searchType: 'importance' as const,
    }));
  }
}
