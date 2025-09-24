#!/usr/bin/env node

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../..');

const log = (...args) => console.log('[IntelligentSaveHook]', ...args);
const err = (...args) => console.error('[IntelligentSaveHook]', ...args);

async function loadCore() {
  const taskMod = await import(path.resolve(root, 'dist/core/task-hierarchy/task-hierarchy-service.js'));
  const semanticMod = await import(path.resolve(root, 'dist/core/semantic-memory/semantic-memory-service.js'));
  const udbMod = await import(path.resolve(root, 'dist/database/UnifiedDatabaseManager.js'));
  // harvesting + cache (from dist)
  const harvestMod = await import(path.resolve(root, 'dist/core/memory-bridge/harvesting-protocol.js'));
  const cacheMod = await import(path.resolve(root, 'dist/core/memory-bridge/memory-cache.js'));
  return {
    TaskHierarchyService: taskMod.TaskHierarchyService,
    TaskStatus: taskMod.TaskStatus,
    SemanticMemoryService: semanticMod.SemanticMemoryService,
    UnifiedDatabaseManager: udbMod.UnifiedDatabaseManager,
    HarvestingProtocol: harvestMod.HarvestingProtocol,
    MemoryCache: cacheMod.MemoryCache,
  };
}

class LocalEmbeddingModel {
  id = 'local-context-embedding-v1';
  name = 'LocalContextEmbeddingV1';
  dimensions = 256;
  async generateEmbedding(content) {
    const dims = this.dimensions;
    const vec = new Array(dims).fill(0);
    const tokens = (content || '').toLowerCase().split(/\W+/).filter(Boolean);
    for (const tok of tokens) {
      let h = 0;
      for (let i = 0; i < tok.length; i++) h = (h * 31 + tok.charCodeAt(i)) >>> 0;
      vec[h % dims] += 1;
    }
    const norm = Math.sqrt(vec.reduce((a, v) => a + v * v, 0)) || 1;
    return vec.map(v => v / norm);
  }
  async calculateSimilarity(a, b) {
    const len = Math.min(a.length, b.length);
    let dot = 0, n1 = 0, n2 = 0;
    for (let i = 0; i < len; i++) { dot += a[i] * b[i]; n1 += a[i]*a[i]; n2 += b[i]*b[i]; }
    const denom = Math.sqrt(n1) * Math.sqrt(n2);
    return denom === 0 ? 0 : dot / denom;
  }
}

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
}

async function main() {
  try {
    const raw = await readStdin();
    const hookData = JSON.parse(raw || '{}');
    const { hook_event_name, session_id, transcript_path } = hookData;

    if (!hook_event_name) {
      console.log(JSON.stringify({ continue: true, suppressOutput: false }));
      return;
    }

    const transcript = (transcript_path && fs.existsSync(transcript_path))
      ? await fsp.readFile(transcript_path, 'utf8')
      : (hookData.transcript || '');

    const { TaskHierarchyService, TaskStatus, SemanticMemoryService, UnifiedDatabaseManager, HarvestingProtocol, MemoryCache } = await loadCore();

    const tasks = new TaskHierarchyService(path.resolve(root, 'data/devflow_unified.sqlite'));
    await tasks.initialize();
    const semantic = new SemanticMemoryService(tasks, path.resolve(root, 'data/devflow_unified.sqlite'));
    semantic.registerEmbeddingModel(new LocalEmbeddingModel());

    // Extract knowledge and store basic memory blocks (optional)
    const cache = new MemoryCache(1000, { enabled: false, storageKey: 'hook_cache', syncInterval: 60000 });
    const harvester = new HarvestingProtocol(cache);
    if (transcript) {
      harvester.processTaskOutput(session_id || `session_${Date.now()}`, transcript);
    }

    // Persist a snapshot task with summary content
    const summary = (transcript || '').replace(/\s+/g, ' ').slice(0, 2000);
    const snapshot = await tasks.createTask({
      title: `Savepoint ${new Date().toISOString()} (${hook_event_name})`,
      description: summary,
      status: TaskStatus.ACTIVE,
      ccSessionId: session_id || null,
      platformRouting: { hookEvent: hook_event_name, savepoint: true }
    });

    await semantic.generateTaskEmbedding(snapshot.id, 'local-context-embedding-v1');

    // Optionally store raw memory block for transcript
    try {
      const udb = new UnifiedDatabaseManager(path.resolve(root, 'data/devflow_unified.sqlite'));
      const mbId = `hook_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      udb.storeMemoryBlock(mbId, summary, 'episodic', new Date().toISOString(), null);
      udb.close();
    } catch (e) {
      err('Failed to store raw memory block:', e.message);
    }

    // Archive snapshot to keep list tidy (best effort)
    if (typeof tasks.updateTask === 'function') {
      await tasks.updateTask(snapshot.id, { status: TaskStatus.ARCHIVED });
    }

    console.log(JSON.stringify({ continue: true, suppressOutput: false }));
  } catch (e) {
    err('Hook failed:', e.message);
    console.log(JSON.stringify({ continue: true, suppressOutput: false }));
  }
}

main();

