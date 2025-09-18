import { Router } from 'express';
import { ApiResponse } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/db';
import { z } from 'zod';
import { emitEvent } from '../ws/events';

const router = Router();

// Use shared DB connection (single, canonical SQLite file)

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    context TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at);
`);

const CreateSchema = z.object({
  name: z.string().min(1),
  context: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  status: z.enum(['active', 'archived']).optional()
});

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  context: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  status: z.enum(['active', 'archived']).optional(),
  activeTaskId: z.string().optional()
});

// GET /api/sessions
router.get('/', async (req, res, next) => {
  try {
    const rows = db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all();
    const data = rows.map((r: any) => ({ id: r.id, name: r.name, context: r.context ? JSON.parse(r.context) : {}, metadata: r.metadata ? JSON.parse(r.metadata) : {}, status: r.status || 'active', activeTaskId: r.active_task_id || undefined, createdAt: r.created_at, updatedAt: r.updated_at }));
    const response: ApiResponse = { success: true, data, timestamp: new Date().toISOString() };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/sessions/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' }, timestamp: new Date().toISOString() });
    }
    const session = { id: row.id, name: row.name, context: row.context ? JSON.parse(row.context) : {}, metadata: row.metadata ? JSON.parse(row.metadata) : {}, status: row.status || 'active', activeTaskId: row.active_task_id || undefined, createdAt: row.created_at, updatedAt: row.updated_at };
    const response: ApiResponse = { success: true, data: session, timestamp: new Date().toISOString() };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/sessions
router.post('/', async (req, res, next) => {
  try {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid session payload', details: parsed.error.flatten() }, timestamp: new Date().toISOString() });
    }
    const { name, context = {}, metadata = {}, status = 'active' } = parsed.data;
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO sessions (id, name, context, metadata, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, name, JSON.stringify(context), JSON.stringify(metadata), status, now, now);
    const created = { id, name, context, metadata, status, createdAt: now, updatedAt: now };
    const response: ApiResponse = { success: true, data: created, timestamp: now };
    emitEvent('session.created', created);
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/sessions/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid session update', details: parsed.error.flatten() }, timestamp: new Date().toISOString() });
    }
    const { id } = req.params;
    const updates = parsed.data;
    const fields: string[] = [];
    const values: any[] = [];
    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.context !== undefined) { fields.push('context = ?'); values.push(JSON.stringify(updates.context)); }
    if (updates.metadata !== undefined) { fields.push('metadata = ?'); values.push(JSON.stringify(updates.metadata)); }
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.activeTaskId !== undefined) { fields.push('active_task_id = ?'); values.push(updates.activeTaskId); }
    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'NO_UPDATES', message: 'No valid fields to update' }, timestamp: new Date().toISOString() });
    }
    const now = new Date().toISOString();
    const result = db.prepare(`UPDATE sessions SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`).run(...values, now, id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' }, timestamp: new Date().toISOString() });
    }
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    const updated = { id: row.id, name: row.name, context: row.context ? JSON.parse(row.context) : {}, metadata: row.metadata ? JSON.parse(row.metadata) : {}, status: row.status || 'active', activeTaskId: row.active_task_id || undefined, createdAt: row.created_at, updatedAt: row.updated_at };
    const response: ApiResponse = { success: true, data: updated, timestamp: now };
    emitEvent('session.updated', updated);
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/sessions/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' }, timestamp: new Date().toISOString() });
    }
    emitEvent('session.deleted', { id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Activate a session and optionally set active task
const ActivateSchema = z.object({ taskId: z.string().optional() });
router.patch('/:id/activate', async (req, res, next) => {
  try {
    const parsed = ActivateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid activate payload', details: parsed.error.flatten() }, timestamp: new Date().toISOString() });
    }
    const { id } = req.params;
    const { taskId } = parsed.data;
    const now = new Date().toISOString();
    const stmt = db.prepare('UPDATE sessions SET status = ?, active_task_id = COALESCE(?, active_task_id), updated_at = ? WHERE id = ?');
    const result = stmt.run('active', taskId ?? null, now, id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' }, timestamp: new Date().toISOString() });
    }
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    const session = { id: row.id, name: row.name, context: row.context ? JSON.parse(row.context) : {}, metadata: row.metadata ? JSON.parse(row.metadata) : {}, status: row.status || 'active', activeTaskId: row.active_task_id || undefined, createdAt: row.created_at, updatedAt: row.updated_at };
    emitEvent('session.activated', session);
    const response: ApiResponse = { success: true, data: session, timestamp: now };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Get session state: session + activeTask + recent tasks/memory
router.get('/:id/state', async (req, res, next) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' }, timestamp: new Date().toISOString() });
    }
    const session = { id: row.id, name: row.name, context: row.context ? JSON.parse(row.context) : {}, metadata: row.metadata ? JSON.parse(row.metadata) : {}, status: row.status || 'active', activeTaskId: row.active_task_id || undefined, createdAt: row.created_at, updatedAt: row.updated_at };

    // Resolve active task: prefer explicit active_task_id else latest in_progress/pending
    let activeTask: any = null;
    if (row.active_task_id) {
      activeTask = db.prepare('SELECT * FROM task_contexts WHERE id = ?').get(row.active_task_id);
    }
    if (!activeTask) {
      activeTask = db.prepare("SELECT * FROM task_contexts WHERE session_id = ? AND status IN ('in_progress','pending') ORDER BY updated_at DESC LIMIT 1").get(id);
    }

    const tasks = db.prepare('SELECT * FROM task_contexts WHERE session_id = ? ORDER BY updated_at DESC LIMIT 10').all(id);
    const memories = db.prepare('SELECT id, content, type, timestamp, metadata, task_id FROM memory_blocks WHERE session_id = ? ORDER BY timestamp DESC LIMIT 10').all(id);

    const mapTask = (t: any) => t ? ({ id: t.id, title: t.title, description: t.description || '', status: t.status, priority: t.priority, metadata: t.metadata ? JSON.parse(t.metadata) : {}, createdAt: t.created_at, updatedAt: t.updated_at }) : null;
    const mappedTasks = tasks.map(mapTask);
    const mappedActive = mapTask(activeTask);
    const mappedMems = memories.map((m: any) => ({ id: m.id, content: m.content, type: m.type, timestamp: m.timestamp, metadata: m.metadata ? JSON.parse(m.metadata) : {}, taskId: m.task_id || undefined }));

    const data = {
      session,
      activeTask: mappedActive,
      tasks: mappedTasks,
      memory: mappedMems,
      counts: { tasks: mappedTasks.length, memory: mappedMems.length }
    };
    const response: ApiResponse = { success: true, data, timestamp: new Date().toISOString() };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

export { router as sessionRoutes };
