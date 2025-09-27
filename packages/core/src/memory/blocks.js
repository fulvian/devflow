import { Queries } from '../database/queries.js';
import { VectorEmbeddingService } from '../ml/VectorEmbeddingService.js';
export class BlockService {
    q;
    vectorService;
    constructor(db, vectorService) {
        this.q = new Queries(db);
        this.vectorService = vectorService || new VectorEmbeddingService();
    }
    async create(block) {
        // Store the memory block first
        const blockId = this.q.storeMemoryBlock(block);
        // Generate vector embedding asynchronously for real-time indexing
        this.generateEmbeddingAsync(blockId, block.content, block.label);
        return blockId;
    }
    // Synchronous version for backward compatibility
    createSync(block) {
        return this.q.storeMemoryBlock(block);
    }
    async generateEmbeddingAsync(blockId, content, label) {
        try {
            // Combine content and label for embedding generation
            const textToEmbed = `${label}\n\n${content}`;
            // Generate embedding using VectorEmbeddingService
            const embeddingResponse = await this.vectorService.generateEmbeddings(textToEmbed);
            // Store the embedding in the vector service's database
            await this.vectorService.storeMemoryBlockEmbedding(blockId, embeddingResponse.embedding, embeddingResponse.model);
            // Update the memory block with embedding model info
            this.q.updateMemoryBlock(blockId, {
                embeddingModel: embeddingResponse.model
            });
        }
        catch (error) {
            // Log error but don't fail the block creation
            console.warn(`Failed to generate embedding for memory block ${blockId}:`, error instanceof Error ? error.message : 'Unknown error');
        }
    }
    find(query) {
        return this.q.retrieveMemoryBlocks(query);
    }
    update(id, updates) {
        this.q.updateMemoryBlock(id, updates);
    }
    remove(id) {
        this.q.deleteMemoryBlock(id);
    }
    getAllBlocks(taskId) {
        if (taskId) {
            return this.q.retrieveMemoryBlocks({ taskId: taskId });
        }
        return this.q.retrieveMemoryBlocks({});
    }
}
//# sourceMappingURL=blocks.js.map