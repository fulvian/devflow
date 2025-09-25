/**
 * SemanticSearchEngine - Similarity search with performance optimization
 * Provides fast semantic similarity search with threshold filtering
 * Target: <50ms response time for typical queries
 */

import { SemanticMemoryEngine, MemoryRecord, MemorySearchOptions, MemorySearchResult } from './semantic-memory-engine';
import { OllamaEmbeddingService } from './ollama-embedding-service';

// Re-export for external use
export { MemorySearchResult };

export interface SearchQuery {
  query: string;
  projectId: number;
  contentTypes?: string[];
  similarityThreshold?: number;
  limit?: number;
  includeContent?: boolean;
}

export interface BatchSearchQuery {
  queries: string[];
  projectId: number;
  contentTypes?: string[];
  similarityThreshold?: number;
  limit?: number;
}

export interface SearchPerformanceMetrics {
  queryTime: number;
  embeddingTime: number;
  searchTime: number;
  resultsCount: number;
  totalMemories: number;
}

export interface BatchSearchResult {
  query: string;
  results: MemorySearchResult[];
  metrics: SearchPerformanceMetrics;
}

export class SemanticSearchEngine {
  private memoryEngine: SemanticMemoryEngine;
  private embedding: OllamaEmbeddingService;

  constructor() {
    this.memoryEngine = new SemanticMemoryEngine();
    this.embedding = new OllamaEmbeddingService();
  }

  /**
   * Perform semantic similarity search
   */
  async search(searchQuery: SearchQuery): Promise<MemorySearchResult[]> {
    const startTime = performance.now();

    try {
      // Generate query embedding
      const embeddingStartTime = performance.now();
      const queryEmbedding = await this.embedding.generateEmbedding(searchQuery.query);
      const embeddingTime = performance.now() - embeddingStartTime;

      // Get project memories
      const searchStartTime = performance.now();
      const memories = await this.memoryEngine.getProjectMemories(
        searchQuery.projectId,
        searchQuery.contentTypes
      );

      // Calculate similarities
      const results: MemorySearchResult[] = [];
      const threshold = searchQuery.similarityThreshold || 0.7;

      for (const memory of memories) {
        const similarity = await this.embedding.calculateSimilarity(
          queryEmbedding,
          memory.embeddingVector
        );

        if (similarity >= threshold) {
          results.push({
            memory: searchQuery.includeContent === false
              ? { ...memory, content: '' }
              : memory,
            similarity
          });
        }
      }

      // Sort by similarity (descending) and limit results
      results.sort((a, b) => b.similarity - a.similarity);
      const limitedResults = results.slice(0, searchQuery.limit || 10);

      const searchTime = performance.now() - searchStartTime;
      const totalTime = performance.now() - startTime;

      // Log performance metrics if query takes too long
      if (totalTime > 50) {
        console.warn(`Slow semantic search: ${totalTime.toFixed(2)}ms for ${memories.length} memories`);
      }

      return limitedResults;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Semantic search failed: ${message}`);
    }
  }

  /**
   * Batch search for multiple queries
   */
  async batchSearch(batchQuery: BatchSearchQuery): Promise<BatchSearchResult[]> {
    const results: BatchSearchResult[] = [];

    for (const query of batchQuery.queries) {
      const startTime = performance.now();

      const searchResults = await this.search({
        query,
        projectId: batchQuery.projectId,
        contentTypes: batchQuery.contentTypes,
        similarityThreshold: batchQuery.similarityThreshold,
        limit: batchQuery.limit
      });

      const totalTime = performance.now() - startTime;

      results.push({
        query,
        results: searchResults,
        metrics: {
          queryTime: totalTime,
          embeddingTime: 0, // Individual metrics not tracked in batch
          searchTime: 0,
          resultsCount: searchResults.length,
          totalMemories: 0
        }
      });
    }

    return results;
  }

  /**
   * Find memories similar to a given memory
   */
  async findSimilarMemories(
    memoryId: number,
    projectId: number,
    options?: {
      threshold?: number;
      limit?: number;
      excludeOriginal?: boolean;
    }
  ): Promise<MemorySearchResult[]> {
    try {
      const memories = await this.memoryEngine.getProjectMemories(projectId);
      const targetMemory = memories.find(m => m.id === memoryId);

      if (!targetMemory) {
        throw new Error(`Memory with ID ${memoryId} not found`);
      }

      const results: MemorySearchResult[] = [];
      const threshold = options?.threshold || 0.7;

      for (const memory of memories) {
        if (options?.excludeOriginal && memory.id === memoryId) {
          continue;
        }

        const similarity = await this.embedding.calculateSimilarity(
          targetMemory.embeddingVector,
          memory.embeddingVector
        );

        if (similarity >= threshold) {
          results.push({ memory, similarity });
        }
      }

      // Sort by similarity and limit
      results.sort((a, b) => b.similarity - a.similarity);
      return results.slice(0, options?.limit || 10);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Similar memory search failed: ${message}`);
    }
  }

  /**
   * Get search recommendations based on content analysis
   */
  async getSearchRecommendations(
    projectId: number,
    currentContent: string,
    options?: {
      maxRecommendations?: number;
      minSimilarity?: number;
      diversityFactor?: number;
    }
  ): Promise<MemorySearchResult[]> {
    try {
      const searchResults = await this.search({
        query: currentContent,
        projectId,
        similarityThreshold: options?.minSimilarity || 0.6,
        limit: (options?.maxRecommendations || 5) * 2 // Get more for diversity filtering
      });

      // Apply diversity filtering to avoid too similar recommendations
      return this.applyDiversityFilter(
        searchResults,
        options?.diversityFactor || 0.8,
        options?.maxRecommendations || 5
      );

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Search recommendations failed: ${message}`);
    }
  }

  /**
   * Apply diversity filtering to search results
   */
  private async applyDiversityFilter(
    results: MemorySearchResult[],
    diversityThreshold: number,
    maxResults: number
  ): Promise<MemorySearchResult[]> {
    if (results.length <= maxResults) {
      return results;
    }

    const diverseResults: MemorySearchResult[] = [results[0]]; // Always include the most similar

    for (let i = 1; i < results.length && diverseResults.length < maxResults; i++) {
      const candidate = results[i];
      let isDiverse = true;

      // Check if candidate is diverse enough from already selected results
      for (const selected of diverseResults) {
        const similarity = await this.embedding.calculateSimilarity(
          candidate.memory.embeddingVector,
          selected.memory.embeddingVector
        );

        if (similarity > diversityThreshold) {
          isDiverse = false;
          break;
        }
      }

      if (isDiverse) {
        diverseResults.push(candidate);
      }
    }

    return diverseResults;
  }

  /**
   * Performance benchmark for search operations
   */
  async benchmarkSearch(projectId: number, testQueries: string[]): Promise<SearchPerformanceMetrics[]> {
    const metrics: SearchPerformanceMetrics[] = [];

    for (const query of testQueries) {
      const startTime = performance.now();
      const results = await this.search({
        query,
        projectId,
        limit: 10
      });
      const totalTime = performance.now() - startTime;

      metrics.push({
        queryTime: totalTime,
        embeddingTime: 0, // Not tracked individually
        searchTime: 0,
        resultsCount: results.length,
        totalMemories: await this.memoryEngine.getMemoryCount(projectId)
      });
    }

    return metrics;
  }
}