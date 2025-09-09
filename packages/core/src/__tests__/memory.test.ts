import { describe, it, expect, beforeAll } from 'vitest';
import { SQLiteMemoryManager } from '../memory/manager.js';
const SKIP_NATIVE = process.env['SKIP_NATIVE'] === '1';
const suite = SKIP_NATIVE ? describe.skip : describe;

suite('SQLiteMemoryManager basic flow', () => {
  beforeAll(() => {
    process.env['DEVFLOW_DB_PATH'] = process.env['DEVFLOW_DB_PATH'] ?? 'devflow.test.sqlite';
  });

  it('creates context, session, block and queries them', async () => {
    const mm = new SQLiteMemoryManager(process.env['DEVFLOW_DB_PATH']);
    const taskId = await mm.createTaskContext({
      title: 'Test Task',
      priority: 'm-',
      status: 'planning',
      architecturalContext: {},
      implementationContext: {},
      debuggingContext: {},
      maintenanceContext: {},
    });
    expect(taskId).toBeTruthy();

    const sessionId = await mm.startSession({
      taskId,
      platform: 'openrouter',
      sessionType: 'development',
      tokensUsed: 0,
      apiCalls: 0,
      estimatedCostUsd: 0,
      compactionEvents: 0,
      taskProgressDelta: 0,
      errorsEncountered: 0,
      metadata: {},
    });
    expect(sessionId).toBeTruthy();

    const blockId = await mm.storeMemoryBlock({
      taskId,
      sessionId,
      blockType: 'implementation',
      label: 'Hello',
      content: 'Hello world content',
      metadata: { platform: 'openrouter' },
      importanceScore: 0.9,
      relationships: [],
    });
    expect(blockId).toBeTruthy();

    const results = await mm.retrieveMemoryBlocks({ taskId });
    expect(results.length).toBeGreaterThan(0);
  });
});
