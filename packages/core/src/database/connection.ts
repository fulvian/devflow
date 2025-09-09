import Database from 'better-sqlite3';
import { dirname, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { loadCoreEnv } from '@devflow/shared';

export interface DBConfig {
  path?: string;
  readonly?: boolean;
  verbose?: boolean;
}

type DBHandle = Database.Database;

const pool = new Map<string, DBHandle>();

export function getDB(config: DBConfig = {}): DBHandle {
  const env = loadCoreEnv();
  const dbPath = config.path ?? env.DEVFLOW_DB_PATH ?? resolve(process.cwd(), 'devflow.sqlite');
  if (pool.has(dbPath)) return pool.get(dbPath)!;

  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath, { readonly: config.readonly ?? env.DEVFLOW_DB_READONLY ?? false });

  if (config.verbose ?? env.DEVFLOW_DB_VERBOSE) {
    db.pragma('debug=1');
  }

  // Performance-oriented pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = memory');
  db.pragma('foreign_keys = ON');

  pool.set(dbPath, db);
  return db;
}

export function closeDB(path?: string): void {
  const dbPath = path ?? process.env['DEVFLOW_DB_PATH'] ?? resolve(process.cwd(), 'devflow.sqlite');
  const db = pool.get(dbPath);
  if (db) {
    db.close();
    pool.delete(dbPath);
  }
}

export function withDB<T>(fn: (db: DBHandle) => T, config?: DBConfig): T {
  const db = getDB(config);
  return fn(db);
}
