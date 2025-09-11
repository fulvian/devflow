import type { MemoryManager, MemoryBlock, MemoryQuery, TaskContext, CoordinationSession, SessionEndMetrics, MemoryCompactionStrategy, CompactionResult, MemoryExtractedContext, SemanticSearchOptions, SemanticSearchResult } from '@devflow/shared';
export declare class SQLiteMemoryManager implements MemoryManager {
    private blockSvc;
    private ctxSvc;
    private searchSvc;
    private semanticSvc;
    constructor(dbPath?: string);
    initialize(): Promise<void>;
    cleanup(): Promise<void>;
    getAllBlocks(taskId?: string): MemoryBlock[];
    storeEmergencyContext(taskId: string, sessionId: string, context: any): Promise<void>;
    retrieveEmergencyContext(taskId: string, _sessionId: string): Promise<any>;
    getSession(sessionId: string): Promise<any>;
    storeMemoryBlock(block: Omit<MemoryBlock, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>): Promise<string>;
    retrieveMemoryBlocks(query: MemoryQuery): Promise<MemoryBlock[]>;
    updateMemoryBlock(id: string, updates: Partial<MemoryBlock>): Promise<void>;
    deleteMemoryBlock(id: string): Promise<void>;
    createTaskContext(context: Omit<TaskContext, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>;
    getTaskContext(id: string): Promise<TaskContext | null>;
    updateTaskContext(id: string, updates: Partial<TaskContext>): Promise<void>;
    searchTaskContexts(query: string): Promise<TaskContext[]>;
    startSession(session: Omit<CoordinationSession, 'id' | 'startTime' | 'durationSeconds'>): Promise<string>;
    endSession(sessionId: string, metrics: SessionEndMetrics): Promise<void>;
    getActiveSession(_taskId: string): Promise<CoordinationSession | null>;
    compactContext(taskId: string, strategy: MemoryCompactionStrategy): Promise<CompactionResult>;
    extractContext(sessionId: string): Promise<MemoryExtractedContext>;
    semanticSearch(query: string, options?: SemanticSearchOptions): Promise<SemanticSearchResult[]>;
    getAllMemoryBlocks(): Promise<MemoryBlock[]>;
    storeContextSnapshot(snapshot: any): Promise<void>;
    deleteContextSnapshot(snapshotId: string): Promise<void>;
    getActiveSessions(): Promise<any[]>;
    updateSessionHandoff(sessionId: string, handoffData: any): Promise<void>;
}
//# sourceMappingURL=manager.d.ts.map