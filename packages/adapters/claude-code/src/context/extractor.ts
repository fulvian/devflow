import { readJSONSafe, listFilesRecursively } from '../filesystem/safe-ops.js';
import type { MemoryBlock } from '@devflow/shared';

export interface ExtractedContext {
  blocks: MemoryBlock[];
}

export async function extractFromClaudeContext(contextDir: string, taskId: string, sessionId: string): Promise<ExtractedContext> {
  const files = listFilesRecursively(contextDir);
  const blocks: MemoryBlock[] = [];
  for (const f of files) {
    if (f.endsWith('.json')) {
      const json = readJSONSafe(f);
      if (!json) continue;
      blocks.push({
        id: crypto.randomUUID(),
        taskId,
        sessionId,
        blockType: 'context',
        label: f.split('/').slice(-1)[0],
        content: JSON.stringify(json).slice(0, 5000),
        metadata: { source: 'claude_context', path: f },
        importanceScore: 0.5,
        relationships: [],
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 1,
      });
    }
  }
  return { blocks };
}

