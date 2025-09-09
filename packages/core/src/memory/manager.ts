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
  private sessSvc;
  private searchSvc;
  private semanticSvc: SemanticSearchService;

  constructor(dbPath?: string) {
    const db = dbPath ? getDB({ path: dbPath }) : getDB();
    ensureMigrations(db);
    this.blockSvc = new BlockService(db);
    this.ctxSvc = new ContextService(db);
    this.sessSvc = new SessionService(db);
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
      blockType: 'context',
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
      blockTypes: ['context'],
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

  async storeEmergencyContext(context: any): Promise<void> {
    // Store emergency context for CCR fallback
    await this.blockSvc.createBlock({
      id: `emergency_${Date.now()}`,
      content: JSON.stringify(context),
      type: 'emergency_context',
      importance: 1.0,
      recency: 1.0,
      taskId: context.taskId || 'unknown',
      sessionId: context.sessionId || 'unknown',
      platform: context.platform || 'unknown',
      metadata: {
        emergency: true,
        timestamp: new Date().toISOString(),
        contextSize: JSON.stringify(context).length
      }
    });
  }

  async retrieveEmergencyContext(taskId: string): Promise<any> {
    const blocks = await this.blockSvc.queryBlocks({
      taskId,
      type: 'emergency_context',
      limit: 1
    });
    
    if (blocks.length > 0) {
      return JSON.parse(blocks[0].content);
    }
    return null;
  }

  async storeContextSnapshot(snapshot: any): Promise<void> {
    await this.blockSvc.createBlock({
      id: `snapshot_${Date.now()}`,
      content: JSON.stringify(snapshot),
      type: 'context_snapshot',
      importance: 0.9,
      recency: 1.0,
      taskId: snapshot.taskId || 'unknown',
      sessionId: snapshot.sessionId || 'unknown',
      platform: snapshot.platform || 'unknown',
      metadata: {
        snapshot: true,
        timestamp: new Date().toISOString(),
        contextSize: JSON.stringify(snapshot).length
      }
    });
  }

  async deleteContextSnapshot(snapshotId: string): Promise<void> {
    await this.blockSvc.deleteBlock(snapshotId);
  }

  async getActiveSessions(): Promise<any[]> {
    return this.sessSvc.getActiveSessions();
  }

  async updateSessionHandoff(sessionId: string, handoffData: any): Promise<void> {
    await this.sessSvc.updateSession(sessionId, {
      handoffData,
      lastActivity: new Date().toISOString()
    });
  }
}
