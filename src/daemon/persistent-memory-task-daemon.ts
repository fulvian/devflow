import http, { IncomingMessage, ServerResponse } from 'http';
import { randomBytes } from 'crypto';
// Use minimal-typed import to avoid external @types dependency
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - local ambient typing provided in src/types/better-sqlite3.d.ts
import Database from 'better-sqlite3';
import { z } from 'zod';

type Platform = 'claude_code' | 'openai_codex' | 'gemini_cli' | 'cursor' | 'openrouter';

interface TaskRecord {
  id: string;
  title: string;
  description?: string;
  priority?: 'h-' | 'm-' | 'l-' | '?-';
  status?: 'planning' | 'active' | 'blocked' | 'completed' | 'archived';
  primary_platform?: Platform;
}

interface SessionRecord {
  id: string;
  task_id: string;
  platform: Platform;
  session_type?: 'development' | 'review' | 'debugging' | 'handoff' | 'planning';
  start_time?: string;
}

type BlockType = 'architectural' | 'implementation' | 'debugging' | 'maintenance' | 'context' | 'decision' | 'emergency_context' | 'context_snapshot';

interface MemoryBlockRecord {
  id: string;
  task_id: string;
  session_id: string;
  block_type: BlockType;
  label: string;
  content: string;
  metadata?: unknown;
}

const PORT = Number(process.env.DEVFLOW_MEMORY_DAEMON_PORT || 3055);
const DB_PATH = process.env.DEVFLOW_DB_PATH || 'devflow.sqlite';
const PID_FILE = process.env.DEVFLOW_MEMORY_DAEMON_PID || '.memory-task-daemon.pid';

const StartSessionSchema = z.object({
  platform: z.enum(['claude_code', 'openai_codex', 'gemini_cli', 'cursor', 'openrouter']).default('claude_code'),
  title: z.string().min(1).default('Development Session'),
  description: z.string().optional(),
  priority: z.enum(['h-', 'm-', 'l-', '?-']).default('m-'),
  status: z.enum(['planning', 'active', 'blocked', 'completed', 'archived']).default('active'),
  taskId: z.string().optional(),
});

const StoreMemorySchema = z.object({
  taskId: z.string(),
  sessionId: z.string(),
  blockType: z.enum(['architectural', 'implementation', 'debugging', 'maintenance', 'context', 'decision', 'emergency_context', 'context_snapshot']),
  label: z.string().min(1),
  content: z.string().min(1),
  metadata: z.unknown().optional(),
});

const EndSessionSchema = z.object({
  sessionId: z.string(),
});

function genId(): string {
  return randomBytes(16).toString('hex');
}

