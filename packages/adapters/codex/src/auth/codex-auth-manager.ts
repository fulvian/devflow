/**
 * Codex Auth Manager
 * Authentication system for Codex MCP server supporting multiple OpenAI-compatible providers
 * with automatic failover, intelligent routing, and token management
 */

// Interfaces and Types
export interface ProviderConfig {
  id: string;
  name: string;
  type: 'openai' | 'azure' | 'custom';
  apiKey: string;
  baseUrl?: string;
  apiVersion?: string;
  deploymentName?: string;
  region?: string;
  weight: number; // For load balancing
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export interface AuthContext {
  providerId: string;
  apiKey: string;
  baseUrl: string;
  headers: Record<string, string>;
}

export interface HealthStatus {
  providerId: string;
  isHealthy: boolean;
  lastChecked: Date;
  responseTime: number;
  error?: string;
}

export interface TokenUsage {
  providerId: string;
  tokensUsed: number;
  timestamp: Date;
}

export interface RateLimitInfo {
  remainingRequests: number;
  remainingTokens: number;
  resetTime: Date;
}

// Main Auth Manager Class
export class CodexAuthManager {
  private providers: Map<string, ProviderConfig> = new Map();
  private healthStatus: Map<string, HealthStatus> = new Map();
  private rateLimits: Map<string, RateLimitInfo> = new Map();
  private tokenUsage: TokenUsage[] = [];
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

  constructor() {
    this.initializeHealthChecks();
  }

  /**
   * Add a new provider to the auth manager
   */
  addProvider(config: ProviderConfig): void {
    this.providers.set(config.id, config);
    this.initializeProviderHealth(config.id);
  }

  /**
   * Remove a provider from the auth manager
   */
  removeProvider(providerId: string): void {
    this.providers.delete(providerId);
    this.healthStatus.delete(providerId);
    this.rateLimits.delete(providerId);
  }

  /**
   * Get authentication context for a specific provider
   */
  async getAuthContext(providerId?: string): Promise<AuthContext> {
    // If no provider specified, select the best available one
    const selectedProviderId = providerId || await this.selectBestProvider();

    const provider = this.providers.get(selectedProviderId);
    if (!provider) {
      throw new Error(`Provider ${selectedProviderId} not found`);
    }

    // Check if provider is healthy
    const health = this.healthStatus.get(selectedProviderId);
    if (!health?.isHealthy) {
      throw new Error(`Provider ${selectedProviderId} is currently unhealthy`);
    }

    // Check rate limits
    if (!this.checkRateLimit(selectedProviderId)) {
      throw new Error(`Rate limit exceeded for provider ${selectedProviderId}`);
    }

    // Generate auth context based on provider type
    return this.generateAuthContext(provider);
  }

  /**
   * Select the best available provider based on health, performance, and weighting
   */
  private async selectBestProvider(): Promise<string> {
    const healthyProviders: { id: string; weight: number; responseTime: number }[] = [];

    // Filter for healthy providers
    for (const [id, provider] of this.providers.entries()) {
      const health = this.healthStatus.get(id);
      if (health?.isHealthy) {
        healthyProviders.push({
          id,
          weight: provider.weight,
          responseTime: health.responseTime
        });
      }
    }

    if (healthyProviders.length === 0) {
      throw new Error('No healthy providers available');
    }

    // Sort by response time (faster first) and weight
    healthyProviders.sort((a, b) => {
      // Primary sort by response time
      if (a.responseTime !== b.responseTime) {
        return a.responseTime - b.responseTime;
      }
      // Secondary sort by weight (higher weight first)
      return b.weight - a.weight;
    });

    // Simple weighted selection - could be enhanced with more sophisticated algorithms
    const totalWeight = healthyProviders.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;

    for (const provider of healthyProviders) {
      random -= provider.weight;
      if (random <= 0) {
        return provider.id;
      }
    }

    // Fallback to first provider
    return healthyProviders[0].id;
  }

  /**
   * Generate authentication context based on provider type
   */
  private generateAuthContext(provider: ProviderConfig): AuthContext {
    const context: AuthContext = {
      providerId: provider.id,
      apiKey: provider.apiKey,
      baseUrl: '',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json'
      }
    };

