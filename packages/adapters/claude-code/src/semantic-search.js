import { VectorEmbeddingService } from '@devflow/core';
import { SQLiteMemoryManager } from '@devflow/core';
export class SemanticSearchService {
    embeddingService;
    memoryManager;
    constructor() {
        this.embeddingService = new VectorEmbeddingService();
        this.memoryManager = new SQLiteMemoryManager();
    }
    async search(query, threshold = 0.7) {
        const queryEmbedding = await this.embeddingService.generateEmbedding(query);
        // Implementation would search through stored embeddings
        return [];
    }
    async storeDocument(content, metadata) {
        const embedding = await this.embeddingService.generateEmbedding(content);
        // Store in memory with metadata
        return await this.memoryManager.set(`doc_${Date.now()}`, { content, embedding, metadata });
    }
}
//# sourceMappingURL=semantic-search.js.map