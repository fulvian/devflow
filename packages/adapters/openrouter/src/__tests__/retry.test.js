import { describe, it, expect } from 'vitest';
import { withRetries } from '../client/retry.js';
describe('retry', () => {
    it('retries transient errors then succeeds', async () => {
        let count = 0;
        const fn = async () => {
            count += 1;
            if (count < 3)
                throw Object.assign(new Error('boom'), { status: 500 });
            return 42;
        };
        const res = await withRetries(fn, { retries: 3, initialDelayMs: 1, maxDelayMs: 2 });
        expect(res).toBe(42);
    });
});
//# sourceMappingURL=retry.test.js.map