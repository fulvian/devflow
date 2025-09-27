import { describe, it, expect } from 'vitest';
const SKIP_NATIVE = process.env['SKIP_NATIVE'] === '1';
const suite = SKIP_NATIVE ? describe.skip : describe;
import { ClaudeCodeAdapter } from '../adapter.js';

suite('ClaudeCodeAdapter', () => {
  it('instantiates and exposes handlers', () => {
    const a = new ClaudeCodeAdapter({ contextDir: '.claude/context-test' } as any);
    expect(a).toBeTruthy();
  });
});
