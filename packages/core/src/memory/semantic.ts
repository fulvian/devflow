import type { 
  MemoryBlock, 
  SemanticSearchOptions, 
  SemanticSearchResult,
  HybridSearchOptions,
  HybridSearchResult
} from '@devflow/shared';
import { SearchService } from './search.js';
import { VectorEmbeddingService } from '../ml/VectorEmbeddingService.js';
import type Database from 'better-sqlite3';

/**
 * SemanticSearchService - Hybrid semantic search combining FTS5 keyword search with vector similarity
 * Implements configurable fusion algorithms for optimal hybrid ranking
 */
export class SemanticSearchService {
  constructor(
    private readonly db: Database.Database,
    private readonly searchService: SearchService,
    private readonly vectorService: VectorEmbeddingService
  ) {}

  /**
   * Primary hybrid search interface combining FTS5 and vector search
   */
  async hybridSearch(
    query: string,
    options: HybridSearchOptions = {}
  ): Promise<HybridSearchResult[]> {
    const {
      mode = 'hybrid',
      weights = { keyword: 0.5, semantic: 0.5 },
      fusionMethod = 'weighted',
      threshold = 0.0,
      maxResults = 20,
      blockTypes,
      taskIds
    } = options;

    // Check if vector search is available
    const vectorSearchAvailable = this.vectorService.isVectorSearchAvailable();

    // Handle different search modes
    switch (mode) {
      case 'keyword-only':
        return this.keywordSearch(query, options);
      case 'vector-only':
        if (!vectorSearchAvailable) {
          console.warn('Vector search not available (no API key). Falling back to keyword search.');
          return this.keywordSearch(query, options);
        }
        return this.vectorSearch(query, options);
      case 'hybrid':
      default:
        // If vector search is not available, fall back to keyword-only
        if (!vectorSearchAvailable) {
          console.warn('Vector search not available (no API key). Using keyword-only search.');
          return this.keywordSearch(query, options);
        }

        // Execute both searches in parallel for performance
        const [keywordResults, vectorResults] = await Promise.all([
          this.searchService.fullText(query, maxResults * 2), // Get more keyword results for better hybrid ranking
          this.vectorService.semanticSearch(query, { 
            maxResults: maxResults * 2, 
            threshold, 
            blockTypes: blockTypes || [], 
            taskIds: taskIds || [] 
          }).catch(error => {
            console.warn('Vector search failed, falling back to keyword-only:', error.message);
            return [];
          })
        ]);

        // If vector search failed, use keyword results only
        if (vectorResults.length === 0) {
          return this.keywordSearch(query, options);
        }

        // Normalize scores to [0,1] range
        const normalizedKeywordScores = this.normalizeBM25Scores(keywordResults);
        const normalizedVectorScores = this.normalizeSimilarityScores(vectorResults);

        // Combine and deduplicate results
        const mergedResults = this.mergeResults(keywordResults, vectorResults);

        // Apply hybrid scoring algorithm
        const hybridResults = mergedResults.map(result => {
          const keywordScore = normalizedKeywordScores.get(result.id) || 0;
          const semanticScore = normalizedVectorScores.get(result.id) || 0;
          const hybridScore = this.calculateHybridScore(keywordScore, semanticScore, weights, fusionMethod);
          
          // Apply importance weighting
          const importanceWeightedScore = hybridScore * result.importanceScore;

          return {
            block: result,
            similarity: hybridScore, // Add required similarity property
            scores: {
              keyword: keywordScore,
              semantic: semanticScore,
              hybrid: hybridScore,
              importance: result.importanceScore
            },
            matchType: this.determineMatchType(result.id, keywordResults, vectorResults),
            keywordMatches: this.extractKeywordMatches(result.id, keywordResults),
            semanticContext: this.extractSemanticContext(result.content, 100),
            explanation: this.generateRankingExplanation(keywordScore, semanticScore, hybridScore, fusionMethod),
            relevanceScore: importanceWeightedScore,
            context: result.content.substring(0, 200)
          } as HybridSearchResult;
        });

        // Sort by hybrid score and apply limits
        return hybridResults
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .slice(0, maxResults);
    }
  }

  /**
   * Pure keyword search using FTS5
   */
  async keywordSearch(
    query: string,
    options: SemanticSearchOptions = {}
  ): Promise<HybridSearchResult[]> {
    const limit = options.maxResults ?? 20;
    const keywordResults = this.searchService.fullText(query, limit);

    return keywordResults.map(block => ({
      block,
      similarity: 1.0, // Add required similarity property
      scores: {
        keyword: 1.0, // Maximum keyword score since these are FTS5 matches
        semantic: 0.0,
        hybrid: 1.0,
        importance: block.importanceScore
      },
      matchType: 'keyword',
      keywordMatches: [query], // Simplified - would need to extract actual matches
      semanticContext: '',
      explanation: 'Ranked by FTS5 BM25 keyword matching',
      relevanceScore: block.importanceScore,
      context: block.content.substring(0, 200)
    }));
  }

