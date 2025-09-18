import { Router } from 'express';
import { ApiResponse } from '../types';
import { db } from '../services/db';
import { z } from 'zod';
import { emitEvent } from '../ws/events';

const router = Router();

// Context7/Cometa-compliant schemas mapped to memory_blocks
const StoreSchema = z.object({
  id: z.string().optional(),
  content: z.string().min(1),
  type: z.string().min(1).default('note'),
  metadata: z.record(z.any()).optional(),
  taskId: z.string().optional(),
  timestamp: z.string().optional(),
});

const QuerySchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().max(100).optional(),
  mode: z.enum(['text', 'semantic', 'hybrid']).optional(),
  filters: z.record(z.any()).optional()
});

// Simple local embedding model (EmbeddingGemma-like deterministic)
const EMBEDDING_MODEL_ID = 'gemma-7b-embedding';
const EMBEDDING_DIMS = 768;

function generateEmbedding(text: string): Float32Array {
  const normalized = text.toLowerCase().trim();
  const vec = new Float32Array(EMBEDDING_DIMS);
  let seed = 0;
  for (let i = 0; i < normalized.length; i++) seed += normalized.charCodeAt(i);
  for (let i = 0; i < EMBEDDING_DIMS; i++) {
    const angle = (seed * i * 0.01) % (2 * Math.PI);
    vec[i] = Math.sin(angle) * Math.cos(seed * i * 0.001);
  }
  // normalize
  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIMS; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < EMBEDDING_DIMS; i++) vec[i] /= norm;
  return vec;
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / ((Math.sqrt(na) || 1) * (Math.sqrt(nb) || 1));
}

function bufferToFloat32Array(buf: Buffer): Float32Array {
  return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
}

// POST /api/memory/query → search memory_blocks by content
router.post('/query', async (req, res, next) => {
  try {
    const parsed = QuerySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid query payload', details: parsed.error.flatten() }, timestamp: new Date().toISOString() });
    }
    const { query, limit = 10, mode = 'text' } = parsed.data as any;

    if (mode === 'text') {
      const stmt = db.prepare(`
        SELECT id, content, type, timestamp, metadata, task_id
        FROM memory_blocks
        WHERE content LIKE ?
           OR type LIKE ?
           OR (metadata IS NOT NULL AND metadata LIKE ?)
        ORDER BY timestamp DESC
        LIMIT ?
      `);
      const like = `%${query}%`;
      const rows = stmt.all(like, like, like, limit);
      const results = rows.map((r: any) => ({ id: r.id, content: r.content, type: r.type, timestamp: r.timestamp, metadata: r.metadata ? JSON.parse(r.metadata) : {}, taskId: r.task_id || undefined }));
      const response: ApiResponse = { success: true, data: results, timestamp: new Date().toISOString() };
      return res.json(response);
    }

    // Semantic or Hybrid mode
    // 1) Ensure embeddings for all memory_blocks exist for this model
    const allBlocks = db.prepare('SELECT id, content, type, timestamp, metadata, task_id FROM memory_blocks').all();
    const ids = allBlocks.map((b: any) => b.id);
    const existing = db.prepare(`
      SELECT memory_block_id, embedding_vector
      FROM memory_block_embeddings
      WHERE model_id = ?
        AND memory_block_id IN (${ids.map(() => '?').join(',') || "''"})
    `).all(EMBEDDING_MODEL_ID, ...ids);
    const have = new Set(existing.map((e: any) => e.memory_block_id));
    const toCreate = allBlocks.filter((b: any) => !have.has(b.id));

    if (toCreate.length > 0) {
      const insert = db.prepare(`
        INSERT INTO memory_block_embeddings (id, memory_block_id, model_id, embedding_vector, dimensions, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const now = new Date().toISOString();
      for (const b of toCreate) {
        const emb = generateEmbedding(String(b.content || ''));
        const buf = Buffer.from(new Float32Array(emb).buffer);
        insert.run(`emb_${Date.now()}_${Math.random().toString(36).slice(2)}`, b.id, EMBEDDING_MODEL_ID, buf, EMBEDDING_DIMS, now);
      }
    }

    // 2) Load embeddings and compute cosine similarity to query embedding
    const qEmb = generateEmbedding(query);
    const loaded = db.prepare(`
      SELECT mbe.memory_block_id as id, mbe.embedding_vector as vec,
             mb.content, mb.type, mb.timestamp, mb.metadata, mb.task_id
      FROM memory_block_embeddings mbe
      JOIN memory_blocks mb ON mb.id = mbe.memory_block_id
      WHERE mbe.model_id = ?
    `).all(EMBEDDING_MODEL_ID);

    const scored = loaded.map((row: any) => {
      const v = bufferToFloat32Array(row.vec as Buffer);
      const score = cosineSimilarity(qEmb, v);
      return {
        id: row.id,
        content: row.content,
        type: row.type,
        timestamp: row.timestamp,
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
        taskId: row.task_id || undefined,
        similarity: score
      };
    });

    // If hybrid, lightly boost entries that also match text
    if (mode === 'hybrid') {
      const like = `%${query}%`;
      const matchIds = new Set(
        db.prepare(`SELECT id FROM memory_blocks WHERE content LIKE ? OR type LIKE ? OR (metadata IS NOT NULL AND metadata LIKE ?)`)
          .all(like, like, like)
          .map((r: any) => r.id)
      );
      for (const s of scored) {
        if (matchIds.has(s.id)) s.similarity += 0.05; // small boost
      }
    }

    const results = scored
      .sort((a: any, b: any) => (b.similarity - a.similarity))
      .slice(0, limit);

    const response: ApiResponse = { success: true, data: results, timestamp: new Date().toISOString() };
    return res.json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/memory/store → insert into memory_blocks
router.post('/store', async (req, res, next) => {
  try {
    const parsed = StoreSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid store payload', details: parsed.error.flatten() }, timestamp: new Date().toISOString() });
    }
    const { id, content, type, metadata, taskId, timestamp } = parsed.data;
    const finalId = id ?? `mem_${Date.now()}`;
    const ts = timestamp ?? new Date().toISOString();
    const stmt = db.prepare(`INSERT INTO memory_blocks (id, content, type, timestamp, metadata, task_id) VALUES (?, ?, ?, ?, ?, ?)`);
    stmt.run(finalId, content, type, ts, metadata ? JSON.stringify(metadata) : null, taskId ?? null);
    const payload = { id: finalId, content, type, timestamp: ts, metadata: metadata || {}, taskId };
    const response: ApiResponse = { success: true, data: payload, timestamp: ts };
    emitEvent('memory.stored', payload);
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/memory/:id → select from memory_blocks
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT id, content, type, timestamp, metadata, task_id FROM memory_blocks WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Memory entry not found' }, timestamp: new Date().toISOString() });
    }
    const entry = { id: row.id, content: row.content, type: row.type, timestamp: row.timestamp, metadata: row.metadata ? JSON.parse(row.metadata) : {}, taskId: row.task_id || undefined };
    const response: ApiResponse = { success: true, data: entry, timestamp: new Date().toISOString() };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

export { router as memoryRoutes };
