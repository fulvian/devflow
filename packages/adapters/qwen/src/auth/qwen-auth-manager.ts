import { DashScopeAuth } from './providers/dashscope-auth.js';
import { ModelScopeAuth } from './providers/modelscope-auth.js';
import { OpenRouterAuth } from './providers/openrouter-auth.js';

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  defaultModel: string;
  env: Record<string, string>;
  rateLimits: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  features: string[];
}

export interface AuthProvider {
  name: string;
  validate(): Promise<boolean>;
  getConfig(): Promise<ProviderConfig>;
  refreshCredentials?(): Promise<void>;
}

/**
 * Qwen Authentication Manager
 * Manages authentication across multiple Qwen providers
 */
export class QwenAuthManager {
  private providers: Map<string, AuthProvider> = new Map();
  private configs: Map<string, ProviderConfig> = new Map();
  private lastValidation: Map<string, number> = new Map();
  private validationInterval = 300000; // 5 minutes

  constructor() {
    this.initializeProviders();
  }

  /**
   * Initialize all available providers
   */
  private initializeProviders(): void {
    // DashScope (Alibaba Cloud)
    if (this.hasEnvironmentKey('QWEN_DASHSCOPE_API_KEY') || this.hasEnvironmentKey('DASHSCOPE_API_KEY')) {
      this.providers.set('dashscope', new DashScopeAuth());
    }

    // ModelScope
    if (this.hasEnvironmentKey('QWEN_MODELSCOPE_API_KEY') || this.hasEnvironmentKey('MODELSCOPE_API_KEY')) {
      this.providers.set('modelscope', new ModelScopeAuth());
    }

    // OpenRouter
    if (this.hasEnvironmentKey('QWEN_OPENROUTER_API_KEY') || this.hasEnvironmentKey('OPENROUTER_API_KEY')) {
      this.providers.set('openrouter', new OpenRouterAuth());
    }

    console.log(`[Qwen Auth] Initialized ${this.providers.size} providers: ${[...this.providers.keys()].join(', ')}`);
  }

  /**
   * Validate all providers
   */
  async validateAllProviders(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [name, provider] of this.providers) {
      try {
        const isValid = await this.validateProvider(name);
        results.set(name, isValid);
      } catch (error) {
        console.warn(`[Qwen Auth] Validation failed for ${name}:`, error);
        results.set(name, false);
      }
    }

    return results;
  }

  /**
   * Validate a specific provider
   */
  async validateProvider(providerName: string): Promise<boolean> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      console.warn(`[Qwen Auth] Provider not found: ${providerName}`);
      return false;
    }

    // Check if we need to revalidate
    const lastCheck = this.lastValidation.get(providerName) || 0;
    const now = Date.now();
    
    if (now - lastCheck < this.validationInterval) {
      // Return cached result if within validation interval
      return this.configs.has(providerName);
    }

    try {
      console.log(`[Qwen Auth] Validating provider: ${providerName}`);
      const isValid = await provider.validate();
      
      if (isValid) {
        const config = await provider.getConfig();
        this.configs.set(providerName, config);
        console.log(`[Qwen Auth] Provider ${providerName} validated successfully`);
      } else {
        this.configs.delete(providerName);
        console.warn(`[Qwen Auth] Provider ${providerName} validation failed`);
      }

      this.lastValidation.set(providerName, now);
      return isValid;
    } catch (error) {
      console.error(`[Qwen Auth] Error validating provider ${providerName}:`, error);
      this.configs.delete(providerName);
      this.lastValidation.set(providerName, now);
      return false;
    }
  }

  /**
   * Get configuration for a specific provider
   */
  async getProviderConfig(providerName: string): Promise<ProviderConfig | null> {
    const isValid = await this.validateProvider(providerName);
    if (!isValid) {
      return null;
    }

    return this.configs.get(providerName) || null;
  }

  /**
   * Get all valid providers
   */
  async getValidProviders(): Promise<string[]> {
    const validProviders: string[] = [];

    for (const providerName of this.providers.keys()) {
      const isValid = await this.validateProvider(providerName);
      if (isValid) {
        validProviders.push(providerName);
      }
    }

    return validProviders;
  }

  /**
   * Get provider by capability
   */
  async getProvidersByCapability(capability: string): Promise<string[]> {
    const validProviders = await this.getValidProviders();
    const capableProviders: string[] = [];

    for (const provider of validProviders) {
      const config = this.configs.get(provider);
      if (config && config.features.includes(capability)) {
        capableProviders.push(provider);
      }
    }

    return capableProviders;
  }

  /**
   * Get best provider for a task
   */
  async getBestProvider(taskType: string, requirements?: any): Promise<string | null> {
    const validProviders = await this.getValidProviders();
    
    if (validProviders.length === 0) {
      console.warn('[Qwen Auth] No valid providers available');
      return null;
    }

    // Simple selection logic - can be enhanced with more sophisticated algorithms
    switch (taskType) {
      case 'code_generation':
      case 'code_analysis':
        // Prefer DashScope for coding tasks
        if (validProviders.includes('dashscope')) return 'dashscope';
        if (validProviders.includes('modelscope')) return 'modelscope';
        break;
      
      case 'general':
        // Any provider will do for general tasks
        break;
    }

    // Return first available provider
    return validProviders[0];
  }

  /**
   * Refresh credentials for all providers
   */
  async refreshAllCredentials(): Promise<void> {
    console.log('[Qwen Auth] Refreshing credentials for all providers');

    for (const [name, provider] of this.providers) {
      try {
        if (provider.refreshCredentials) {
          await provider.refreshCredentials();
          console.log(`[Qwen Auth] Refreshed credentials for ${name}`);
        }
      } catch (error) {
        console.warn(`[Qwen Auth] Failed to refresh credentials for ${name}:`, error);
      }
    }

    // Clear validation cache to force revalidation
    this.lastValidation.clear();
  }

  /**
   * Get authentication status for all providers
   */
  async getAuthStatus(): Promise<Record<string, any>> {
    const status: Record<string, any> = {};

    for (const providerName of this.providers.keys()) {
      const config = this.configs.get(providerName);
      const lastCheck = this.lastValidation.get(providerName);

      status[providerName] = {
        available: !!config,
        lastValidated: lastCheck ? new Date(lastCheck).toISOString() : null,
        config: config ? {
          baseUrl: config.baseUrl,
          defaultModel: config.defaultModel,
          rateLimits: config.rateLimits,
          features: config.features,
        } : null,
      };
    }

    return status;
  }

  /**
   * Check if environment variable exists
   */
  private hasEnvironmentKey(key: string): boolean {
    return !!(process.env[key] && process.env[key].trim());
  }

  /**
   * Get environment variable with fallbacks
   */
  getEnvironmentKey(primary: string, ...fallbacks: string[]): string | undefined {
    const keys = [primary, ...fallbacks];
    
    for (const key of keys) {
      const value = process.env[key];
      if (value && value.trim()) {
        return value.trim();
      }
    }

    return undefined;
  }
}