class MemoryTaskStore {
  private db: Database.Database;
  // statements are prepared on demand to avoid init failures

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { fileMustExist: true, readonly: false });
    try {
      // Allow triggers to write to FTS5 virtual tables in this trusted schema context
      this.db.pragma('trusted_schema=ON');
    } catch {
      // ignore if not supported
    }
  }

  createTask(input: TaskRecord): string {
    const id = input.id || genId();
    const toInsert = {
      id,
      title: input.title,
      description: input.description ?? '',
      priority: input.priority ?? 'm-',
      status: input.status ?? 'active',
      platform: input.primary_platform ?? 'claude_code',
    } as const;
    this.db.prepare('INSERT INTO task_contexts (id, title, description, priority, status, primary_platform) VALUES (@id, @title, @description, @priority, @status, @platform)').run(toInsert);
    return id;
  }

  createSession(taskId: string, platform: Platform, sessionType: SessionRecord['session_type'] = 'development'): string {
    const sid = genId();
    try {
      this.db
        .prepare(
          "INSERT INTO coordination_sessions (id, task_id, platform, session_type, start_time) VALUES (@id, @task_id, @platform, @session_type, datetime('now','utc'))"
        )
        .run({ id: sid, task_id: taskId, platform, session_type: sessionType });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[daemon] coordination_sessions insert failed; proceeding logically', (e as Error).message);
    }
    return sid;
  }

  ensureTask(fallback: Omit<TaskRecord, 'id'>, taskId?: string): string {
    if (taskId) {
      const row = this.db.prepare('SELECT id FROM task_contexts WHERE id = ?').get(taskId) as { id: string } | undefined;
      if (row?.id) return row.id;
    }
    return this.createTask({ id: genId(), ...fallback });
  }

  endSession(sessionId: string): void {
    try {
      this.db.prepare("UPDATE coordination_sessions SET end_time = datetime('now','utc') WHERE id = ?").run(sessionId);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[daemon] coordination_sessions end failed; proceeding logically', (e as Error).message);
    }
  }

  storeMemory(block: MemoryBlockRecord): string {
    const id = block.id || genId();
    const metadata = block.metadata ? JSON.stringify(block.metadata) : '{}';
    try {
      this.db
        .prepare(
          'INSERT INTO memory_blocks (id, task_id, session_id, block_type, label, content, metadata) VALUES (@id, @task_id, @session_id, @block_type, @label, @content, @metadata)'
        )
        .run({
          id,
          task_id: block.task_id,
          session_id: block.session_id,
          block_type: block.block_type,
          label: block.label,
          content: block.content,
          metadata,
        });
    } catch (e) {
      // Fallback: persist inside task_contexts.implementation_context JSON
      // eslint-disable-next-line no-console
      console.warn('[daemon] memory_blocks insert failed; storing in task implementation_context', (e as Error).message);
      const row = this.db
        .prepare('SELECT implementation_context FROM task_contexts WHERE id = ?')
        .get(block.task_id) as { implementation_context?: string } | undefined;
      let json: unknown = {};
      try {
        json = row?.implementation_context ? JSON.parse(row.implementation_context) : {};
      } catch {
        json = {};
      }
      const container = (json && typeof json === 'object' ? (json as Record<string, unknown>) : {});
      const arr = Array.isArray(container.memories) ? (container.memories as unknown[]) : [];
      arr.push({
        id,
        sessionId: block.session_id,
        type: block.block_type,
        label: block.label,
        content: block.content,
        metadata: block.metadata ?? {},
        storedAt: new Date().toISOString(),
      });
      container.memories = arr;
      this.db
        .prepare('UPDATE task_contexts SET implementation_context = @ctx WHERE id = @id')
        .run({ id: block.task_id, ctx: JSON.stringify(container) });
    }
    return id;
  }
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8') || '{}';
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(json);
}

function writePidFile(pidPath: string): void {
  try {
    require('fs').writeFileSync(pidPath, String(process.pid));
  } catch {
    // ignore
  }
}

function start(): void {
  const store = new MemoryTaskStore(DB_PATH);
  writePidFile(PID_FILE);

  const server = http.createServer(async (req, res) => {
    try {
      const url = req.url || '/';
      if (req.method === 'GET' && url === '/health') {
        return send(res, 200, { ok: true, service: 'memory-task-daemon', db: DB_PATH });
      }

      if (req.method === 'POST' && url === '/session/start') {
        const parsed = StartSessionSchema.parse(await readJson(req));
        // eslint-disable-next-line no-console
        console.log('[daemon] /session/start request', { platform: parsed.platform, title: parsed.title });
        const taskId = store.ensureTask({
          title: parsed.title,
          description: parsed.description,
          priority: parsed.priority,
          status: parsed.status,
          primary_platform: parsed.platform,
        }, parsed.taskId);
        // eslint-disable-next-line no-console
        console.log('[daemon] created/ensured task', taskId);
        const sessionId = store.createSession(taskId, parsed.platform);
        // eslint-disable-next-line no-console
        console.log('[daemon] created session', sessionId);
        return send(res, 200, { taskId, sessionId });
      }

      if (req.method === 'POST' && url === '/task/create') {
        const parsed = StartSessionSchema.omit({ taskId: true }).parse(await readJson(req));
        const id = store.createTask({
          id: genId(),
          title: parsed.title,
          description: parsed.description,
          priority: parsed.priority,
          status: parsed.status,
          primary_platform: parsed.platform,
        });
        return send(res, 200, { taskId: id });
      }

      if (req.method === 'POST' && url === '/memory/store') {
        const parsed = StoreMemorySchema.parse(await readJson(req));
        const id = store.storeMemory({
          id: genId(),
          task_id: parsed.taskId,
          session_id: parsed.sessionId,
          block_type: parsed.blockType,
          label: parsed.label,
          content: parsed.content,
          metadata: parsed.metadata,
        });
        return send(res, 200, { memoryId: id });
      }

      if (req.method === 'POST' && url === '/session/end') {
        const parsed = EndSessionSchema.parse(await readJson(req));
        store.endSession(parsed.sessionId);
        return send(res, 200, { ended: true });
      }

      return send(res, 404, { error: 'Not Found' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return send(res, 400, { error: message });
    }
  });

  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`DevFlow Memory+Task Daemon listening on http://localhost:${PORT}`);
  });

  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
  });
}

start();
