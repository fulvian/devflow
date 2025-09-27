import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Lightweight logger
const log = (...args: any[]) => console.log('[ContextInjection]', ...args);
const warn = (...args: any[]) => console.warn('[ContextInjection]', ...args);

// ENV CONFIG
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONTEXT_INJECTION_ENABLED = process.env.CONTEXT_INJECTION_ENABLED !== 'false';
const CONTEXT_TOKEN_BUDGET = parseInt(process.env.CONTEXT_TOKEN_BUDGET || '2000', 10);
const CONTEXT_SIMILARITY_THRESHOLD = parseFloat(process.env.CONTEXT_SIMILARITY_THRESHOLD || '0.7');
const CONTEXT_MAX_BLOCKS = parseInt(process.env.CONTEXT_MAX_BLOCKS || '8', 10);
const CONTEXT_TEMPLATE = (process.env.CONTEXT_TEMPLATE || 'default') as 'default' | 'compact';

// Dynamic imports from compiled core (dist) to avoid TS cross-package constraints
async function loadCore() {
  const root = resolve(__dirname, '../../..');
  const taskMod = await import(resolve(root, 'dist/core/task-hierarchy/task-hierarchy-service.js'));
  const semanticMod = await import(resolve(root, 'dist/core/semantic-memory/semantic-memory-service.js'));
  const compMod = await import(resolve(root, 'src/core/memory-bridge/context-compression.ts')) // use TS at build time
    .catch(async () => await import(resolve(root, 'dist/core/memory-bridge/context-compression.js')));
  return {
    TaskHierarchyService: taskMod.TaskHierarchyService,
    TaskStatus: taskMod.TaskStatus,
    SemanticMemoryService: semanticMod.SemanticMemoryService,
    ContextCompressor: compMod.ContextCompressor,
  };
}

// Try to load Ollama embedding model from source (TS) or dist fallback
async function loadEmbeddingModel(): Promise<any | null> {
  const root = resolve(__dirname, '../../..');
  const modTs = await import(resolve(root, 'src/core/embeddings/ollama-embedding-model.ts')).catch(() => null);
  if (modTs?.OllamaEmbeddingModel) return modTs.OllamaEmbeddingModel;
  const modJs = await import(resolve(root, 'dist/core/embeddings/ollama-embedding-model.js')).catch(() => null);
  if (modJs?.OllamaEmbeddingModel) return modJs.OllamaEmbeddingModel;
  return null;
}

// Local deterministic embedding model (no network). Not a mock: cosine similarity over hashed tokens.
class LocalEmbeddingModel {
  public id = 'local-context-embedding-v1';
  public name = 'LocalContextEmbeddingV1';
  public dimensions = 256;

  async generateEmbedding(content: string): Promise<number[]> {
    const vec = new Array(this.dimensions).fill(0);
    const tokens = content.toLowerCase().split(/\W+/).filter(Boolean);
    for (const tok of tokens) {
      let h = 0;
      for (let i = 0; i < tok.length; i++) h = (h * 31 + tok.charCodeAt(i)) >>> 0;
      const idx = h % this.dimensions;
      vec[idx] += 1;
    }
    const norm = Math.sqrt(vec.reduce((a, v) => a + v * v, 0)) || 1;
    return vec.map(v => v / norm);
  }

  async calculateSimilarity(a: number[], b: number[]): Promise<number> {
    const len = Math.min(a.length, b.length);
    let dot = 0, n1 = 0, n2 = 0;
    for (let i = 0; i < len; i++) { dot += a[i] * b[i]; n1 += a[i]*a[i]; n2 += b[i]*b[i]; }
    const denom = Math.sqrt(n1) * Math.sqrt(n2);
    return denom === 0 ? 0 : dot / denom;
  }
}

function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

function buildContextSection(blocks: Array<{ title: string; description: string | null; similarity: number; timestamp?: string }>, template: 'default' | 'compact', maxCharsPerBlock = 600): string {
  if (blocks.length === 0) return '';
  if (template === 'compact') {
    const lines = blocks.map(b => `- ${b.title} (sim=${b.similarity.toFixed(2)})`);
    return `[Contesto Recuperato]\n${lines.join('\n')}`;
  }
  const lines = blocks.map(b => {
    const ts = b.timestamp ? b.timestamp.slice(0, 19) : '';
    const desc = (b.description || '').replace(/\s+/g, ' ').slice(0, maxCharsPerBlock);
    return `- [${ts}] ${b.title} (sim=${b.similarity.toFixed(2)}): ${desc}`;
  });
  return `[Contesto Recuperato]\n${lines.join('\n')}`;
}