  /**
   * Pure vector similarity search
   */
  async vectorSearch(
    query: string,
    options: SemanticSearchOptions = {}
  ): Promise<HybridSearchResult[]> {
    try {
      const vectorResults = await this.vectorService.semanticSearch(query, options);

      return vectorResults.map(result => ({
        block: result.block,
        similarity: result.similarity, // Add required similarity property
        scores: {
          keyword: 0.0,
          semantic: result.similarity,
          hybrid: result.similarity,
          importance: result.block.importanceScore
        },
        matchType: 'semantic',
        keywordMatches: [],
        semanticContext: this.extractSemanticContext(result.block.content, 100),
        explanation: `Ranked by cosine similarity: ${result.similarity.toFixed(3)}`,
        relevanceScore: result.relevanceScore,
        context: result.context
      }));
    } catch (error) {
      console.warn('Vector search failed:', error instanceof Error ? error.message : 'Unknown error');
      // Return empty results instead of throwing
      return [];
    }
  }

  /**
   * Normalize BM25 scores to [0,1] range
   */
  private normalizeBM25Scores(results: MemoryBlock[]): Map<string, number> {
    if (results.length === 0) return new Map();

    // For FTS5 results, we use a simple approach since BM25 scores can be negative
    // We'll treat higher (less negative) scores as better
    const scores = results.map(block => {
      // FTS5 rank is in bm25 column - for simplicity, we'll use a basic normalization
      // In practice, you might want to use the actual bm25 scores from the FTS5 query
      return { id: block.id, score: block.importanceScore }; // Using importance as proxy
    });

    const maxScore = Math.max(...scores.map(s => s.score));
    const minScore = Math.min(...scores.map(s => s.score));
    const range = maxScore - minScore || 1; // Avoid division by zero

    const normalized = new Map<string, number>();
    for (const { id, score } of scores) {
      normalized.set(id, (score - minScore) / range);
    }

    return normalized;
  }

  /**
   * Normalize cosine similarity scores to [0,1] range
   */
  private normalizeSimilarityScores(results: SemanticSearchResult[]): Map<string, number> {
    if (results.length === 0) return new Map();

    // Cosine similarity is already in [-1,1] range, but typically [0,1] for our use case
    // We'll map [threshold,1] to [0,1] where threshold is the minimum similarity
    const minScore = Math.min(...results.map(r => r.similarity));
    const maxScore = Math.max(...results.map(r => r.similarity));
    const range = maxScore - minScore || 1; // Avoid division by zero

    const normalized = new Map<string, number>();
    for (const result of results) {
      normalized.set(result.block.id, (result.similarity - minScore) / range);
    }

    return normalized;
  }

  /**
   * Merge keyword and vector search results, handling duplicates
   */
  private mergeResults(keywordResults: MemoryBlock[], vectorResults: SemanticSearchResult[]): MemoryBlock[] {
    const merged = new Map<string, MemoryBlock>();

    // Add keyword results
    for (const block of keywordResults) {
      merged.set(block.id, block);
    }

    // Add vector results, preferring vector results when duplicates exist (they have embeddings)
    for (const result of vectorResults) {
      const existing = merged.get(result.block.id);
      if (existing) {
        // Merge: prefer the vector result's embedding and metadata
        merged.set(result.block.id, {
          ...existing,
          embedding: result.block.embedding ?? existing.embedding,
          embeddingModel: result.block.embeddingModel ?? existing.embeddingModel
        });
      } else {
        merged.set(result.block.id, result.block);
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Calculate hybrid score using configurable fusion method
   */
  private calculateHybridScore(
    keywordScore: number,
    semanticScore: number,
    weights: { keyword: number, semantic: number },
    method: 'weighted' | 'harmonic' | 'geometric'
  ): number {
    // Ensure weights sum to 1
    const totalWeight = weights.keyword + weights.semantic;
    const normalizedWeights = {
      keyword: totalWeight > 0 ? weights.keyword / totalWeight : 0.5,
      semantic: totalWeight > 0 ? weights.semantic / totalWeight : 0.5
    };

    switch (method) {
      case 'weighted':
        return normalizedWeights.keyword * keywordScore + normalizedWeights.semantic * semanticScore;
      
      case 'harmonic':
        if (keywordScore === 0 || semanticScore === 0) return 0;
        return 2 / (1/keywordScore + 1/semanticScore);
      
      case 'geometric':
        return Math.sqrt(keywordScore * semanticScore);
      
      default:
        return normalizedWeights.keyword * keywordScore + normalizedWeights.semantic * semanticScore;
    }
  }

  /**
   * Determine match type for result
   */
  private determineMatchType(
    blockId: string,
    keywordResults: MemoryBlock[],
    vectorResults: SemanticSearchResult[]
  ): 'keyword' | 'semantic' | 'both' {
    const inKeyword = keywordResults.some(b => b.id === blockId);
    const inVector = vectorResults.some(r => r.block.id === blockId);

    if (inKeyword && inVector) return 'both';
    if (inKeyword) return 'keyword';
    return 'semantic';
  }

  /**
   * Extract keyword matches for a block
   */
  private extractKeywordMatches(blockId: string, keywordResults: MemoryBlock[]): string[] {
    // Simplified - in practice would extract actual matched terms from FTS5
    const block = keywordResults.find(b => b.id === blockId);
    return block ? [block.label] : [];
  }

  /**
   * Extract semantic context snippet
   */
  private extractSemanticContext(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Generate human-readable ranking explanation
   */
  private generateRankingExplanation(
    keywordScore: number,
    semanticScore: number,
    hybridScore: number,
    method: string
  ): string {
    return `Hybrid score ${hybridScore.toFixed(3)} using ${method} fusion (keyword: ${keywordScore.toFixed(3)}, semantic: ${semanticScore.toFixed(3)})`;
  }
}