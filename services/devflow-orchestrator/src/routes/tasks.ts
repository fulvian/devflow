import { Router } from 'express';
import { ApiResponse } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/db';
import { z } from 'zod';
import { emitEvent } from '../ws/events';

const router = Router();

// Use shared DB connection (single, canonical SQLite file)

// Ensure canonical cometa table exists (non-destructive)
db.exec(`
  CREATE TABLE IF NOT EXISTS task_contexts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'medium',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    metadata TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_task_contexts_status ON task_contexts(status);
`);

// Schemas
const CreateTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  metadata: z.record(z.any()).optional()
});

const UpdateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  metadata: z.record(z.any()).optional()
});

// Mapping helper
const mapRow = (row: any) => ({
  id: row.id,
  title: row.title,
  description: row.description || '',
  status: row.status,
  priority: row.priority,
  metadata: row.metadata ? JSON.parse(row.metadata) : {},
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// GET /api/tasks
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query as { status?: string };
    let rows;
    if (status) {
      rows = db.prepare('SELECT * FROM task_contexts WHERE status = ? ORDER BY updated_at DESC').all(status);
    } else {
      rows = db.prepare('SELECT * FROM task_contexts ORDER BY updated_at DESC').all();
    }
    const response: ApiResponse = {
      success: true,
      data: rows.map(mapRow),
      timestamp: new Date().toISOString()
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks
router.post('/', async (req, res, next) => {
  try {
    const parsed = CreateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid task payload', details: parsed.error.flatten() }, timestamp: new Date().toISOString() });
    }
    const { title, description, priority = 'medium', metadata } = parsed.data as any;
    const id = uuidv4();
    const now = new Date().toISOString();
  const stmt = db.prepare(`INSERT INTO task_contexts (id, title, description, status, priority, created_at, updated_at, metadata) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`);
  stmt.run(id, title, description || null, priority, now, now, metadata ? JSON.stringify(metadata) : null);
  const response: ApiResponse = {
    success: true,
    data: { id, title, description: description || '', status: 'pending', priority, metadata: metadata || {}, createdAt: now, updatedAt: now },
    timestamp: now
  };
  emitEvent('task.created', response.data);
  res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM task_contexts WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' }, timestamp: new Date().toISOString() });
    }
    const response: ApiResponse = { success: true, data: mapRow(row), timestamp: new Date().toISOString() };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const parsed = UpdateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid task update', details: parsed.error.flatten() }, timestamp: new Date().toISOString() });
    }
    const { id } = req.params;
    const updates = parsed.data;
    const fields: string[] = [];
    const values: any[] = [];
    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.priority !== undefined) { fields.push('priority = ?'); values.push(updates.priority); }
    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'NO_UPDATES', message: 'No valid fields to update' }, timestamp: new Date().toISOString() });
    }
    const now = new Date().toISOString();
    const stmt = db.prepare(`UPDATE task_contexts SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`);
    const result = stmt.run(...values, now, id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' }, timestamp: new Date().toISOString() });
    }
    const row = db.prepare('SELECT * FROM task_contexts WHERE id = ?').get(id);
    const updated = mapRow(row);
    const response: ApiResponse = { success: true, data: updated, timestamp: now };
    emitEvent('task.updated', updated);
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM task_contexts WHERE id = ?');
    const result = stmt.run(id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' }, timestamp: new Date().toISOString() });
    }
    emitEvent('task.deleted', { id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { router as taskRoutes };
