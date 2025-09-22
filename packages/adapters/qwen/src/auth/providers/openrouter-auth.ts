import { AuthProvider, ProviderConfig } from '../qwen-auth-manager.js';

/**
 * OpenRouter Authentication Provider
 * Handles authentication with OpenRouter for Qwen models
 */
export class OpenRouterAuth implements AuthProvider {
  name = 'openrouter';

  async validate(): Promise<boolean> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      console.warn('[OpenRouter Auth] No API key found');
      return false;
    }

    try {
      // Validate API key format - OpenRouter keys typically start with 'sk-or-'
      if (!apiKey.startsWith('sk-or-') && apiKey.length < 20) {
        console.warn('[OpenRouter Auth] API key appears to be invalid format');
        return false;
      }

      // TODO: Add actual API call to validate key with OpenRouter
      console.log('[OpenRouter Auth] API key format appears valid');
      return true;
    } catch (error) {
      console.error('[OpenRouter Auth] Validation error:', error);
      return false;
    }
  }

  async getConfig(): Promise<ProviderConfig> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('OpenRouter API key not available');
    }

    return {
      name: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey,
      defaultModel: 'qwen/qwen3-coder:free',
      env: {
        OPENAI_API_KEY: apiKey,
        OPENAI_BASE_URL: 'https://openrouter.ai/api/v1',
        OPENAI_MODEL: 'qwen/qwen3-coder:free',
      },
      rateLimits: {
        requestsPerMinute: 20, // Free tier limit
        requestsPerDay: 200,   // Free tier limit
      },
      features: ['code_generation', 'code_analysis', 'general'],
    };
  }

  private getApiKey(): string | undefined {
    return process.env.QWEN_OPENROUTER_API_KEY || 
           process.env.OPENROUTER_API_KEY;
  }
}