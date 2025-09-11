import type { MemoryBlock, KnowledgeEntity, SemanticSearchResult, SemanticSearchOptions } from '@devflow/shared';
/**
 * VectorEmbeddingService - Multi-model vector embedding service
 * Production-ready implementation con semantic search e caching
 */
export interface EmbeddingProvider {
    name: string;
    model: string;
    dimensions: number;
    maxTokens: number;
    costPer1kTokens: number;
}
export interface EmbeddingResponse {
    embedding: Float32Array;
    model: string;
    tokens: number;
    provider: string;
}
export interface SimilarityMatch {
    id: string;
    similarity: number;
    content: string;
    metadata: Record<string, unknown>;
}
export interface BatchEmbeddingResult {
    embeddings: Float32Array[];
    totalTokens: number;
    errors: Array<{
        index: number;
        error: string;
    }>;
}
export declare class VectorEmbeddingService {
    private readonly defaultModel;
    private readonly openaiApiKey?;
    private db;
    private cache;
    private readonly CACHE_TTL;
    private readonly apiKeyAvailable;
    private readonly providers;
    constructor(defaultModel?: string, openaiApiKey?: string | undefined, dbPath?: string);
    /**
     * Initialize database tables for embeddings
     */
    private initializeDatabase;
    /**
     * Generate embeddings for single text using specified model
     */
    generateEmbeddings(text: string, model?: string): Promise<EmbeddingResponse>;
    /**
     * Check if vector embeddings are available
     */
    isVectorSearchAvailable(): boolean;
    /**
     * Convenience method for embedding text
     */
    embedText(text: string, model?: string): Promise<Float32Array>;
    /**
     * Batch processing for multiple texts
     */
    generateBatchEmbeddings(texts: string[], model?: string): Promise<BatchEmbeddingResult>;
    /**
     * Store embedding for MemoryBlock
     */
    storeMemoryBlockEmbedding(blockId: string, embedding: Float32Array, model?: string): Promise<void>;
    /**
     * Store embeddings for multiple MemoryBlocks
     */
    storeMemoryBlockEmbeddings(blocks: MemoryBlock[]): Promise<void>;
    /**
     * Store embedding for KnowledgeEntity
     */
    storeEntityEmbedding(entityId: string, embedding: Float32Array, model?: string): Promise<void>;
    /**
     * Store embeddings for multiple KnowledgeEntities
     */
    storeEntityEmbeddings(entities: KnowledgeEntity[]): Promise<void>;
    /**
     * Retrieve MemoryBlock embedding
     */
    getMemoryBlockEmbedding(blockId: string, model?: string): Promise<Float32Array | null>;
    /**
     * Retrieve KnowledgeEntity embedding
     */
    getEntityEmbedding(entityId: string, model?: string): Promise<Float32Array | null>;
    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(a: Float32Array, b: Float32Array): number;
    /**
     * Find similar MemoryBlocks using cosine similarity
     */
    findSimilarMemoryBlocks(queryEmbedding: Float32Array, options?: SemanticSearchOptions): Promise<SemanticSearchResult[]>;
    /**
     * Semantic search using text query
     */
    semanticSearch(query: string, options?: SemanticSearchOptions): Promise<SemanticSearchResult[]>;
    /**
     * Clean up expired cache entries
     */
    clearExpiredCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        hitRate: number;
        memoryUsage: number;
    };
    /**
     * Call OpenAI embedding API
     */
    private callEmbeddingAPI;
    /**
     * Simple text hashing for cache keys
     */
    private hashText;
    /**
     * Estimate token count for text
     */
    private estimateTokens;
    /**
     * Extract context snippet from text
     */
    private extractContext;
    /**
     * Dispose resources and cleanup
     */
    dispose(): void;
}
//# sourceMappingURL=VectorEmbeddingService.d.ts.map