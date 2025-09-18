import type { SyntheticProvider, SyntheticCodeRequest, SyntheticReasoningRequest, SyntheticResponse } from './synthetic';

// Registry: sceglie provider in base a env e fallback
// DEVFLOW_SYNTHETIC_PROVIDER: local | synthetic | openrouter
// DEVFLOW_PROVIDER_FALLBACK: comma-separated list es. "synthetic,openrouter,local"

async function buildLocal(): Promise<SyntheticProvider> {
  const { LocalSyntheticProvider } = await import('./synthetic');
  return new LocalSyntheticProvider({ retries: 2, baseDelayMs: 150, maxDelayMs: 1500 });
}

async function buildSyntheticNew(): Promise<SyntheticProvider> {
  // Caricamento dinamico ESM
  const mod = await import('../../../../packages/adapters/synthetic/dist/index.js');
  const { SyntheticGateway } = mod as any;
  const gateway = new SyntheticGateway({});

  const provider: SyntheticProvider = {
    async code(input: SyntheticCodeRequest): Promise<SyntheticResponse> {
      const start = Date.now();
      const req = {
        title: 'codegen',
        description: input.prompt,
        messages: [{ role: 'user', content: input.prompt }],
        context: input.context?.injected ? { injected: String(input.context.injected) } : undefined,
      };
      const resp = await gateway.processWithAgent('code', req);
      return {
        result: resp.text,
        metadata: {
          agentType: 'code',
          processingTime: Date.now() - start,
          confidence: 0.95,
          provider: 'synthetic',
          model: resp.model,
          tokensIn: resp.raw?.usage?.prompt_tokens ?? undefined,
          tokensOut: resp.raw?.usage?.completion_tokens ?? undefined,
        },
      };
    },
    async reasoning(input: SyntheticReasoningRequest): Promise<SyntheticResponse> {
      const start = Date.now();
      const req = {
        title: 'reasoning',
        description: input.prompt,
        messages: [{ role: 'user', content: input.prompt }],
        context: input.context?.injected ? { injected: String(input.context.injected) } : undefined,
      };
      const resp = await gateway.processWithAgent('reasoning', req);
      return {
        result: resp.text,
        metadata: {
          agentType: 'reasoning',
          processingTime: Date.now() - start,
          confidence: 0.92,
          provider: 'synthetic',
          model: resp.model,
          tokensIn: resp.raw?.usage?.prompt_tokens ?? undefined,
          tokensOut: resp.raw?.usage?.completion_tokens ?? undefined,
        },
      };
    },
  };
  return provider;
}

async function buildOpenRouter(): Promise<SyntheticProvider> {
  const mod = await import('../../../../packages/adapters/openrouter/dist/index.js');
  const { OpenRouterGateway } = mod as any;
  const gateway = new OpenRouterGateway({});
  const provider: SyntheticProvider = {
    async code(input: SyntheticCodeRequest): Promise<SyntheticResponse> {
      const start = Date.now();
      const req = { title: 'codegen', description: input.prompt, messages: [{ role: 'user', content: input.prompt }], context: input.context?.injected ? { injected: String(input.context.injected) } : undefined };
      const resp = await gateway.generate(req);
      return {
        result: resp.text,
        metadata: {
          agentType: 'code',
          processingTime: Date.now() - start,
          confidence: 0.9,
          provider: 'openrouter',
          model: resp.model,
          tokensIn: resp.raw?.usage?.prompt_tokens ?? undefined,
          tokensOut: resp.raw?.usage?.completion_tokens ?? undefined,
        },
      };
    },
    async reasoning(input: SyntheticReasoningRequest): Promise<SyntheticResponse> {
      const start = Date.now();
      const req = { title: 'reasoning', description: input.prompt, messages: [{ role: 'user', content: input.prompt }], context: input.context?.injected ? { injected: String(input.context.injected) } : undefined };
      const resp = await gateway.generate(req);
      return {
        result: resp.text,
        metadata: {
          agentType: 'reasoning',
          processingTime: Date.now() - start,
          confidence: 0.9,
          provider: 'openrouter',
          model: resp.model,
          tokensIn: resp.raw?.usage?.prompt_tokens ?? undefined,
          tokensOut: resp.raw?.usage?.completion_tokens ?? undefined,
        },
      };
    },
  };
  return provider;
}

export async function createSyntheticProviderFromEnv(): Promise<SyntheticProvider> {
  const primary = (process.env.DEVFLOW_SYNTHETIC_PROVIDER || 'local').toLowerCase();
  const fallback = (process.env.DEVFLOW_PROVIDER_FALLBACK || '').split(',').map(s => s.trim()).filter(Boolean);
  const chain = [primary, ...fallback, 'local'];

  for (const name of chain) {
    try {
      if (name === 'synthetic') {
        // Richiede chiavi SYNTHETIC_API_KEY; se assenti, salta.
        if (!process.env.SYNTHETIC_API_KEY) throw new Error('SYNTHETIC_API_KEY missing');
        return await buildSyntheticNew();
      }
      if (name === 'openrouter') {
        if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY missing');
        return await buildOpenRouter();
      }
      if (name === 'local') {
        return await buildLocal();
      }
    } catch (err) {
      // Prossimo fallback
      continue;
    }
  }
  // Safety fallback
  return await buildLocal();
}
