import { describe, it, expect, beforeAll } from 'vitest';
import { getDB } from '../database/connection.js';
import { ensureMigrations } from '../database/migrations.js';

const SKIP_NATIVE = process.env['SKIP_NATIVE'] === '1';
const suite = SKIP_NATIVE ? describe.skip : describe;
suite('Database migrations', () => {
  beforeAll(() => {
    process.env['DEVFLOW_DB_PATH'] = process.env['DEVFLOW_DB_PATH'] ?? 'devflow.test.sqlite';
  });

  it('applies initial schema without error', () => {
    const db = getDB();
    expect(() => ensureMigrations(db)).not.toThrow();
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='task_contexts'").get() as any;
    expect(row?.name).toBe('task_contexts');
  });
});
