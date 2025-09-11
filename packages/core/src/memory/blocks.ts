import type Database from 'better-sqlite3';
import type { MemoryBlock, MemoryQuery } from '@devflow/shared';
import { Queries } from '../database/queries.js';
import { VectorEmbeddingService } from '../ml/VectorEmbeddingService.js';

export class BlockService {
  private q: Queries;
  private vectorService: VectorEmbeddingService;
  
  constructor(db: Database.Database, vectorService?: VectorEmbeddingService) {
    this.q = new Queries(db);
    this.vectorService = vectorService || new VectorEmbeddingService();
  }

  async create(block: Omit<MemoryBlock, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>): Promise<string> {
    // Store the memory block first
    const blockId = this.q.storeMemoryBlock(block);
    
    // Generate vector embedding asynchronously for real-time indexing
    this.generateEmbeddingAsync(blockId, block.content, block.label);
    
    return blockId;
  }

  // Synchronous version for backward compatibility
  createSync(block: Omit<MemoryBlock, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>): string {
    return this.q.storeMemoryBlock(block);
  }

  private async generateEmbeddingAsync(blockId: string, content: string, label: string): Promise<void> {
    try {
      // Combine content and label for embedding generation
      const textToEmbed = `${label}\n\n${content}`;
      
      // Generate embedding using VectorEmbeddingService
      const embeddingResponse = await this.vectorService.generateEmbeddings(textToEmbed);
      
      // Store the embedding in the vector service's database
      await this.vectorService.storeMemoryBlockEmbedding(
        blockId, 
        embeddingResponse.embedding, 
        embeddingResponse.model
      );
      
      // Update the memory block with embedding model info
      this.q.updateMemoryBlock(blockId, { 
        embeddingModel: embeddingResponse.model 
      });
      
    } catch (error) {
      // Log error but don't fail the block creation
      console.warn(`Failed to generate embedding for memory block ${blockId}:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  find(query: MemoryQuery): MemoryBlock[] {
    return this.q.retrieveMemoryBlocks(query);
  }

  update(id: string, updates: Partial<MemoryBlock>): void {
    this.q.updateMemoryBlock(id, updates);
  }

  remove(id: string): void {
    this.q.deleteMemoryBlock(id);
  }

  getAllBlocks(taskId?: string): MemoryBlock[] {
    if (taskId) {
      return this.q.retrieveMemoryBlocks({ taskId: taskId });
    }
    return this.q.retrieveMemoryBlocks({});
  }
}
