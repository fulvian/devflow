/**
 * Enhanced Gemini Authentication Service
 * Provides advanced authentication management with multi-provider support,
 * token refresh, health monitoring, rate limiting, and performance tracking.
 */

import { EventEmitter } from 'events';
import { promisify } from 'util';

// Types and Interfaces
interface AuthProviderConfig {
  type: 'oauth' | 'api_key' | 'adc';
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  apiKey?: string;
  scopes?: string[];
  tokenUrl?: string;
}

interface TokenData {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  details: Record<string, any>;
}

interface RateLimitInfo {
  remaining: number;
  resetTime: Date;
  limit: number;
}

interface PerformanceMetrics {
  averageResponseTime: number;
  successRate: number;
  errorCount: number;
  requestCount: number;
}

// Custom Errors
class AuthError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AuthError';
  }
}

class RateLimitError extends Error {
  constructor(public resetTime: Date) {
    super('Rate limit exceeded');
    this.name = 'RateLimitError';
  }
}

class TokenRefreshError extends AuthError {
  constructor(message: string) {
    super(message, 'TOKEN_REFRESH_FAILED');
    this.name = 'TokenRefreshError';
  }
}

// Token Manager
class TokenManager {
  private token: TokenData | null = null;
  private tokenExpiry: Date | null = null;
  private refreshPromise: Promise<TokenData> | null = null;

  constructor(private config: AuthProviderConfig) {}

