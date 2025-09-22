import { AuthProvider, ProviderConfig } from '../qwen-auth-manager.js';

/**
 * DashScope Authentication Provider
 * Handles authentication with Alibaba Cloud DashScope
 */
export class DashScopeAuth implements AuthProvider {
  name = 'dashscope';

  async validate(): Promise<boolean> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      console.warn('[DashScope Auth] No API key found');
      return false;
    }

    try {
      // Simple validation - check if key format is correct
      if (apiKey.length < 10) {
        console.warn('[DashScope Auth] API key appears to be invalid (too short)');
        return false;
      }

      // TODO: Add actual API call to validate key
      console.log('[DashScope Auth] API key format appears valid');
      return true;
    } catch (error) {
      console.error('[DashScope Auth] Validation error:', error);
      return false;
    }
  }

  async getConfig(): Promise<ProviderConfig> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('DashScope API key not available');
    }

    return {
      name: 'dashscope',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey,
      defaultModel: 'qwen3-coder-plus',
      env: {
        OPENAI_API_KEY: apiKey,
        OPENAI_BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        OPENAI_MODEL: 'qwen3-coder-plus',
      },
      rateLimits: {
        requestsPerMinute: 60,
        requestsPerDay: 1000,
      },
      features: ['code_generation', 'code_analysis', 'general', 'batch_processing'],
    };
  }

  private getApiKey(): string | undefined {
    return process.env.QWEN_DASHSCOPE_API_KEY || 
           process.env.DASHSCOPE_API_KEY ||
           process.env.OPENAI_API_KEY; // Fallback for compatibility
  }
}