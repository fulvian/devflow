import type Database from 'better-sqlite3';
import { z } from 'zod';
import type {
  TaskContext,
  MemoryBlock,
  CoordinationSession,
  MemoryQuery,
} from '@devflow/shared';

const isoDate = z.string().datetime().or(z.date());

const TaskContextSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  priority: z.enum(['h-', 'm-', 'l-', '?-']),
  status: z.enum(['planning', 'active', 'blocked', 'completed', 'archived']).optional(),
  complexityScore: z.number().min(0).max(1).optional(),
  estimatedDurationMinutes: z.number().int().optional(),
  requiredCapabilities: z.array(z.string()).optional(),
  primaryPlatform: z.enum(['claude_code', 'openai_codex', 'gemini_cli', 'cursor', 'openrouter']).optional(),
  platformRouting: z.record(z.any()).optional(),
  architecturalContext: z.record(z.any()).default({}),
  implementationContext: z.record(z.any()).default({}),
  debuggingContext: z.record(z.any()).default({}),
  maintenanceContext: z.record(z.any()).default({}),
  ccSessionId: z.string().optional(),
  ccTaskFile: z.string().optional(),
  branchName: z.string().optional(),
  parentTaskId: z.string().optional(),
  dependsOn: z.array(z.string()).optional(),
  createdAt: isoDate.optional(),
  updatedAt: isoDate.optional(),
  completedAt: isoDate.optional(),
});

const MemoryBlockSchema = z.object({
  id: z.string().optional(),
  taskId: z.string(),
  sessionId: z.string(),
  blockType: z.enum(['architectural', 'implementation', 'debugging', 'maintenance', 'context', 'decision', 'emergency_context', 'context_snapshot']),
  label: z.string(),
  content: z.string(),
  metadata: z.record(z.any()).default({}),
  importanceScore: z.number().min(0).max(1).default(0.5),
  relationships: z.array(z.string()).default([]),
  embeddingModel: z.string().optional(),
  createdAt: isoDate.optional(),
  lastAccessed: isoDate.optional(),
  accessCount: z.number().int().optional(),
});

const SessionSchema = z.object({
  id: z.string().optional(),
  taskId: z.string(),
  platform: z.enum(['claude_code', 'openai_codex', 'gemini_cli', 'cursor', 'openrouter']),
  sessionType: z.enum(['development', 'review', 'debugging', 'handoff', 'planning']).default('development'),
  startTime: isoDate.optional(),
  endTime: isoDate.optional(),
  tokensUsed: z.number().int().default(0),
  apiCalls: z.number().int().default(0),
  estimatedCostUsd: z.number().default(0),
  modelUsed: z.string().optional(),
  contextSizeStart: z.number().int().optional(),
  contextSizeEnd: z.number().int().optional(),
  compactionEvents: z.number().int().default(0),
  handoffFromSession: z.string().optional(),
  handoffToSession: z.string().optional(),
  handoffContext: z.record(z.any()).optional(),
  handoffSuccess: z.boolean().optional(),
  userSatisfaction: z.number().min(1).max(5).optional(),
  taskProgressDelta: z.number().min(-1).max(1).optional(),
  errorsEncountered: z.number().int().optional(),
  metadata: z.record(z.any()).optional(),
});

