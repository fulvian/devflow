import { getDB } from '../database/connection.js';
import { ensureMigrations } from '../database/migrations.js';
import { BlockService } from './blocks.js';
import { ContextService } from './contexts.js';
// import { SessionService } from './sessions.js';
import { SearchService } from './search.js';
import { SemanticSearchService } from './semantic.js';
import { VectorEmbeddingService } from '../ml/VectorEmbeddingService.js';
import { compactContext } from './compaction.js';
export class SQLiteMemoryManager {
    blockSvc;
    ctxSvc;
    searchSvc;
    semanticSvc;
    constructor(dbPath) {
        const db = dbPath ? getDB({ path: dbPath }) : getDB();
        ensureMigrations(db);
        const vectorService = new VectorEmbeddingService();
        this.blockSvc = new BlockService(db, vectorService);
        this.ctxSvc = new ContextService(db);
        this.searchSvc = new SearchService(db);
        this.semanticSvc = new SemanticSearchService(db, this.searchSvc, vectorService);
    }
    async initialize() {
        // Initialize database connections and services
        await ensureMigrations(getDB());
    }
    async cleanup() {
        // Clean up resources
        // Database connections are managed by the connection pool
    }
    getAllBlocks(taskId) {
        return this.blockSvc.getAllBlocks(taskId);
    }
    async storeEmergencyContext(taskId, sessionId, context) {
        // Store emergency context for fallback scenarios
        const block = {
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
    async retrieveEmergencyContext(taskId, _sessionId) {
        const blocks = this.blockSvc.find({
            taskId: taskId,
            blockTypes: ['emergency_context'],
            platforms: ['claude_code']
        });
        const emergencyBlock = blocks.find(block => block.metadata?.['emergency'] === true &&
            block.label?.includes('Emergency Context'));
        if (emergencyBlock) {
            return JSON.parse(emergencyBlock.content);
        }
        return null;
    }
    async getSession(sessionId) {
        // Return session info - this is a simplified implementation
        return {
            id: sessionId,
            status: 'active',
            startTime: new Date(),
            platform: 'claude_code'
        };
    }
    async storeMemoryBlock(block) {
        // Use the async create method which now handles embedding generation automatically
        return await this.blockSvc.create(block);
    }
    async retrieveMemoryBlocks(query) {
        return this.blockSvc.find(query);
    }
    async updateMemoryBlock(id, updates) {
        this.blockSvc.update(id, updates);
    }
    async deleteMemoryBlock(id) {
        this.blockSvc.remove(id);
    }
    async createTaskContext(context) {
        return this.ctxSvc.create(context);
    }
    async getTaskContext(id) {
        return this.ctxSvc.get(id);
    }
    async updateTaskContext(id, updates) {
        this.ctxSvc.update(id, updates);
    }
    async searchTaskContexts(query) {
        return this.ctxSvc.search(query);
    }
    async startSession(session) {
        // Start a new session
        const db = getDB();
        const stmt = db.prepare(`
      INSERT INTO coordination_sessions (
        task_id, platform, session_type, tokens_used, api_calls,
        estimated_cost_usd, compaction_events, task_progress_delta,
        errors_encountered, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const info = stmt.run(session.taskId, session.platform, session.sessionType, session.tokensUsed, session.apiCalls, session.estimatedCostUsd, session.compactionEvents, session.taskProgressDelta, session.errorsEncountered, JSON.stringify(session.metadata));
        const row = db.prepare('SELECT id FROM coordination_sessions WHERE rowid = ?').get(info.lastInsertRowid);
        return row.id;
    }
    async endSession(sessionId, metrics) {
        // End a session with metrics
        const db = getDB();
        const stmt = db.prepare(`
      UPDATE coordination_sessions 
      SET end_time = ?, duration_seconds = ?, final_tokens_used = ?,
          final_api_calls = ?, final_cost_usd = ?, final_errors = ?
      WHERE id = ?
    `);
        stmt.run(new Date().toISOString(), metrics.durationSeconds || 0, metrics.tokensUsed || 0, metrics.apiCalls || 0, metrics.costUsd || 0, metrics.errorsEncountered || 0, sessionId);
    }
    async getActiveSession(_taskId) {
        // For brevity, omitted. Could track active by end_time IS NULL
        return null;
    }
    async compactContext(taskId, strategy) {
        const blocks = await this.retrieveMemoryBlocks({ taskId, limit: 1000 });
        return compactContext(blocks, strategy);
    }
    async extractContext(sessionId) {
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
    async semanticSearch(query, options) {
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
    async getAllMemoryBlocks() {
        return this.blockSvc.getAllBlocks();
    }
    async storeContextSnapshot(snapshot) {
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
    async deleteContextSnapshot(snapshotId) {
        await this.blockSvc.remove(snapshotId);
    }
    async getActiveSessions() {
        // Get active sessions from database
        const db = getDB();
        const stmt = db.prepare(`
      SELECT * FROM coordination_sessions 
      WHERE end_time IS NULL 
      ORDER BY start_time DESC
    `);
        return stmt.all();
    }
    async updateSessionHandoff(sessionId, handoffData) {
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
//# sourceMappingURL=manager.js.map