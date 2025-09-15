import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

function resolveDbPath(): string {
  // 1) Explicit env wins
  const fromEnv = process.env.DEVFLOW_DB_PATH;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv;

  // 2) Preferred canonical location under repo root: data/devflow.sqlite
  const candidates = [
    // When orchestrator is launched from repo root
    resolve(process.cwd(), 'data', 'devflow.sqlite'),
    resolve(process.cwd(), 'devflow.sqlite'),
    // When code is executed from compiled dist relative paths
    resolve(__dirname, '../../../..', 'data', 'devflow.sqlite'),
    resolve(__dirname, '../../../..', 'devflow.sqlite'),
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  // 3) Fallback: create under data/ in current working directory
  const fallback = resolve(process.cwd(), 'data', 'devflow.sqlite');
  try {
    mkdirSync(dirname(fallback), { recursive: true });
  } catch {}
  return fallback;
}

export const DB_PATH: string = resolveDbPath();

// Single shared connection for the process
export const db = new Database(DB_PATH);

// Pragmas for better concurrency and durability
try {
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
} catch {}

