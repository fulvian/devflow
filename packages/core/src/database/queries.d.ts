import type Database from 'better-sqlite3';
import type { TaskContext, MemoryBlock, CoordinationSession, MemoryQuery } from '@devflow/shared';
export declare class Queries {
    private db;
    constructor(db: Database.Database);
    createTaskContext(input: Omit<TaskContext, 'id' | 'createdAt' | 'updatedAt'>): string;
    getTaskContext(id: string): TaskContext | null;
    updateTaskContext(id: string, updates: Partial<TaskContext>): void;
    searchTaskContexts(query: string): TaskContext[];
    storeMemoryBlock(input: Omit<MemoryBlock, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>): string;
    retrieveMemoryBlocks(q: MemoryQuery): MemoryBlock[];
    updateMemoryBlock(id: string, updates: Partial<MemoryBlock>): void;
    deleteMemoryBlock(id: string): void;
    startSession(session: Omit<CoordinationSession, 'id' | 'startTime' | 'durationSeconds'>): string;
    endSession(sessionId: string, metrics: {
        tokensUsed: number;
        apiCalls: number;
        estimatedCostUsd: number;
        contextSizeEnd?: number;
        compactionEvents?: number;
        userSatisfaction?: number;
        taskProgressDelta?: number;
        errorsEncountered?: number;
        metadata?: Record<string, unknown>;
    }): void;
}
//# sourceMappingURL=queries.d.ts.map