import { describe, it, expect, vi } from 'vitest';
import { PersistentDebouncer } from '../filesystem/persistent-debouncer.js';
import { rmSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
describe('PersistentDebouncer', () => {
    it('persists and resumes pending tasks', async () => {
        const journal = resolve(process.cwd(), '.devflow/test-debouncer.json');
        try {
            rmSync(journal);
        }
        catch { }
        const d1 = new PersistentDebouncer({ delayMs: 10, journalPath: journal });
        const fn = vi.fn();
        d1.run('k1', { msg: 'hello' }, (data) => fn(data.msg));
        // journal should exist
        expect(existsSync(journal)).toBe(true);
        // Simulate restart by creating a new instance and calling resume
        const d2 = new PersistentDebouncer({ delayMs: 10, journalPath: journal });
        d2.resume((_k, data) => fn(data.msg));
        await new Promise((r) => setTimeout(r, 25));
        expect(fn).toHaveBeenCalled();
        const content = readFileSync(journal, 'utf8');
        expect(content).toContain('[]'); // empty after completion (best-effort)
    });
});
//# sourceMappingURL=persistent-debouncer.test.js.map