function toISO(d?: string | Date): string | undefined {
  if (!d) return undefined;
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

export class Queries {
  constructor(private db: Database.Database) {}

  // Task Contexts
  createTaskContext(input: Omit<TaskContext, 'id' | 'createdAt' | 'updatedAt'>): string {
    const data = TaskContextSchema.parse(input);
    const stmt = this.db.prepare(
      `INSERT INTO task_contexts (
        title, description, priority, status, complexity_score, estimated_duration_minutes,
        required_capabilities, primary_platform, platform_routing,
        architectural_context, implementation_context, debugging_context, maintenance_context,
        cc_session_id, cc_task_file, branch_name, parent_task_id, depends_on
      ) VALUES (?, ?, ?, COALESCE(?, 'planning'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const info = stmt.run(
      data.title,
      data.description ?? null,
      data.priority,
      data.status ?? null,
      data.complexityScore ?? null,
      data.estimatedDurationMinutes ?? null,
      data.requiredCapabilities ? JSON.stringify(data.requiredCapabilities) : null,
      data.primaryPlatform ?? null,
      data.platformRouting ? JSON.stringify(data.platformRouting) : null,
      JSON.stringify(data.architecturalContext ?? {}),
      JSON.stringify(data.implementationContext ?? {}),
      JSON.stringify(data.debuggingContext ?? {}),
      JSON.stringify(data.maintenanceContext ?? {}),
      data.ccSessionId ?? null,
      data.ccTaskFile ?? null,
      data.branchName ?? null,
      data.parentTaskId ?? null,
      data.dependsOn ? JSON.stringify(data.dependsOn) : null
    );
    const row = this.db.prepare('SELECT id FROM task_contexts WHERE rowid = ?').get(info.lastInsertRowid) as { id: string };
    return row.id;
  }

  getTaskContext(id: string): TaskContext | null {
    const row = this.db.prepare('SELECT * FROM task_contexts WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? undefined,
      priority: row.priority,
      status: row.status,
      complexityScore: row.complexity_score ?? undefined,
      estimatedDurationMinutes: row.estimated_duration_minutes ?? undefined,
      requiredCapabilities: row.required_capabilities ? JSON.parse(row.required_capabilities) : undefined,
      primaryPlatform: row.primary_platform ?? undefined,
      platformRouting: row.platform_routing ? JSON.parse(row.platform_routing) : undefined,
      architecturalContext: JSON.parse(row.architectural_context ?? '{}'),
      implementationContext: JSON.parse(row.implementation_context ?? '{}'),
      debuggingContext: JSON.parse(row.debugging_context ?? '{}'),
      maintenanceContext: JSON.parse(row.maintenance_context ?? '{}'),
      ccSessionId: row.cc_session_id ?? undefined,
      ccTaskFile: row.cc_task_file ?? undefined,
      branchName: row.branch_name ?? undefined,
      parentTaskId: row.parent_task_id ?? undefined,
      dependsOn: row.depends_on ? JSON.parse(row.depends_on) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    } as TaskContext;
  }

  updateTaskContext(id: string, updates: Partial<TaskContext>): void {
    // Only a subset for brevity
    const fields: string[] = [];
    const values: any[] = [];
    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
    if (updates.priority !== undefined) { fields.push('priority = ?'); values.push(updates.priority); }
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.primaryPlatform !== undefined) { fields.push('primary_platform = ?'); values.push(updates.primaryPlatform); }
    if (updates.platformRouting !== undefined) { fields.push('platform_routing = ?'); values.push(JSON.stringify(updates.platformRouting)); }
    if (updates.completedAt !== undefined) { fields.push('completed_at = ?'); values.push(toISO(updates.completedAt) ?? null); }
    if (fields.length === 0) return;
    const sql = `UPDATE task_contexts SET ${fields.join(', ')} WHERE id = ?`;
    this.db.prepare(sql).run(...values, id);
  }

  searchTaskContexts(query: string): TaskContext[] {
    const stmt = this.db.prepare(`
      SELECT tc.* FROM tasks_fts f
      JOIN task_contexts tc ON tc.rowid = f.rowid
      WHERE tasks_fts MATCH ?
      ORDER BY tc.rowid DESC
    `);
    const rows = stmt.all(query) as any[];
    return rows.map(r => this.getTaskContext(r.id)!).filter(Boolean);
  }

  // Memory Blocks
  storeMemoryBlock(input: Omit<MemoryBlock, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>): string {
    const data = MemoryBlockSchema.parse(input);
    const stmt = this.db.prepare(`
      INSERT INTO memory_blocks (
        task_id, session_id, block_type, label, content,
        metadata, importance_score, relationships, embedding_model
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const info = stmt.run(
      data.taskId,
      data.sessionId,
      data.blockType,
      data.label,
      data.content,
      JSON.stringify(data.metadata ?? {}),
      data.importanceScore ?? 0.5,
      JSON.stringify(data.relationships ?? []),
      data.embeddingModel ?? null
    );
    const row = this.db.prepare('SELECT id FROM memory_blocks WHERE rowid = ?').get(info.lastInsertRowid) as { id: string };
    return row.id;
  }

  retrieveMemoryBlocks(q: MemoryQuery): MemoryBlock[] {
    const QuerySchema = z.object({
      taskId: z.string().optional(),
      blockTypes: z
        .array(z.enum(['architectural', 'implementation', 'debugging', 'maintenance', 'context', 'decision']))
        .optional(),
      platforms: z
        .array(z.enum(['claude_code', 'openai_codex', 'gemini_cli', 'cursor', 'openrouter']))
        .optional(),
      dateRange: z.object({ start: isoDate, end: isoDate }).optional(),
      importanceThreshold: z.number().min(0).max(1).optional(),
      limit: z.number().int().min(1).max(500).optional().default(100),
    });
    const safe = QuerySchema.parse(q);

    const where: string[] = [];
    const params: any[] = [];
    if (safe.taskId) { where.push('task_id = ?'); params.push(safe.taskId); }
    if (safe.blockTypes && safe.blockTypes.length) { where.push(`block_type IN (${safe.blockTypes.map(()=>'?').join(',')})`); params.push(...safe.blockTypes); }
    if (safe.platforms && safe.platforms.length) { where.push(`json_extract(metadata, '$.platform') IN (${safe.platforms.map(()=>'?').join(',')})`); params.push(...safe.platforms); }
    if (safe.dateRange) { where.push('created_at BETWEEN ? AND ?'); params.push(toISO(safe.dateRange.start), toISO(safe.dateRange.end)); }
    if (typeof safe.importanceThreshold === 'number') { where.push('importance_score >= ?'); params.push(safe.importanceThreshold); }
    const limit = safe.limit;
    const sql = `SELECT * FROM memory_blocks ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY importance_score DESC, last_accessed DESC LIMIT ${limit}`;
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => ({
      id: r.id,
      taskId: r.task_id,
      sessionId: r.session_id,
      blockType: r.block_type,
      label: r.label,
      content: r.content,
      metadata: JSON.parse(r.metadata ?? '{}'),
      importanceScore: r.importance_score,
      relationships: JSON.parse(r.relationships ?? '[]'),
      embeddingModel: r.embedding_model ?? undefined,
      createdAt: new Date(r.created_at),
      lastAccessed: new Date(r.last_accessed),
      accessCount: r.access_count,
    }));
  }

  updateMemoryBlock(id: string, updates: Partial<MemoryBlock>): void {
    const fields: string[] = [];
    const values: any[] = [];
    if (updates.label !== undefined) { fields.push('label = ?'); values.push(updates.label); }
    if (updates.content !== undefined) { fields.push('content = ?'); values.push(updates.content); }
    if (updates.importanceScore !== undefined) { fields.push('importance_score = ?'); values.push(updates.importanceScore); }
    if (updates.metadata !== undefined) { fields.push('metadata = ?'); values.push(JSON.stringify(updates.metadata)); }
    if (updates.relationships !== undefined) { fields.push('relationships = ?'); values.push(JSON.stringify(updates.relationships)); }
    if (!fields.length) return;
    const sql = `UPDATE memory_blocks SET ${fields.join(', ')} WHERE id = ?`;
    this.db.prepare(sql).run(...values, id);
  }

  deleteMemoryBlock(id: string): void {
    this.db.prepare('DELETE FROM memory_blocks WHERE id = ?').run(id);
  }

  // Sessions
  startSession(session: Omit<CoordinationSession, 'id' | 'startTime' | 'durationSeconds'>): string {
    const data = SessionSchema.parse(session);
    const stmt = this.db.prepare(`
      INSERT INTO coordination_sessions (
        task_id, platform, session_type, tokens_used, api_calls, estimated_cost_usd, model_used,
        context_size_start, context_size_end, compaction_events, handoff_from_session, handoff_to_session,
        handoff_context, handoff_success, user_satisfaction, task_progress_delta, errors_encountered, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const info = stmt.run(
      data.taskId,
      data.platform,
      data.sessionType ?? 'development',
      data.tokensUsed ?? 0,
      data.apiCalls ?? 0,
      data.estimatedCostUsd ?? 0,
      data.modelUsed ?? null,
      data.contextSizeStart ?? null,
      data.contextSizeEnd ?? null,
      data.compactionEvents ?? 0,
      data.handoffFromSession ?? null,
      data.handoffToSession ?? null,
      data.handoffContext ? JSON.stringify(data.handoffContext) : null,
      data.handoffSuccess ?? null,
      data.userSatisfaction ?? null,
      data.taskProgressDelta ?? 0,
      data.errorsEncountered ?? 0,
      data.metadata ? JSON.stringify(data.metadata) : '{}'
    );
    const row = this.db.prepare('SELECT id FROM coordination_sessions WHERE rowid = ?').get(info.lastInsertRowid) as { id: string };
    return row.id;
  }

  endSession(sessionId: string, metrics: {
    tokensUsed: number; apiCalls: number; estimatedCostUsd: number; contextSizeEnd?: number; compactionEvents?: number; userSatisfaction?: number; taskProgressDelta?: number; errorsEncountered?: number; metadata?: Record<string, unknown>;
  }): void {
    this.db.prepare(`
      UPDATE coordination_sessions SET 
        end_time = datetime('now', 'utc'),
        tokens_used = ?,
        api_calls = ?,
        estimated_cost_usd = ?,
        context_size_end = COALESCE(?, context_size_end),
        compaction_events = COALESCE(?, compaction_events),
        user_satisfaction = COALESCE(?, user_satisfaction),
        task_progress_delta = COALESCE(?, task_progress_delta),
        errors_encountered = COALESCE(?, errors_encountered),
        metadata = COALESCE(?, metadata)
      WHERE id = ?
    `).run(
      metrics.tokensUsed,
      metrics.apiCalls,
      metrics.estimatedCostUsd,
      metrics.contextSizeEnd ?? null,
      metrics.compactionEvents ?? null,
      metrics.userSatisfaction ?? null,
      metrics.taskProgressDelta ?? null,
      metrics.errorsEncountered ?? null,
      metrics.metadata ? JSON.stringify(metrics.metadata) : null,
      sessionId
    );
  }
}