    switch (provider.type) {
      case 'openai':
        context.baseUrl = provider.baseUrl || 'https://api.openai.com/v1';
        break;

      case 'azure':
        if (!provider.deploymentName || !provider.apiVersion) {
          throw new Error('Azure provider requires deploymentName and apiVersion');
        }
        context.baseUrl = provider.baseUrl ||
          `https://${provider.region}.api.cognitive.microsoft.com/openai/deployments/${provider.deploymentName}`;
        context.headers['api-key'] = provider.apiKey;
        delete context.headers['Authorization'];
        break;

      case 'custom':
        if (!provider.baseUrl) {
          throw new Error('Custom provider requires baseUrl');
        }
        context.baseUrl = provider.baseUrl;
        break;

      default:
        throw new Error(`Unsupported provider type: ${provider.type}`);
    }

    return context;
  }

  /**
   * Check if provider is within rate limits
   */
  private checkRateLimit(providerId: string): boolean {
    const rateLimit = this.rateLimits.get(providerId);
    if (!rateLimit) return true; // No rate limit info, allow request

    const now = new Date();
    if (rateLimit.resetTime < now) {
      // Rate limit window has passed, reset counters
      this.rateLimits.delete(providerId);
      return true;
    }

    // Check if we have remaining requests/tokens
    return rateLimit.remainingRequests > 0 && rateLimit.remainingTokens > 0;
  }

  /**
   * Update rate limit information after a request
   */
  updateRateLimit(providerId: string, remainingRequests: number, remainingTokens: number, resetTime: Date): void {
    this.rateLimits.set(providerId, {
      remainingRequests,
      remainingTokens,
      resetTime
    });
  }

  /**
   * Record token usage
   */
  recordTokenUsage(providerId: string, tokensUsed: number): void {
    this.tokenUsage.push({
      providerId,
      tokensUsed,
      timestamp: new Date()
    });

    // Keep only last 24 hours of usage data
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.tokenUsage = this.tokenUsage.filter(usage => usage.timestamp > cutoff);
  }

  /**
   * Get total token usage for a provider in the last 24 hours
   */
  getDailyTokenUsage(providerId: string): number {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    return this.tokenUsage
      .filter(usage =>
        usage.providerId === providerId &&
        usage.timestamp > yesterday
      )
      .reduce((total, usage) => total + usage.tokensUsed, 0);
  }

  /**
   * Initialize health status for a provider
   */
  private initializeProviderHealth(providerId: string): void {
    this.healthStatus.set(providerId, {
      providerId,
      isHealthy: false,
      lastChecked: new Date(0),
      responseTime: 0
    });
  }

  /**
   * Perform health check on a provider
   */
  private async checkProviderHealth(providerId: string): Promise<HealthStatus> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return {
        providerId,
        isHealthy: false,
        lastChecked: new Date(),
        responseTime: 0,
        error: 'Provider not found'
      };
    }

    const startTime = Date.now();
    try {
      // For health check, we'll try a simple model list endpoint
      const authContext = this.generateAuthContext(provider);
      const url = `${authContext.baseUrl}/models`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(url, {
        method: 'GET',
        headers: authContext.headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;

      return {
        providerId,
        isHealthy: response.ok,
        lastChecked: new Date(),
        responseTime,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        providerId,
        isHealthy: false,
        lastChecked: new Date(),
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Initialize periodic health checks
   */
  private initializeHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const providerId of this.providers.keys()) {
        try {
          const health = await this.checkProviderHealth(providerId);
          this.healthStatus.set(providerId, health);
        } catch (error) {
          console.error(`Error checking health for provider ${providerId}:`, error);
        }
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Get health status of all providers
   */
  getHealthStatus(): HealthStatus[] {
    return Array.from(this.healthStatus.values());
  }

  /**
   * Manually trigger health checks for all providers
   */
  async refreshHealthStatus(): Promise<void> {
    const healthChecks = Array.from(this.providers.keys()).map(id =>
      this.checkProviderHealth(id)
    );

    const results = await Promise.all(healthChecks);
    for (const health of results) {
      this.healthStatus.set(health.providerId, health);
    }
  }

  /**
   * Rotate API key for a provider
   */
  rotateApiKey(providerId: string, newApiKey: string): void {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    provider.apiKey = newApiKey;

    // Force a health check after key rotation
    this.checkProviderHealth(providerId)
      .then(health => this.healthStatus.set(providerId, health))
      .catch(error => {
        console.error(`Error checking health after key rotation for ${providerId}:`, error);
      });
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

// Export types for external use
export type { ProviderConfig, AuthContext, HealthStatus, TokenUsage, RateLimitInfo };