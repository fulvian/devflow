import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenRouterGateway } from '../gateway.js';

const originalFetch = globalThis.fetch;

describe('OpenRouterGateway', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  it('calls API and returns text', async () => {
    // Mock fetch
    (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'resp_1',
          model: 'openai/gpt-4o-mini',
          created: Date.now(),
          choices: [
            { index: 0, message: { role: 'assistant', content: 'Hello world' }, finish_reason: 'stop' },
          ],
          usage: { total_tokens: 10, prompt_tokens: 6, completion_tokens: 4 },
        }),
      } as unknown as Response;
    });

    const gw = new OpenRouterGateway({ apiKey: 'test-key', preferredModels: ['openai/gpt-4o-mini'] });
    const res = await gw.generate({
      description: 'Say hello',
      messages: [{ role: 'user', content: 'Say hello' }],
    });
    expect(res.text).toContain('Hello');

    (globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch!;
  });

  it('falls back to default models when preferred do not match', async () => {
    // Ensure env contains non-matching preferred models
    const prev = process.env['OPENROUTER_PREFERRED_MODELS'];
    process.env['OPENROUTER_PREFERRED_MODELS'] = 'non/existent-model-1,non/existent-model-2';

    // Mock fetch success for any model
    (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'resp_2',
          model: 'anthropic/claude-3-sonnet',
          created: Date.now(),
          choices: [
            { index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' },
          ],
          usage: { total_tokens: 8, prompt_tokens: 5, completion_tokens: 3 },
        }),
      } as unknown as Response;
    });

    const gw = new OpenRouterGateway({ apiKey: 'test-key' });
    const res = await gw.generate({ description: 'Quick test', messages: [{ role: 'user', content: 'Ping' }] });
    expect(res.text).toBe('OK');

    // restore
    process.env['OPENROUTER_PREFERRED_MODELS'] = prev;
    (globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch!;
  });
});
