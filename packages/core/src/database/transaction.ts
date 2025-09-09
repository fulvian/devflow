import type Database from 'better-sqlite3';

export function withTransaction<T>(db: Database.Database, fn: () => T): T {
  const tx = db.transaction(fn);
  return tx();
}

