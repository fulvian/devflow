import { SQLiteMemoryManager } from '@devflow/core';
// import type { MemoryBlock } from '@devflow/shared';
import { extractFromClaudeContext } from './extractor.js';
import { injectToClaudeContext } from './injector.js';
import { detectImportant } from './detector.js';

export class ContextManager {
  constructor(private memory: SQLiteMemoryManager, private contextDir: string) {}

  async extractAndStore(taskId: string, sessionId: string, meta?: { reason?: string }): Promise<void> {
    const { blocks } = await extractFromClaudeContext(this.contextDir, taskId, sessionId);
    const scored = detectImportant(blocks);
    for (const b of scored) {
      await this.memory.storeMemoryBlock({
        taskId,
        sessionId,
        blockType: b.blockType,
        label: b.label,
        content: b.content,
        metadata: { ...b.metadata, reason: meta?.reason },
        importanceScore: b.importanceScore,
        relationships: b.relationships,
      });
    }
  }

  async inject(taskId: string | undefined, sessionId: string): Promise<void> {
    if (!taskId) return;
    const blocks = await this.memory.retrieveMemoryBlocks({ taskId, limit: 20 });
    const compacted = blocks.slice(0, 20);
    await injectToClaudeContext(this.contextDir, {
      sessionId,
      taskId,
      blocks: compacted.map(b => ({ id: b.id, label: b.label, type: b.blockType, importance: b.importanceScore }))
    });
  }
}

