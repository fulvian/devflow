import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getDB } from '../database/connection.js';
import { ensureMigrations } from '../database/migrations.js';
import { unlinkSync } from 'fs';
const SKIP_NATIVE = process.env['SKIP_NATIVE'] === '1';
const suite = SKIP_NATIVE ? describe.skip : describe;
suite('Database migrations', () => {
    beforeAll(() => {
        process.env['DEVFLOW_DB_PATH'] = process.env['DEVFLOW_DB_PATH'] ?? 'devflow.test.sqlite';
    });
    beforeEach(() => {
        // Clean up test database before each test
        try {
            unlinkSync(process.env['DEVFLOW_DB_PATH']);
        }
        catch (e) {
            // Database doesn't exist, that's fine
        }
    });
    it('applies initial schema without error', () => {
        const db = getDB();
        expect(() => ensureMigrations(db)).not.toThrow();
        const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='task_contexts'").get();
        expect(row?.name).toBe('task_contexts');
    });
});
//# sourceMappingURL=db.test.js.map