#!/usr/bin/env node
// Lightweight Automatic CCR Runner (no TypeScript, no external deps)
// - Polls SQLite for active claude_code sessions
// - Triggers Emergency CCR when time utilization >= threshold (default 0.85)

const { spawn } = await import('child_process');

const DB_PATH = process.env.DEVFLOW_DB_PATH || './data/devflow_unified.sqlite';
const LIMIT_LOG = process.env.CLAUDE_LIMIT_LOG || '';
const POLL_MS = parseInt(process.env.CCR_POLL_INTERVAL_MS || '5000', 10);
const TRIGGER_LEVEL = (process.env.CCR_TRIGGER_LEVEL || 'critical').toLowerCase();
const THRESHOLDS = { warning: 0.7, critical: 0.85, emergency: 0.95 };
const LEVEL_UTIL = THRESHOLDS[TRIGGER_LEVEL] ?? THRESHOLDS.critical;
const MAX_DURATION_MS = 5 * 60 * 60 * 1000; // 5h Sonnet limit

let started = false;
let stopping = false;
let lastLimitTrigger = 0;

function log(msg) { console.log(`[AutoCCR] ${msg}`); }
function err(msg, e) { console.error(`[AutoCCR] ${msg}`, e || ''); }

function sqliteQuery(sql, args = []) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const proc = spawn('sqlite3', ['-json', DB_PATH, sql, ...args.map(String)]);
    let out = '', outErr = '';
    proc.stdout.on('data', d => { out += d.toString(); });
    proc.stderr.on('data', d => { outErr += d.toString(); });
    proc.on('close', code => {
      if (code !== 0) return reject(new Error(outErr || `sqlite3 exited ${code}`));
      try { resolve(JSON.parse(out || '[]')); } catch (e) { reject(e); }
    });
  });
}

async function getActiveClaudeSessions() {
  const sql = `SELECT id, task_id, platform, start_time, context_size_start, context_size_end, tokens_used
               FROM coordination_sessions
               WHERE end_time IS NULL AND platform='claude_code'`;
  return sqliteQuery(sql);
}

function timeUtilizationFrom(startTimeStr) {
  if (!startTimeStr) return 0;
  const start = new Date(startTimeStr).getTime();
  if (Number.isNaN(start)) return 0;
  const elapsed = Date.now() - start;
  return Math.max(0, Math.min(elapsed / MAX_DURATION_MS, 1));
}

async function triggerCCR(taskId, reason) {
  return new Promise((resolve) => {
    log(`Triggering Emergency CCR (task ${taskId}) — reason: ${reason}`);
    const proc = spawn('node', ['emergency-ccr-cli.mjs', 'start'], { stdio: 'inherit' });
    proc.on('close', () => resolve());
    proc.on('error', () => resolve());
  });
}

async function tick() {
  try {
    const sessions = await getActiveClaudeSessions();
    for (const s of sessions) {
      const util = timeUtilizationFrom(s.start_time);
      if (util >= LEVEL_UTIL) {
        await triggerCCR(s.task_id, `util=${(util*100).toFixed(1)}% >= ${TRIGGER_LEVEL}`);
        // Trigger once and then back off to avoid storms
        await new Promise(r => setTimeout(r, 15000));
      }
    }
  } catch (e) {
    err('tick error', e);
  }
}

async function main() {
  if (started) return; started = true;
  log(`Runner started. DB=${DB_PATH}, poll=${POLL_MS}ms, level=${TRIGGER_LEVEL}(${LEVEL_UTIL})`);
  if (LIMIT_LOG) {
    log(`Watching limit log: ${LIMIT_LOG}`);
    watchLimitLog(LIMIT_LOG);
  }
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  while (!stopping) { await tick(); await new Promise(r => setTimeout(r, POLL_MS)); }
}

function stop() { if (stopping) return; stopping = true; log('Stopping...'); process.exit(0); }

main().catch(e => err('fatal', e));

// ---- Limit message parsing (optional file watcher) ----
const PATTERNS = [
  /5-?hour limit reached.*resets\s+([0-9]{1,2}(?::[0-9]{2})?\s?(?:am|pm)?)/i,
  /usage limit reached.*reset(?:s)?\s+(?:at\s+)?([0-9]{1,2}(?::[0-9]{2})?\s?(?:am|pm)?)/i,
];

function parseResetToTimestamp(str) {
  try {
    const s = (str || '').trim().toLowerCase();
    const now = new Date();
    const d = new Date(now);
    let h = 0, m = 0;
    const m12 = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
    if (m12) {
      h = parseInt(m12[1] || '0', 10);
      m = parseInt(m12[2] || '0', 10) || 0;
      const ampm = m12[3];
      if (ampm === 'pm' && h !== 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
    } else {
      const m24 = s.match(/^(\d{1,2})(?::(\d{2}))?$/);
      if (!m24) return 0;
      h = parseInt(m24[1] || '0', 10);
      m = parseInt(m24[2] || '0', 10) || 0;
    }
    d.setHours(h, m, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    return d.getTime();
  } catch { return 0; }
}

function handleLimitLine(line) {
  for (const p of PATTERNS) {
    const m = line.match(p);
    if (m && m[1]) {
      const ts = parseResetToTimestamp(m[1]);
      const now = Date.now();
      // Debounce multiple triggers within 60s
      if (now - lastLimitTrigger < 60000) return;
      lastLimitTrigger = now;
      log(`Usage limit detected. Reset ~ ${new Date(ts).toLocaleTimeString()}`);
      // Trigger CCR immediately (no task context here)
      triggerCCR('UNKNOWN', 'limit-message');
      break;
    }
  }
}

import { promises as fsp } from 'fs';
import fs from 'fs';

async function watchLimitLog(file) {
  try {
    // Ensure file exists
    await fsp.access(file).catch(async () => { await fsp.writeFile(file, ''); });
    let position = (await fsp.stat(file)).size;
    fs.watch(file, { persistent: true }, async (event) => {
      if (event !== 'change') return;
      try {
        const stats = await fsp.stat(file);
        if (stats.size < position) { position = stats.size; return; }
        const fh = await fsp.open(file, 'r');
        const { buffer } = await fh.read({ position, length: stats.size - position, buffer: Buffer.alloc(stats.size - position) });
        position = stats.size;
        fh.close();
        const text = buffer.toString('utf8');
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) handleLimitLine(line);
        }
      } catch (e) { err('log watch read error', e); }
    });
  } catch (e) {
    err('watchLimitLog init error', e);
  }
}
