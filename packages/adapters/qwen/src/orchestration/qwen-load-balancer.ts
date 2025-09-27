import { QwenTask } from './qwen-orchestrator.js';

export interface ProviderStats {
  successCount: number;
  failureCount: number;
  totalRequests: number;
  avgResponseTime: number;
  lastUsed: number;
  successRate: number;
  isHealthy: boolean;
}

/**
 * Qwen Load Balancer
 * Intelligently routes tasks to the best available provider
 */
export class QwenLoadBalancer {
  private providerStats: Map<string, ProviderStats> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor() {
    // Initialize circuit breakers for each provider
  }

  /**
   * Select the best provider for a task
   */
  async selectProvider(task: QwenTask, availableProviders: string[]): Promise<string> {
    const healthyProviders = availableProviders.filter(provider => this.isProviderHealthy(provider));
    
    if (healthyProviders.length === 0) {
      throw new Error('No healthy providers available');
    }

    // If only one healthy provider, use it
    if (healthyProviders.length === 1) {
      return healthyProviders[0];
    }

    // Use weighted round-robin based on provider performance
    return this.selectByWeightedRoundRobin(task, healthyProviders);
  }

  /**
   * Select provider using weighted round-robin algorithm
   */
  private selectByWeightedRoundRobin(task: QwenTask, providers: string[]): string {
    let bestProvider = providers[0];
    let bestScore = 0;

    for (const provider of providers) {
      const score = this.calculateProviderScore(provider, task);
      if (score > bestScore) {
        bestScore = score;
        bestProvider = provider;
      }
    }

    return bestProvider;
  }

  /**
   * Calculate provider score based on multiple factors
   */
  private calculateProviderScore(provider: string, task: QwenTask): number {
    const stats = this.getProviderStats(provider);
    
    // Base score factors
    let score = 100;

    // Success rate factor (0-40 points)
    score += stats.successRate * 40;

    // Response time factor (0-30 points, inverted - faster is better)
    const responseTimeFactor = Math.max(0, 30 - (stats.avgResponseTime / 1000) * 10);
    score += responseTimeFactor;

    // Recency factor (0-20 points, prefer less recently used)
    const timeSinceLastUse = Date.now() - stats.lastUsed;
    const recencyFactor = Math.min(20, timeSinceLastUse / 60000); // 1 minute = 20 points
    score += recencyFactor;

    // Task-specific bonuses (0-10 points)
    score += this.getTaskSpecificBonus(provider, task);

    return score;
  }

  /**
   * Get task-specific bonus for provider
   */
  private getTaskSpecificBonus(provider: string, task: QwenTask): number {
    let bonus = 0;

    // Provider specialization bonuses
    switch (provider) {
      case 'dashscope':
        if (task.type === 'code_generation' || task.type === 'code_analysis') {
          bonus += 5; // DashScope is optimized for coding
        }
        break;
      
      case 'openrouter':
        if (task.priority === 'low') {
          bonus += 3; // Use free tier for low priority tasks
        }
        break;
    }

    return bonus;
  }

  /**
   * Report successful execution
   */
  reportSuccess(provider: string, responseTime: number): void {
    const stats = this.getOrCreateStats(provider);
    
    stats.successCount++;
    stats.totalRequests++;
    stats.lastUsed = Date.now();
    
    // Update average response time
    const oldAvg = stats.avgResponseTime;
    const count = stats.successCount;
    stats.avgResponseTime = ((oldAvg * (count - 1)) + responseTime) / count;
    
    // Update success rate
    stats.successRate = stats.successCount / stats.totalRequests;

    // Close circuit breaker on success
    const circuitBreaker = this.getOrCreateCircuitBreaker(provider);
    circuitBreaker.onSuccess();

    console.log(`[Load Balancer] Success reported for ${provider}: ${responseTime}ms`);
  }

  /**
   * Report failed execution
   */
  reportFailure(provider: string, error: string): void {
    const stats = this.getOrCreateStats(provider);
    
    stats.failureCount++;
    stats.totalRequests++;
    stats.lastUsed = Date.now();
    
    // Update success rate
    stats.successRate = stats.successCount / stats.totalRequests;

    // Open circuit breaker on failure
    const circuitBreaker = this.getOrCreateCircuitBreaker(provider);
    circuitBreaker.onFailure();

    console.warn(`[Load Balancer] Failure reported for ${provider}: ${error}`);
  }

  /**
   * Check if provider is healthy
   */
  isProviderHealthy(provider: string): boolean {
    const stats = this.getProviderStats(provider);
    const circuitBreaker = this.getOrCreateCircuitBreaker(provider);
    
    return stats.isHealthy && !circuitBreaker.isOpen();
  }

  /**
   * Mark provider as healthy
   */
  markProviderHealthy(provider: string): void {
    const stats = this.getOrCreateStats(provider);
    stats.isHealthy = true;
    
    const circuitBreaker = this.getOrCreateCircuitBreaker(provider);
    circuitBreaker.reset();
    
    console.log(`[Load Balancer] Provider ${provider} marked as healthy`);
  }

  /**
   * Mark provider as unhealthy
   */
  markProviderUnhealthy(provider: string): void {
    const stats = this.getOrCreateStats(provider);
    stats.isHealthy = false;
    
    console.warn(`[Load Balancer] Provider ${provider} marked as unhealthy`);
  }

  /**
   * Get provider statistics
   */
  getProviderStats(provider: string): ProviderStats {
    return this.getOrCreateStats(provider);
  }

  /**
   * Get all provider statistics
   */
  getAllStats(): Record<string, ProviderStats> {
    const allStats: Record<string, ProviderStats> = {};
    
    for (const [provider, stats] of this.providerStats) {
      allStats[provider] = { ...stats };
    }
    
    return allStats;
  }

  /**
   * Reset statistics for a provider
   */
  resetProviderStats(provider: string): void {
    this.providerStats.delete(provider);
    this.circuitBreakers.delete(provider);
    console.log(`[Load Balancer] Stats reset for provider: ${provider}`);
  }

  /**
   * Reset all statistics
   */
  resetAllStats(): void {
    this.providerStats.clear();
    this.circuitBreakers.clear();
    console.log('[Load Balancer] All stats reset');
  }

  /**
   * Get or create provider statistics
   */
  private getOrCreateStats(provider: string): ProviderStats {
    if (!this.providerStats.has(provider)) {
      this.providerStats.set(provider, {
        successCount: 0,
        failureCount: 0,
        totalRequests: 0,
        avgResponseTime: 0,
        lastUsed: 0,
        successRate: 1.0,
        isHealthy: true,
      });
    }
    
    return this.providerStats.get(provider)!;
  }

  /**
   * Get or create circuit breaker for provider
   */
  private getOrCreateCircuitBreaker(provider: string): CircuitBreaker {
    if (!this.circuitBreakers.has(provider)) {
      this.circuitBreakers.set(provider, new CircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 60000, // 1 minute
      }));
    }
    
    return this.circuitBreakers.get(provider)!;
  }
}

/**
 * Simple Circuit Breaker implementation
 */
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(
    private options: {
      failureThreshold: number;
      resetTimeout: number;
      successThreshold?: number;
    }
  ) {
    this.options.successThreshold = this.options.successThreshold || 3;
  }

  isOpen(): boolean {
    if (this.state === 'OPEN') {
      // Check if we should transition to half-open
      if (Date.now() - this.lastFailureTime > this.options.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        return false;
      }
      return true;
    }
    
    return false;
  }

  onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold!) {
        this.reset();
      }
    } else {
      this.failureCount = 0;
    }
  }

  onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
  }
}