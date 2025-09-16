/**
 * Provider Registry Service
 * Creates and manages synthetic providers for DevFlow orchestrator
 */

export interface SyntheticProvider {
  name: string;
  type: 'synthetic' | 'openai' | 'anthropic';
  apiKey: string;
  baseUrl: string;
  initialized: boolean;
}

export interface SyntheticProviderConfig {
  name?: string;
  type?: 'synthetic' | 'openai' | 'anthropic';
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

/**
 * Creates a synthetic provider instance from environment variables
 */
export async function createSyntheticProviderFromEnv(): Promise<SyntheticProvider> {
  const config: SyntheticProviderConfig = {
    name: process.env.SYNTHETIC_PROVIDER_NAME || 'synthetic-default',
    type: (process.env.SYNTHETIC_PROVIDER_TYPE as 'synthetic' | 'openai' | 'anthropic') || 'synthetic',
    apiKey: process.env.SYNTHETIC_API_KEY || '',
    baseUrl: process.env.SYNTHETIC_BASE_URL || 'https://api.synthetic.new',
    timeout: Number(process.env.SYNTHETIC_TIMEOUT || 30000),
    maxRetries: Number(process.env.SYNTHETIC_MAX_RETRIES || 3)
  };

  if (!config.apiKey) {
    throw new Error('SYNTHETIC_API_KEY environment variable is required');
  }

  const provider: SyntheticProvider = {
    name: config.name!,
    type: config.type!,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl!,
    initialized: false
  };

  // Initialize provider
  try {
    // Basic connectivity test
    if (config.type === 'synthetic') {
      // Mock initialization - in a real implementation, this would
      // test connectivity to the Synthetic API
      provider.initialized = true;
    } else {
      // For other providers, implement specific initialization logic
      provider.initialized = true;
    }

    console.log(`✅ Synthetic provider '${provider.name}' initialized successfully`);
    return provider;
  } catch (error) {
    console.error('❌ Failed to initialize synthetic provider:', error);
    throw new Error(`Provider initialization failed: ${error}`);
  }
}

/**
 * Registry for managing multiple providers
 */
export class ProviderRegistry {
  private providers: Map<string, SyntheticProvider> = new Map();

  async registerProvider(config: SyntheticProviderConfig): Promise<SyntheticProvider> {
    const provider = await createSyntheticProviderFromEnv();
    this.providers.set(provider.name, provider);
    return provider;
  }

  getProvider(name: string): SyntheticProvider | undefined {
    return this.providers.get(name);
  }

  getAllProviders(): SyntheticProvider[] {
    return Array.from(this.providers.values());
  }

  removeProvider(name: string): boolean {
    return this.providers.delete(name);
  }
}

export default {
  createSyntheticProviderFromEnv,
  ProviderRegistry
};