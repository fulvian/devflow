#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const CONTEXT_TOKEN_BUDGET = parseInt(process.env.CONTEXT_TOKEN_BUDGET || '2000', 10);
const CONTEXT_SIMILARITY_THRESHOLD = parseFloat(process.env.CONTEXT_SIMILARITY_THRESHOLD || '0.7');
const CONTEXT_MAX_BLOCKS = parseInt(process.env.CONTEXT_MAX_BLOCKS || '8', 10);
const CONTEXT_TEMPLATE = (process.env.CONTEXT_TEMPLATE || 'default');

const log = (...a) => console.log('[CTXTEST]', ...a);
const warn = (...a) => console.warn('[CTXTEST]', ...a);

async function loadCore() {
  const taskMod = await import(path.resolve(root, 'dist/core/task-hierarchy/task-hierarchy-service.js'));
  const semanticMod = await import(path.resolve(root, 'dist/core/semantic-memory/semantic-memory-service.js'));
  const compMod = await import(path.resolve(root, 'dist/core/memory-bridge/context-compression.js'));
  return {
    TaskHierarchyService: taskMod.TaskHierarchyService,
    TaskStatus: taskMod.TaskStatus,
    SemanticMemoryService: semanticMod.SemanticMemoryService,
    ContextCompressor: compMod.ContextCompressor,
  };
}

class LocalEmbeddingModel {
  id = 'local-context-embedding-v1';
  name = 'LocalContextEmbeddingV1';
  dimensions = 256;
  async generateEmbedding(content) {
    const dims = this.dimensions; const vec = new Array(dims).fill(0);
    const tokens = (content || '').toLowerCase().split(/\W+/).filter(Boolean);
    for (const tok of tokens) { let h = 0; for (let i = 0; i < tok.length; i++) h = (h * 31 + tok.charCodeAt(i)) >>> 0; vec[h % dims] += 1; }
    const norm = Math.sqrt(vec.reduce((a, v) => a + v * v, 0)) || 1; return vec.map(v => v / norm);
  }
  async calculateSimilarity(a, b) { const len = Math.min(a.length, b.length); let d = 0, n1 = 0, n2 = 0; for (let i = 0; i < len; i++) { d += a[i] * b[i]; n1 += a[i] * a[i]; n2 += b[i] * b[i]; }
    const den = Math.sqrt(n1) * Math.sqrt(n2); return den === 0 ? 0 : d / den; }
}

function estimateTokens(text) { return Math.ceil((text || '').length / 4); }

function buildContextSection(blocks, template = 'default', maxCharsPerBlock = 600) {
  if (!blocks.length) return '';
  if (template === 'compact') {
    const lines = blocks.map(b => `- ${b.title} (sim=${b.similarity.toFixed(2)})`);
    return `[Contesto Recuperato]\n${lines.join('\n')}`;
  }
  const lines = blocks.map(b => `- [${(b.timestamp || '').slice(0,19)}] ${b.title} (sim=${b.similarity.toFixed(2)}): ${(b.description||'').replace(/\s+/g,' ').slice(0, maxCharsPerBlock)}`);
  return `[Contesto Recuperato]\n${lines.join('\n')}`;
}

async function run() {
  const prompt = process.argv[2] || 'Design microservices with embeddings and context memory';
  const sessionId = process.argv[3] || `sess_${Date.now()}`;

  const { TaskHierarchyService, TaskStatus, SemanticMemoryService, ContextCompressor } = await loadCore();
  const tasks = new TaskHierarchyService(path.resolve(root, 'data/devflow_unified.sqlite'));
  await tasks.initialize();
  const semantic = new SemanticMemoryService(tasks, path.resolve(root, 'data/data/devflow_unified.sqlite'));
  semantic.registerEmbeddingModel(new LocalEmbeddingModel());

  const temp = await tasks.createTask({
    title: `Prompt context: ${prompt.substring(0, 80)}`,
    description: prompt.substring(0, 2000),
    status: TaskStatus.ACTIVE,
    ccSessionId: sessionId,
    platformRouting: { ephemeral: true, parentSession: sessionId }
  });

  await semantic.generateTaskEmbedding(temp.id, 'local-context-embedding-v1');
  let similar = await semantic.findSimilarTasks(temp.id, 'local-context-embedding-v1', CONTEXT_MAX_BLOCKS + 2, CONTEXT_SIMILARITY_THRESHOLD);
  similar = similar.filter(r => r.taskId !== temp.id);

  const blocks = similar.map(r => ({
    taskId: r.taskId,
    title: r.task?.title || '(senza titolo)',
    description: r.task?.description || null,
    similarity: r.similarity,
    timestamp: (r.task?.createdAt instanceof Date) ? r.task.createdAt.toISOString() : ''
  }));

  const toMemoryBlocks = blocks.map((b, i) => ({ id: `${b.taskId}_${i}`, content: `${b.title}\n${b.description || ''}`, type: 'semantic', importance: Math.min(Math.max(b.similarity, 0), 1), tokens: estimateTokens(`${b.title} ${b.description || ''}`), timestamp: Date.now() }));
  const compressor = new ContextCompressor({ tokenBudget: CONTEXT_TOKEN_BUDGET });
  const compressed = compressor.compressContext(toMemoryBlocks);

  const selected = compressed.map(mb => { const key = mb.id.split('_')[0]; return blocks.find(b => mb.id.startsWith(b.taskId)) || blocks.find(b => b.taskId === key); }).filter(Boolean);
  const section = buildContextSection(selected, CONTEXT_TEMPLATE);

  await (typeof tasks.updateTask === 'function' ? tasks.updateTask(temp.id, { status: TaskStatus.ARCHIVED }) : Promise.resolve());

  log('Prompt:', prompt.slice(0, 80) + (prompt.length > 80 ? '...' : ''));
  log('Selected blocks:', selected.length);
  if (selected.length) {
    console.log(section);
  } else {
    log('No semantic context available (seed via hooks then retry).');
  }
}

run().catch(e => { console.error('[CTXTEST] Failed:', e?.message || e); process.exit(1); });

