import { SQLiteMemoryManager } from '@devflow/core';
import type { MemoryBlock, TaskContext } from '@devflow/shared';
import { ContextManager } from './context/manager.js';
import { registerHooks, type HookRegistrar, type SessionEvent } from './hooks/index.js';
import { safeMkdir } from './filesystem/safe-ops.js';

export interface ClaudeAdapterConfig {
  contextDir?: string; // defaults to .claude/context
  task?: Pick<TaskContext, 'title' | 'priority'> & Partial<TaskContext>;
}

export class ClaudeAdapter implements HookRegistrar {
  private contextDir: string;
  private memory: SQLiteMemoryManager;
  private context: ContextManager;

  constructor(cfg: ClaudeAdapterConfig = {}) {
    this.contextDir = cfg.contextDir ?? `${process.cwd()}/.claude/context`;
    this.memory = new SQLiteMemoryManager();
    this.context = new ContextManager(this.memory, this.contextDir);
    safeMkdir(this.contextDir);
  }

  register(cc: SessionEvent): void {
    registerHooks(cc, this);
  }

  async onSessionStart(event: { sessionId: string; taskId?: string }): Promise<void> {
    // Inject context at session start
    await this.context.inject(event.taskId, event.sessionId);
  }

  async onSessionEnd(event: { sessionId: string; taskId: string }): Promise<void> {
    // Extract and persist context
    await this.context.extractAndStore(event.taskId, event.sessionId);
  }

  async onToolUsed(event: { sessionId: string; taskId: string; tool: string; payload?: unknown }): Promise<void> {
    // Save context after significant tool usage
    await this.context.extractAndStore(event.taskId, event.sessionId, { reason: `tool:${event.tool}` });
  }

  async saveBlocks(taskId: string, sessionId: string, blocks: MemoryBlock[]): Promise<void> {
    for (const b of blocks) {
      await this.memory.storeMemoryBlock({
        taskId,
        sessionId,
        blockType: b.blockType,
        label: b.label,
        content: b.content,
        metadata: b.metadata ?? {},
        importanceScore: b.importanceScore ?? 0.5,
        relationships: b.relationships ?? [],
        embeddingModel: b.embeddingModel,
      });
    }
  }
}

