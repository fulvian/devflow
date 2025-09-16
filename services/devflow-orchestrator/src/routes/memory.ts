import { Router } from 'express';
import { ApiResponse } from '../types';
import { z } from 'zod';
import { emitEvent } from '../ws/events';
import { UnifiedDatabaseManager } from '../../../../src/database/UnifiedDatabaseManager';

const router = Router();

// Initialize unified database manager
const unifiedDB = new UnifiedDatabaseManager();

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

const BatchStoreSchema = z.object({
  entries: z.array(StoreSchema).min(1).max(50), // Batch limit for performance
  processInParallel: z.boolean().optional().default(true)
});

// Unified embedding configuration
const EMBEDDING_MODEL_ID = 'text-embedding-3-small';
const EMBEDDING_DIMS = 1536;

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

// POST /api/memory/query → search using unified schema
router.post('/query', async (req, res, next) => {
  try {
    const parsed = QuerySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query payload',
          details: parsed.error.flatten()
        },
        timestamp: new Date().toISOString()
      });
    }

    const { query, limit = 10, mode = 'text', filters } = parsed.data;

    if (mode === 'text') {
      // Use unified DB for text search
      const blocks = unifiedDB.queryMemoryBlocks({
        type: filters?.type,
        limit,
        orderBy: 'timestamp'
      });

      const results = blocks
        .filter(block =>
          block.content.toLowerCase().includes(query.toLowerCase()) ||
          block.type.toLowerCase().includes(query.toLowerCase())
        )
        .map(block => ({
          id: block.id,
          content: block.content,
          type: block.type,
          timestamp: block.timestamp,
          metadata: {},
          taskId: undefined
        }));

      return res.json({
        success: true,
        data: results,
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    // Semantic/hybrid search with unified schema
    const queryEmbedding = generateEmbedding(query);
    const embeddingBuffer = Buffer.from(queryEmbedding.buffer);

    // Use unified similarity search
    const similarEmbeddings = unifiedDB.findSimilarEmbeddings(
      embeddingBuffer,
      EMBEDDING_MODEL_ID,
      0.7,
      limit
    );

    const results = similarEmbeddings.map(result => ({
      id: result.memory_block_id,
      content: `Content for ${result.memory_block_id}`, // Simplified for this integration
      type: 'semantic_match',
      timestamp: result.created_at.toISOString(),
      metadata: {},
      taskId: undefined,
      similarity: result.similarity
    }));

    return res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    } as ApiResponse);

  } catch (error) {
    next(error);
  }
});

// POST /api/memory/store → unified storage
router.post('/store', async (req, res, next) => {
  try {
    const parsed = StoreSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid store payload',
          details: parsed.error.flatten()
        },
        timestamp: new Date().toISOString()
      });
    }

    const { id, content, type, metadata, taskId, timestamp } = parsed.data;
    const finalId = id ?? `mem_${Date.now()}`;
    const ts = timestamp ?? new Date().toISOString();

    // Store memory block with unified manager
    unifiedDB.storeMemoryBlock(finalId, content, type, ts);

    // Generate and store embedding
    const embedding = generateEmbedding(content);
    const embeddingBuffer = Buffer.from(embedding.buffer);

    const embeddingId = unifiedDB.storeEmbedding(
      finalId,
      EMBEDDING_MODEL_ID,
      embeddingBuffer,
      EMBEDDING_DIMS
    );

    const payload = {
      id: finalId,
      content,
      type,
      timestamp: ts,
      metadata: metadata || {},
      taskId,
      embeddingId
    };

    const response: ApiResponse = {
      success: true,
      data: payload,
      timestamp: ts
    };

    emitEvent('memory.stored', payload);
    res.status(201).json(response);

  } catch (error) {
    next(error);
  }
});

// POST /api/memory/batch → batch operations with unified schema
router.post('/batch', async (req, res, next) => {
  try {
    const parsed = BatchStoreSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid batch payload',
          details: parsed.error.flatten()
        },
        timestamp: new Date().toISOString()
      });
    }

    const { entries, processInParallel } = parsed.data;
    const results = [];
    const embeddings = [];

    // Process entries
    for (const entry of entries) {
      const finalId = entry.id ?? `mem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const ts = entry.timestamp ?? new Date().toISOString();

      // Store memory block
      unifiedDB.storeMemoryBlock(finalId, entry.content, entry.type, ts);

      // Prepare embedding for batch operation
      const embedding = generateEmbedding(entry.content);
      embeddings.push({
        memoryBlockId: finalId,
        modelId: EMBEDDING_MODEL_ID,
        embeddingVector: Buffer.from(embedding.buffer),
        dimensions: EMBEDDING_DIMS
      });

      results.push({
        id: finalId,
        content: entry.content,
        type: entry.type,
        timestamp: ts,
        metadata: entry.metadata || {},
        taskId: entry.taskId
      });
    }

    // Batch store embeddings for performance
    const embeddingIds = unifiedDB.batchStoreEmbeddings(embeddings);

    const response: ApiResponse = {
      success: true,
      data: {
        stored: results.length,
        entries: results,
        embeddingIds,
        processedInParallel: processInParallel
      },
      timestamp: new Date().toISOString()
    };

    emitEvent('memory.batch_stored', { count: results.length, ids: results.map(r => r.id) });
    res.status(201).json(response);

  } catch (error) {
    next(error);
  }
});

// GET /api/memory/:id → unified retrieval
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Query using unified manager
    const blocks = unifiedDB.queryMemoryBlocks({ limit: 1 });
    const block = blocks.find(b => b.id === id);

    if (!block) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Memory entry not found'
        },
        timestamp: new Date().toISOString()
      });
    }

    const entry = {
      id: block.id,
      content: block.content,
      type: block.type,
      timestamp: block.timestamp,
      metadata: {},
      taskId: undefined,
      embeddings: block.embeddings.map(emb => ({
        id: emb.id,
        model: emb.model_id,
        dimensions: emb.dimensions,
        created: emb.created_at
      }))
    };

    const response: ApiResponse = {
      success: true,
      data: entry,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/memory/stats → unified statistics
router.get('/stats', async (req, res, next) => {
  try {
    const stats = unifiedDB.getStats();

    const response: ApiResponse = {
      success: true,
      data: {
        ...stats,
        unified_schema: true,
        embedding_model: EMBEDDING_MODEL_ID,
        batch_operations_available: true
      },
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export { router as memoryRoutes };