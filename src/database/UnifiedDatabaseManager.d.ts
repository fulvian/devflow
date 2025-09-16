/**
 * DevFlow Unified Database Manager v1.0
 * Post-schema unification implementation
 * Addresses divergences between DatabaseManager and orchestrator services
 */
export interface UnifiedMemoryBlockEmbedding {
    id: string;
    memory_block_id: string;
    model_id: string;
    embedding_vector: Buffer;
    dimensions: number;
    created_at: Date;
    updated_at: Date;
}
export interface MemoryBlock {
    id: string;
    content: string;
    type: string;
    timestamp: string;
    embedding?: Buffer;
}
export declare class UnifiedDatabaseManager {
    private db;
    constructor(dbPath?: string);
    /**
     * Initialize unified schema (idempotent)
     */
    private initializeSchema;
    /**
     * Store embedding with unified schema
     */
    storeEmbedding(memoryBlockId: string, modelId: string, embeddingVector: Buffer, dimensions: number): string;
    /**
     * Retrieve embedding by memory block and model
     */
    getEmbedding(memoryBlockId: string, modelId: string): UnifiedMemoryBlockEmbedding | null;
    /**
     * Get all embeddings for a memory block
     */
    getEmbeddingsForBlock(memoryBlockId: string): UnifiedMemoryBlockEmbedding[];
    /**
     * Store memory block
     */
    storeMemoryBlock(id: string, content: string, type: string, timestamp: string, embedding?: Buffer): void;
    /**
     * Query memory blocks with embeddings
     */
    queryMemoryBlocks(options?: {
        type?: string;
        limit?: number;
        orderBy?: 'timestamp' | 'created_at';
    }): Array<MemoryBlock & {
        embeddings: UnifiedMemoryBlockEmbedding[];
    }>;
    /**
     * Batch operations for performance
     */
    batchStoreEmbeddings(embeddings: Array<{
        memoryBlockId: string;
        modelId: string;
        embeddingVector: Buffer;
        dimensions: number;
    }>): string[];
    /**
     * Search embeddings by similarity (requires cosine similarity implementation)
     */
    findSimilarEmbeddings(queryVector: Buffer, modelId: string, threshold?: number, limit?: number): Array<UnifiedMemoryBlockEmbedding & {
        similarity: number;
    }>;
    /**
     * Get database statistics
     */
    getStats(): {
        memoryBlocks: number;
        embeddings: number;
        models: number;
        averageEmbeddingsPerBlock: number;
    };
    /**
     * Cleanup and close database connection
     */
    close(): void;
}
export default UnifiedDatabaseManager;
//# sourceMappingURL=UnifiedDatabaseManager.d.ts.map