export async function prepareContextForPrompt(prompt: string, sessionId?: string): Promise<string> {
  try {
    if (!CONTEXT_INJECTION_ENABLED) return '';
    const { TaskHierarchyService, TaskStatus, SemanticMemoryService, ContextCompressor } = await loadCore();

    const tasks = new TaskHierarchyService(resolve(__dirname, '../../../devflow.sqlite'));
    await tasks.initialize();

    const semantic = new SemanticMemoryService(tasks, resolve(__dirname, '../../../data/devflow.sqlite'));

    // Register embedding model: prefer Ollama if healthy, else local deterministic
    const OllamaEmbeddingModel = await loadEmbeddingModel();
    let model: any;
    if (OllamaEmbeddingModel) {
      try {
        model = new OllamaEmbeddingModel({ baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434', model: process.env.OLLAMA_EMBED_MODEL || 'embeddinggemma:300m' });
        if (typeof model.healthCheck === 'function') {
          const healthy = await model.healthCheck();
          if (!healthy) {
            warn('Ollama embedding model not healthy, falling back to LocalEmbeddingModel');
            model = new LocalEmbeddingModel();
          }
        }
      } catch (e) {
        warn('Failed to init OllamaEmbeddingModel:', (e as Error).message);
        model = new LocalEmbeddingModel();
      }
    } else {
      model = new LocalEmbeddingModel();
    }

    semantic.registerEmbeddingModel(model);

    // Create ephemeral task for this prompt
    const temp = await tasks.createTask({
      title: `Prompt context: ${prompt.substring(0, 80)}`,
      description: prompt.substring(0, 2000),
      status: TaskStatus.ACTIVE,
      ccSessionId: sessionId || null,
      // store lightweight marker in platformRouting to avoid schema changes
      platformRouting: { ephemeral: true, parentSession: sessionId || null }
    });

    // Generate embedding for temp task and search similar
    await semantic.generateTaskEmbedding(temp.id, model.id);
    let similar = await semantic.findSimilarTasks(temp.id, model.id, CONTEXT_MAX_BLOCKS + 2, CONTEXT_SIMILARITY_THRESHOLD);

    // Filter out the temp task itself if present
    similar = similar.filter(r => r.taskId !== temp.id);

    // Transform to blocks and compress within token budget
    const blocks = similar.map(r => ({
      taskId: r.taskId,
      title: r.task?.title || '(senza titolo)',
      description: r.task?.description || null,
      similarity: r.similarity,
      timestamp: (r.task?.createdAt instanceof Date) ? (r.task.createdAt as Date).toISOString() : ''
    }));

    // Convert to MemoryBlock-like for compression reuse
    const toMemoryBlocks = blocks.map((b, i) => ({
      id: `${b.taskId}_${i}`,
      content: `${b.title}\n${b.description || ''}`,
      type: 'semantic',
      importance: Math.min(Math.max(b.similarity, 0), 1),
      tokens: estimateTokens(`${b.title} ${b.description || ''}`),
      timestamp: Date.now(),
    }));

    const compressor = new ContextCompressor({ tokenBudget: CONTEXT_TOKEN_BUDGET });
    const compressed = compressor.compressContext(toMemoryBlocks);

    // Map back to blocks and build section
    const byId = new Map<string, typeof blocks[number]>();
    blocks.forEach(b => byId.set(b.taskId, b));
    const selected = compressed.map(mb => {
      const key = mb.id.split('_')[0];
      // find exact block by id prefix
      const found = blocks.find(b => mb.id.startsWith(b.taskId));
      return found || byId.get(key)!;
    }).filter(Boolean);

    const section = buildContextSection(selected, CONTEXT_TEMPLATE);
    const prefix = section ? section + '\n\n' : '';

    // Best-effort cleanup: mark ephemeral as archived (dist service exposes updateTask)
    try {
      if (typeof (tasks as any).updateTask === 'function') {
        await (tasks as any).updateTask(temp.id, { status: TaskStatus.ARCHIVED });
      }
    } catch (e) {
      warn('Failed to archive temp task:', (e as Error).message);
    }

    return prefix;
  } catch (error) {
    warn('Context preparation failed:', (error as Error).message);
    return '';
  }
}