  async getValidToken(): Promise<string> {
    // If we have a valid token, return it
    if (this.token && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.token.access_token;
    }

    // If we're already refreshing, wait for that
    if (this.refreshPromise) {
      const token = await this.refreshPromise;
      return token.access_token;
    }

    // Otherwise, refresh the token
    try {
      this.refreshPromise = this.refreshToken();
      const token = await this.refreshPromise;
      return token.access_token;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async refreshToken(): Promise<TokenData> {
    switch (this.config.type) {
      case 'oauth':
        return this.refreshOAuthToken();
      case 'api_key':
        throw new AuthError('API key does not require refreshing', 'INVALID_OPERATION');
      case 'adc':
        return this.refreshADCToken();
      default:
        throw new AuthError(`Unsupported auth type: ${this.config.type}`, 'UNSUPPORTED_AUTH_TYPE');
    }
  }

  private async refreshOAuthToken(): Promise<TokenData> {
    if (!this.config.clientId || !this.config.clientSecret || !this.config.refreshToken) {
      throw new TokenRefreshError('Missing OAuth configuration');
    }

    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.config.refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      });

      const response = await fetch(this.config.tokenUrl || 'https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new TokenRefreshError(`OAuth token refresh failed: ${response.status} ${errorText}`);
      }

      const tokenData: TokenData = await response.json();
      this.token = tokenData;
      this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in * 1000));

      // Update refresh token if provided
      if (tokenData.refresh_token) {
        this.config.refreshToken = tokenData.refresh_token;
      }

      return tokenData;
    } catch (error) {
      if (error instanceof TokenRefreshError) {
        throw error;
      }
      throw new TokenRefreshError(`Failed to refresh OAuth token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async refreshADCToken(): Promise<TokenData> {
    // In a real implementation, this would use Google's ADC libraries
    // For this example, we'll simulate token retrieval
    try {
      // Simulate ADC token retrieval
      const tokenData: TokenData = {
        access_token: `adc-token-${Date.now()}`,
        expires_in: 3600,
        token_type: 'Bearer'
      };

      this.token = tokenData;
      this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in * 1000));

      return tokenData;
    } catch (error) {
      throw new TokenRefreshError(`Failed to refresh ADC token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  isTokenExpiringSoon(): boolean {
    if (!this.tokenExpiry) return true;
    // Consider token expiring soon if it expires in less than 5 minutes
    return this.tokenExpiry.getTime() - Date.now() < 5 * 60 * 1000;
  }
}

// Rate Limiter
class RateLimiter {
  private requests: number[] = [];
  private limit: number;
  private windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  checkRateLimit(): { allowed: boolean; resetTime: Date } {
    const now = Date.now();
    // Remove requests outside the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    const resetTime = new Date(now + this.windowMs);

    if (this.requests.length >= this.limit) {
      return { allowed: false, resetTime };
    }

    this.requests.push(now);
    return { allowed: true, resetTime };
  }

  getRateLimitInfo(): RateLimitInfo {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    return {
      remaining: Math.max(0, this.limit - this.requests.length),
      resetTime: new Date(now + this.windowMs),
      limit: this.limit
    };
  }
}

// Performance Tracker
class PerformanceTracker {
  private metrics: PerformanceMetrics = {
    averageResponseTime: 0,
    successRate: 100,
    errorCount: 0,
    requestCount: 0
  };
  private responseTimes: number[] = [];

  recordRequest(success: boolean, responseTime: number): void {
    this.metrics.requestCount++;

    if (success) {
      this.responseTimes.push(responseTime);
      // Keep only last 1000 response times for average calculation
      if (this.responseTimes.length > 1000) {
        this.responseTimes.shift();
      }
      this.metrics.averageResponseTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    } else {
      this.metrics.errorCount++;
    }

    this.metrics.successRate = ((this.metrics.requestCount - this.metrics.errorCount) / this.metrics.requestCount) * 100;
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = {
      averageResponseTime: 0,
      successRate: 100,
      errorCount: 0,
      requestCount: 0
    };
    this.responseTimes = [];
  }
}

// Health Monitor
class HealthMonitor extends EventEmitter {
  private healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date(),
    details: {}
  };
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(private healthCheckFn: () => Promise<boolean>) {
    super();
  }

  startMonitoring(intervalMs: number = 30000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, intervalMs);

    // Perform initial check
    this.performHealthCheck();
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const isHealthy = await this.healthCheckFn();
      this.updateHealthStatus(isHealthy ? 'healthy' : 'degraded', {
        lastCheck: new Date(),
        dependencyHealthy: isHealthy
      });
    } catch (error) {
      this.updateHealthStatus('unhealthy', {
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private updateHealthStatus(status: HealthStatus['status'], details: Record<string, any>): void {
    const previousStatus = this.healthStatus.status;
    this.healthStatus = {
      status,
      timestamp: new Date(),
      details
    };

    if (status !== previousStatus) {
      this.emit('healthChange', this.healthStatus);
    }

    if (status === 'unhealthy') {
      this.emit('unhealthy', this.healthStatus);
    }
  }

  getHealthStatus(): HealthStatus {
    return { ...this.healthStatus };
  }
}

// Main Authentication Service
export class EnhancedGeminiAuthService extends EventEmitter {
  private tokenManagers: Map<string, TokenManager> = new Map();
  private rateLimiter: RateLimiter;
  private performanceTracker: PerformanceTracker;
  private healthMonitor: HealthMonitor;
  private isInitialized: boolean = false;

  constructor(
    private config: {
      defaultProvider?: string;
      rateLimit?: { requests: number; windowMs: number };
      healthCheckInterval?: number;
    } = {}
  ) {
    super();

    // Initialize components
    const rateLimitConfig = config.rateLimit || { requests: 100, windowMs: 60000 };
    this.rateLimiter = new RateLimiter(rateLimitConfig.requests, rateLimitConfig.windowMs);
    this.performanceTracker = new PerformanceTracker();
    this.healthMonitor = new HealthMonitor(() => this.performHealthCheck());
  }

  /**
   * Initialize the auth service with provider configurations
   */
  async initialize(providers: Record<string, AuthProviderConfig>): Promise<void> {
    if (this.isInitialized) {
      throw new AuthError('Service already initialized', 'ALREADY_INITIALIZED');
    }

    // Validate and set up providers
    for (const [name, config] of Object.entries(providers)) {
      this.validateProviderConfig(config);
      this.tokenManagers.set(name, new TokenManager(config));
    }

    // Start health monitoring
    this.healthMonitor.startMonitoring(this.config.healthCheckInterval);

    this.isInitialized = true;
    this.emit('initialized');
  }

  /**
   * Get authentication token for a specific provider
   */
  async getAuthToken(providerName?: string): Promise<string> {
    if (!this.isInitialized) {
      throw new AuthError('Service not initialized', 'NOT_INITIALIZED');
    }

    const provider = providerName || this.config.defaultProvider;
    if (!provider) {
      throw new AuthError('No provider specified and no default provider configured', 'NO_PROVIDER');
    }

    const startTime = Date.now();
    let success = false;

    try {
      // Check rate limit
      const rateLimitCheck = this.rateLimiter.checkRateLimit();
      if (!rateLimitCheck.allowed) {
        throw new RateLimitError(rateLimitCheck.resetTime);
      }

      // Get token manager
      const tokenManager = this.tokenManagers.get(provider);
      if (!tokenManager) {
        throw new AuthError(`Provider '${provider}' not configured`, 'PROVIDER_NOT_FOUND');
      }

      // Get valid token
      const token = await tokenManager.getValidToken();
      success = true;

      // Check if token is expiring soon and emit warning
      if (tokenManager.isTokenExpiringSoon()) {
        this.emit('tokenExpiringSoon', { provider });
      }

      return token;
    } catch (error) {
      this.emit('authError', { provider, error });
      throw error;
    } finally {
      const responseTime = Date.now() - startTime;
      this.performanceTracker.recordRequest(success, responseTime);
    }
  }

  /**
   * Get API key for a specific provider (for api_key type providers)
   */
  getApiKey(providerName?: string): string {
    if (!this.isInitialized) {
      throw new AuthError('Service not initialized', 'NOT_INITIALIZED');
    }

    const provider = providerName || this.config.defaultProvider;
    if (!provider) {
      throw new AuthError('No provider specified and no default provider configured', 'NO_PROVIDER');
    }

    const tokenManager = this.tokenManagers.get(provider);
    if (!tokenManager) {
      throw new AuthError(`Provider '${provider}' not configured`, 'PROVIDER_NOT_FOUND');
    }

    if (tokenManager['config'].type !== 'api_key' || !tokenManager['config'].apiKey) {
      throw new AuthError(`Provider '${provider}' is not configured as API key provider`, 'INVALID_PROVIDER_TYPE');
    }

    return tokenManager['config'].apiKey;
  }

  /**
   * Get current rate limit information
   */
  getRateLimitInfo(): RateLimitInfo {
    return this.rateLimiter.getRateLimitInfo();
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return this.performanceTracker.getMetrics();
  }

  /**
   * Get health status
   */
  getHealthStatus(): HealthStatus {
    return this.healthMonitor.getHealthStatus();
  }

  /**
   * Add a new provider configuration
   */
  addProvider(name: string, config: AuthProviderConfig): void {
    if (!this.isInitialized) {
      throw new AuthError('Service not initialized', 'NOT_INITIALIZED');
    }

    this.validateProviderConfig(config);
    this.tokenManagers.set(name, new TokenManager(config));
    this.emit('providerAdded', { name, config });
  }

  /**
   * Remove a provider configuration
   */
  removeProvider(name: string): boolean {
    const result = this.tokenManagers.delete(name);
    if (result) {
      this.emit('providerRemoved', { name });
    }
    return result;
  }

  /**
   * List all configured providers
   */
  listProviders(): string[] {
    return Array.from(this.tokenManagers.keys());
  }

  /**
   * Shutdown the service gracefully
   */
  shutdown(): void {
    this.healthMonitor.stopMonitoring();
    this.performanceTracker.reset();
    this.tokenManagers.clear();
    this.isInitialized = false;
    this.emit('shutdown');
  }

  private validateProviderConfig(config: AuthProviderConfig): void {
    switch (config.type) {
      case 'oauth':
        if (!config.clientId || !config.clientSecret || !config.refreshToken) {
          throw new AuthError('OAuth provider requires clientId, clientSecret, and refreshToken', 'INVALID_CONFIG');
        }
        break;
      case 'api_key':
        if (!config.apiKey) {
          throw new AuthError('API key provider requires apiKey', 'INVALID_CONFIG');
        }
        break;
      case 'adc':
        // ADC doesn't require additional configuration
        break;
      default:
        throw new AuthError(`Unsupported provider type: ${config.type}`, 'UNSUPPORTED_PROVIDER_TYPE');
    }
  }

  private async performHealthCheck(): Promise<boolean> {
    // In a real implementation, this would check connectivity to auth services
    // For this example, we'll simulate a health check
    try {
      // Simulate network check
      await promisify(setTimeout)(100);
      return true;
    } catch {
      return false;
    }
  }
}

// Export types
export {
  AuthProviderConfig,
  TokenData,
  HealthStatus,
  RateLimitInfo,
  PerformanceMetrics,
  AuthError,
  RateLimitError,
  TokenRefreshError
};

// Export event types for better TypeScript support
export declare interface EnhancedGeminiAuthService {
  on(event: 'initialized', listener: () => void): this;
  on(event: 'shutdown', listener: () => void): this;
  on(event: 'authError', listener: (data: { provider: string; error: Error }) => void): this;
  on(event: 'tokenExpiringSoon', listener: (data: { provider: string }) => void): this;
  on(event: 'providerAdded', listener: (data: { name: string; config: AuthProviderConfig }) => void): this;
  on(event: 'providerRemoved', listener: (data: { name: string }) => void): this;
  on(event: 'healthChange', listener: (status: HealthStatus) => void): this;
  on(event: 'unhealthy', listener: (status: HealthStatus) => void): this;

  once(event: 'initialized', listener: () => void): this;
  once(event: 'shutdown', listener: () => void): this;
  once(event: 'authError', listener: (data: { provider: string; error: Error }) => void): this;
  once(event: 'tokenExpiringSoon', listener: (data: { provider: string }) => void): this;
  once(event: 'providerAdded', listener: (data: { name: string; config: AuthProviderConfig }) => void): this;
  once(event: 'providerRemoved', listener: (data: { name: string }) => void): this;
  once(event: 'healthChange', listener: (status: HealthStatus) => void): this;
  once(event: 'unhealthy', listener: (status: HealthStatus) => void): this;
}