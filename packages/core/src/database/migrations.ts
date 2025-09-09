import { readFileSync } from 'fs';
import { resolve } from 'path';
import type Database from 'better-sqlite3';

function tableExists(db: Database.Database, name: string): boolean {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name) as { name?: string } | undefined;
  return Boolean(row && row.name);
}

export function runInitialSchema(db: Database.Database): void {
  // If schema_versions exists we assume schema is applied
  if (tableExists(db, 'schema_versions')) return;

  const schemaPath = resolve(process.cwd(), 'packages/core/src/database/schema.sql');
  const sql = readFileSync(schemaPath, 'utf8');
  db.exec('BEGIN');
  try {
    db.exec(sql);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function ensureMigrations(db: Database.Database): void {
  runInitialSchema(db);
}

