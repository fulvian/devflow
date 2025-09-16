#!/usr/bin/env node
/* DevFlow Orchestrator Smoke Runner */
const http = require('http');
const https = require('https');
const { spawnSync } = require('child_process');
const { existsSync, readFileSync } = require('fs');
const { resolve } = require('path');

const BASE = process.env.BASE || 'http://localhost:3005';
const TOKEN = process.env.TOKEN || process.env.DEVFLOW_API_SECRET || 'devflow-orchestrator-token';
const DB = process.env.DEVFLOW_DB_PATH || resolve(process.cwd(), 'data/devflow.sqlite');

function req(method, path, body) {
  return new Promise((resolveP, reject) => {
    const url = new URL(path, BASE);
    const lib = url.protocol === 'https:' ? https : http;
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = lib.request(url, {
      method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': String(data.length) } : {})
      }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        try { resolveP({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolveP({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const out = { ok: true, steps: [] };
  function step(name, fn) {
    return fn().then(r => { out.steps.push({ name, ok: true }); return r; })
      .catch(e => { out.ok = false; out.steps.push({ name, ok: false, error: String(e && e.message || e) }); throw e; });
  }

  console.log('Smoke Runner: BASE=%s DB=%s', BASE, DB);

  const health = await step('health', async () => {
    const r = await req('GET', '/health');
    if (r.status !== 200 || r.data?.status !== 'OK') throw new Error('health failed');
    return r;
  });
  console.log('health:', health.data);

  const sess = await step('sessions.create', async () => {
    const r = await req('POST', '/api/sessions', { name: 'smoke-session' });
    if (r.status !== 201 || !r.data?.data?.id) throw new Error('session create failed');
    return r.data.data;
  });
  console.log('session:', sess.id);

  const task = await step('tasks.create', async () => {
    const r = await req('POST', '/api/tasks', { title: 'Smoke Task', priority: 'high', description: 'smoke run' });
    if (r.status !== 201 || !r.data?.data?.id) throw new Error('task create failed');
    return r.data.data;
  });
  console.log('task:', task.id);

  const memStore = await step('memory.store', async () => {
    const r = await req('POST', '/api/memory/store', { session_id: sess.id, task_id: null, type: 'observation', content: 'Smoke note', metadata: { source: 'smoke' } });
    if (!([200,201].includes(r.status)) || !r.data?.data?.id) throw new Error('memory store failed');
    return r.data.data;
  });
  console.log('memory.store:', memStore.id);

  const memQuery = await step('memory.query', async () => {
    const r = await req('POST', '/api/memory/query', { sessionId: sess.id, query: 'Smoke', limit: 5, mode: 'hybrid', threshold: 0.1 });
    if (r.status !== 200 || !Array.isArray(r.data?.data)) throw new Error('memory query failed');
    return r.data.data.length;
  });
  console.log('memory.query count:', memQuery);

  const batchEnabled = process.env.DEVFLOW_SYNTHETIC_BATCH === '1';
  const synthResults = await step('synthetic.code(batch x4)', async () => {
    const reqs = Array.from({ length: 4 }, (_, i) => req('POST', '/api/synthetic/code', { prompt: `task ${i + 1} code please` }));
    const results = await Promise.all(reqs);
    return results.map(x => x.data?.data?.metadata || x.data?.metadata || {});
  });
  console.log('synthetic.metadata:', synthResults);
  if (batchEnabled) {
    const anyBatched = synthResults.some(m => m && (m.batched === true || m.batchSize));
    if (!anyBatched) {
      out.ok = false; out.steps.push({ name: 'batching-assert', ok: false, error: 'No batched responses observed' });
    } else {
      out.steps.push({ name: 'batching-assert', ok: true });
    }
  }

  if (existsSync(DB)) {
    const sql = `select 'synthetic_usage' as tab, count(*) as cnt from synthetic_usage;`;
    const p = spawnSync('sqlite3', [DB, sql], { encoding: 'utf8' });
    if (p.status === 0) console.log('metrics:', p.stdout.trim());
    else console.warn('sqlite3 metrics error:', p.stderr);
  } else {
    console.warn('DB file not found for metrics:', DB);
  }

  // cc-sessions log check
  try {
    const logPath = resolve(process.cwd(), '.claude/state/progress/devflow-orchestrator.log');
    if (existsSync(logPath)) {
      const tail = readFileSync(logPath, 'utf8').trim().split('\n').slice(-10).join('\n');
      console.log('cc-sessions log tail:\n' + tail);
    } else {
      console.warn('cc-sessions log not found at', logPath);
    }
  } catch {}

  console.log('\nSMOKE SUMMARY:', JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}

main().catch(e => { console.error('Smoke failed:', e); process.exit(1); });
