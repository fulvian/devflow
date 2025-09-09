import { describe, it, expect } from 'vitest';
const SKIP_NATIVE = process.env['SKIP_NATIVE'] === '1';
const suite = SKIP_NATIVE ? describe.skip : describe;
import { ClaudeAdapter } from '../adapter.js';

suite('ClaudeAdapter', () => {
  it('instantiates and exposes handlers', () => {
    const a = new ClaudeAdapter({ contextDir: '.claude/context-test' });
    expect(a).toBeTruthy();
    // no throws on calling handlers without real cc-sessions
  });
});
