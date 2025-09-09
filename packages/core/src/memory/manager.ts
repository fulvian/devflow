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
import { SemanticSearchService } from './semantic.js';
import { VectorEmbeddingService } from '../ml/VectorEmbeddingService.js';
import { compactContext } from './compaction.js';

export class SQLiteMemoryManager implements MemoryManager {
  private blockSvc;
  private ctxSvc;
  private searchSvc;
  private semanticSvc: SemanticSearchService;

  constructor(dbPath?: string) {
    const db = dbPath ? getDB({ path: dbPath }) : getDB();
    ensureMigrations(db);
    this.blockSvc = new BlockService(db);
    this.ctxSvc = new ContextService(db);
    this.searchSvc = new SearchService(db);
    this.semanticSvc = new SemanticSearchService(db, this.searchSvc, new VectorEmbeddingService());
  }

  async initialize(): Promise<void> {
    // Initialize database connections and services
    await ensureMigrations(getDB());
  }

  async cleanup(): Promise<void> {
    // Clean up resources
    // Database connections are managed by the connection pool
  }

  getAllBlocks(taskId?: string): MemoryBlock[] {
    return this.blockSvc.getAllBlocks(taskId);
  }

  async storeEmergencyContext(taskId: string, sessionId: string, context: any): Promise<void> {
    // Store emergency context for fallback scenarios
    const block: Omit<MemoryBlock, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'> = {
      taskId,
      sessionId,
      blockType: 'emergency_context',
      label: `Emergency Context - ${new Date().toISOString()}`,
      content: JSON.stringify(context),
      metadata: { platform: 'claude_code', emergency: true },
      importanceScore: 0.9,
      relationships: []
    };
    await this.storeMemoryBlock(block);
  }

  async retrieveEmergencyContext(taskId: string, sessionId: string): Promise<any> {
    const blocks = this.blockSvc.find({
      taskIds: [taskId],
      blockTypes: ['emergency_context'],
      platforms: ['claude_code']
    });
    
    const emergencyBlock = blocks.find(block => 
      block.metadata?.emergency === true && 
      block.label?.includes('Emergency Context')
    );
    
    if (emergencyBlock) {
      return JSON.parse(emergencyBlock.content);
    }
    return null;
  }

  async getSession(sessionId: string): Promise<any> {
    // Return session info - this is a simplified implementation
    return {
      id: sessionId,
      status: 'active',
      startTime: new Date(),
      platform: 'claude_code'
    };
  }

  async storeMemoryBlock(block: Omit<MemoryBlock, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>): Promise<string> {
    const blockId = this.blockSvc.create(block);
    
    // Generate embedding for the new block in background
    this.generateBlockEmbedding(blockId).catch(error => {
      console.warn(`Failed to generate embedding for block ${blockId}:`, error);
    });
    
    return blockId;
  }

  /**
   * Generate and store embedding for a memory block
   */
  private async generateBlockEmbedding(blockId: string): Promise<void> {
    try {
      const block = (await this.retrieveMemoryBlocks({ limit: 1 })).find(b => b.id === blockId);
      if (!block) return;

      const vectorService = new VectorEmbeddingService();
      const embedding = await vectorService.embedText(block.content);
      
      // Store embedding in the vector service's database tables
      await vectorService.storeMemoryBlockEmbedding(blockId, embedding);
      
      // Also store embedding directly in memory_blocks table for performance
      this.blockSvc.update(blockId, {
        embedding,
        embeddingModel: vectorService.defaultModel
      });
    } catch (error) {
      console.error(`Error generating embedding for block ${blockId}:`, error);
      // Don't throw - embedding generation failure shouldn't break block storage
    }
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
    // Start a new session
    const db = getDB();
    const stmt = db.prepare(`
      INSERT INTO coordination_sessions (
        task_id, platform, session_type, tokens_used, api_calls,
        estimated_cost_usd, compaction_events, task_progress_delta,
        errors_encountered, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      session.taskId,
      session.platform,
      session.sessionType,
      session.tokensUsed,
      session.apiCalls,
      session.estimatedCostUsd,
      session.compactionEvents,
      session.taskProgressDelta,
      session.errorsEncountered,
      JSON.stringify(session.metadata)
    );
    const row = db.prepare('SELECT id FROM coordination_sessions WHERE rowid = ?').get(info.lastInsertRowid) as { id: string };
    return row.id;
  }
  async endSession(sessionId: string, metrics: SessionEndMetrics): Promise<void> {
    // End a session with metrics
    const db = getDB();
    const stmt = db.prepare(`
      UPDATE coordination_sessions 
      SET end_time = ?, duration_seconds = ?, final_tokens_used = ?,
          final_api_calls = ?, final_cost_usd = ?, final_errors = ?
      WHERE id = ?
    `);
    stmt.run(
      new Date().toISOString(),
      metrics.durationSeconds,
      metrics.tokensUsed,
      metrics.apiCalls,
      metrics.costUsd,
      metrics.errorsEncountered,
      sessionId
    );
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
    // Use the new hybrid semantic search service
    const hybridResults = await this.semanticSvc.hybridSearch(query, options);
    // Convert HybridSearchResult to SemanticSearchResult for backward compatibility
    return hybridResults.map(result => ({
      block: result.block,
      similarity: result.scores.semantic || result.scores.hybrid,
      relevanceScore: result.relevanceScore,
      context: result.context
    }));
  }

  // CCR Integration Methods
  async getAllMemoryBlocks(): Promise<MemoryBlock[]> {
    return this.blockSvc.getAllBlocks();
  }

  async retrieveEmergencyContext(taskId: string): Promise<any> {
    const blocks = await this.blockSvc.find({
      taskIds: [taskId],
      blockTypes: ['emergency_context'],
      limit: 1
    });
    
    if (blocks.length > 0) {
      return JSON.parse(blocks[0].content);
    }
    return null;
  }

  async storeContextSnapshot(snapshot: any): Promise<void> {
    await this.blockSvc.create({
      content: JSON.stringify(snapshot),
      blockType: 'context_snapshot',
      label: `Context Snapshot ${Date.now()}`,
      taskId: snapshot.taskId || 'unknown',
      sessionId: snapshot.sessionId || 'unknown',
      metadata: {
        platform: snapshot.platform || 'unknown',
        snapshot: true,
        timestamp: new Date().toISOString(),
        contextSize: JSON.stringify(snapshot).length
      },
      importanceScore: 0.9,
      relationships: []
    });
  }

  async deleteContextSnapshot(snapshotId: string): Promise<void> {
    await this.blockSvc.remove(snapshotId);
  }

  async getActiveSessions(): Promise<any[]> {
    // Get active sessions from database
    const db = getDB();
    const stmt = db.prepare(`
      SELECT * FROM coordination_sessions 
      WHERE end_time IS NULL 
      ORDER BY start_time DESC
    `);
    return stmt.all() as any[];
  }

  async updateSessionHandoff(sessionId: string, handoffData: any): Promise<void> {
    // Update session with handoff data
    const db = getDB();
    const stmt = db.prepare(`
      UPDATE coordination_sessions 
      SET handoff_data = ?, last_activity = ?
      WHERE id = ?
    `);
    stmt.run(JSON.stringify(handoffData), new Date().toISOString(), sessionId);
  }
}
