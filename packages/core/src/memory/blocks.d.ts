import type Database from 'better-sqlite3';
import type { MemoryBlock, MemoryQuery } from '@devflow/shared';
import { VectorEmbeddingService } from '../ml/VectorEmbeddingService.js';
export declare class BlockService {
    private q;
    private vectorService;
    constructor(db: Database.Database, vectorService?: VectorEmbeddingService);
    create(block: Omit<MemoryBlock, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>): Promise<string>;
    createSync(block: Omit<MemoryBlock, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>): string;
    private generateEmbeddingAsync;
    find(query: MemoryQuery): MemoryBlock[];
    update(id: string, updates: Partial<MemoryBlock>): void;
    remove(id: string): void;
    getAllBlocks(taskId?: string): MemoryBlock[];
}
//# sourceMappingURL=blocks.d.ts.map