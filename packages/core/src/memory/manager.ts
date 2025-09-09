import type {
  MemoryManager,
  MemoryBlock,
  MemoryQuery,
  TaskContext,
  CoordinationSession,
  SessionEndMetrics,
  MemoryCompactionStrategy,
  CompactionResult,
  MemoryExtractedContext,
  SemanticSearchOptions,
  SemanticSearchResult,
} from '@devflow/shared';
import { getDB } from '../database/connection.js';
import { ensureMigrations } from '../database/migrations.js';
import { BlockService } from './blocks.js';
import { ContextService } from './contexts.js';
import { SessionService } from './sessions.js';
import { SearchService } from './search.js';
import { compactContext } from './compaction.js';

export class SQLiteMemoryManager implements MemoryManager {
  private blockSvc;
  private ctxSvc;
  private sessSvc;
  private searchSvc;

  constructor(dbPath?: string) {
    const db = dbPath ? getDB({ path: dbPath }) : getDB();
    ensureMigrations(db);
    this.blockSvc = new BlockService(db);
    this.ctxSvc = new ContextService(db);
    this.sessSvc = new SessionService(db);
    this.searchSvc = new SearchService(db);
  }

  async storeMemoryBlock(block: Omit<MemoryBlock, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>): Promise<string> {
    return this.blockSvc.create(block);
  }
  async retrieveMemoryBlocks(query: MemoryQuery): Promise<MemoryBlock[]> {
    return this.blockSvc.find(query);
  }
  async updateMemoryBlock(id: string, updates: Partial<MemoryBlock>): Promise<void> {
    this.blockSvc.update(id, updates);
  }
  async deleteMemoryBlock(id: string): Promise<void> {
    this.blockSvc.remove(id);
  }

  async createTaskContext(context: Omit<TaskContext, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return this.ctxSvc.create(context);
  }
  async getTaskContext(id: string): Promise<TaskContext | null> {
    return this.ctxSvc.get(id);
  }
  async updateTaskContext(id: string, updates: Partial<TaskContext>): Promise<void> {
    this.ctxSvc.update(id, updates);
  }
  async searchTaskContexts(query: string): Promise<TaskContext[]> {
    return this.ctxSvc.search(query);
  }

  async startSession(session: Omit<CoordinationSession, 'id' | 'startTime' | 'durationSeconds'>): Promise<string> {
    return this.sessSvc.start(session);
  }
  async endSession(sessionId: string, metrics: SessionEndMetrics): Promise<void> {
    this.sessSvc.end(sessionId, metrics);
  }
  async getActiveSession(_taskId: string): Promise<CoordinationSession | null> {
    // For brevity, omitted. Could track active by end_time IS NULL
    return null;
  }

  async compactContext(taskId: string, strategy: MemoryCompactionStrategy): Promise<CompactionResult> {
    const blocks = await this.retrieveMemoryBlocks({ taskId, limit: 1000 });
    return compactContext(blocks, strategy);
  }

  async extractContext(sessionId: string): Promise<MemoryExtractedContext> {
    // Minimal extraction: use last 20 blocks from session
    const blocks = (await this.retrieveMemoryBlocks({ limit: 200 })).filter(b => b.sessionId === sessionId).slice(0, 20);
    return {
      sessionId,
      platform: 'openrouter',
      extractedBlocks: blocks,
      contextSummary: `Extracted ${blocks.length} blocks for session ${sessionId}`,
      keyDecisions: blocks.filter(b => b.blockType === 'decision').map(b => b.label),
      nextSteps: [],
    };
  }

  async semanticSearch(query: string, options?: SemanticSearchOptions): Promise<SemanticSearchResult[]> {
    return this.searchSvc.semantic(query, options);
  }
}
