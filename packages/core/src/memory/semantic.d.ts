import type { SemanticSearchOptions, HybridSearchOptions, HybridSearchResult } from '@devflow/shared';
import { SearchService } from './search.js';
import { VectorEmbeddingService } from '../ml/VectorEmbeddingService.js';
import type Database from 'better-sqlite3';
/**
 * SemanticSearchService - Hybrid semantic search combining FTS5 keyword search with vector similarity
 * Implements configurable fusion algorithms for optimal hybrid ranking
 */
export declare class SemanticSearchService {
    private readonly _db;
    private readonly searchService;
    private readonly vectorService;
    constructor(_db: Database.Database, searchService: SearchService, vectorService: VectorEmbeddingService);
    /**
     * Primary hybrid search interface combining FTS5 and vector search
     */
    hybridSearch(query: string, options?: HybridSearchOptions): Promise<HybridSearchResult[]>;
    /**
     * Pure keyword search using FTS5
     */
    keywordSearch(query: string, options?: SemanticSearchOptions): Promise<HybridSearchResult[]>;
    /**
     * Pure vector similarity search
     */
    vectorSearch(query: string, options?: SemanticSearchOptions): Promise<HybridSearchResult[]>;
    /**
     * Normalize BM25 scores to [0,1] range
     */
    private normalizeBM25Scores;
    /**
     * Normalize cosine similarity scores to [0,1] range
     */
    private normalizeSimilarityScores;
    /**
     * Merge keyword and vector search results, handling duplicates
     */
    private mergeResults;
    /**
     * Calculate hybrid score using configurable fusion method
     */
    private calculateHybridScore;
    /**
     * Determine match type for result
     */
    private determineMatchType;
    /**
     * Extract keyword matches for a block
     */
    private extractKeywordMatches;
    /**
     * Extract semantic context snippet
     */
    private extractSemanticContext;
    /**
     * Generate human-readable ranking explanation
     */
    private generateRankingExplanation;
}
//# sourceMappingURL=semantic.d.ts.map