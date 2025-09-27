import { describe, it, expect, vi } from 'vitest';
import { Debouncer } from '../filesystem/debouncer.js';

describe('Debouncer', () => {
  it('debounces multiple rapid calls', async () => {
    const d = new Debouncer(10);
    const fn = vi.fn();
    d.run('k', fn);
    d.run('k', fn);
    d.run('k', fn);
    await new Promise(r => setTimeout(r, 30));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

