import { EventEmitter } from 'events';

export interface HealthCheckResult {
  provider: string;
  healthy: boolean;
  responseTime?: number;
  error?: string;
  timestamp: number;
}

/**
 * Qwen Health Monitor
 * Continuously monitors the health of Qwen providers
 */
export class QwenHealthMonitor extends EventEmitter {
  private providers: string[] = [];
  private healthStatus: Map<string, boolean> = new Map();
  private lastHealthCheck: Map<string, number> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  // Configuration
  private readonly checkInterval = 30000; // 30 seconds
  private readonly timeout = 10000; // 10 seconds per health check
  private readonly unhealthyThreshold = 3; // Mark unhealthy after 3 consecutive failures
  private readonly healthyThreshold = 2; // Mark healthy after 2 consecutive successes

  // Failure tracking
  private consecutiveFailures: Map<string, number> = new Map();
  private consecutiveSuccesses: Map<string, number> = new Map();

  /**
   * Start health monitoring for providers
   */
  async start(providers: string[]): Promise<void> {
    if (this.isRunning) {
      console.warn('[Health Monitor] Already running');
      return;
    }

    this.providers = [...providers];
    console.log(`[Health Monitor] Starting monitoring for providers: ${providers.join(', ')}`);

    // Initialize status for all providers
    for (const provider of providers) {
      this.healthStatus.set(provider, true); // Assume healthy initially
      this.consecutiveFailures.set(provider, 0);
      this.consecutiveSuccesses.set(provider, 0);
    }

    // Perform initial health check
    await this.performHealthChecks();

    // Start periodic health checks
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        console.error('[Health Monitor] Error during health checks:', error);
      }
    }, this.checkInterval);

    this.isRunning = true;
    console.log('[Health Monitor] Started successfully');
  }

  /**
   * Stop health monitoring
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('[Health Monitor] Not running');
      return;
    }

    console.log('[Health Monitor] Stopping...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    this.isRunning = false;
    console.log('[Health Monitor] Stopped');
  }

  /**
   * Check if a provider is healthy
   */
  isProviderHealthy(provider: string): boolean {
    return this.healthStatus.get(provider) ?? false;
  }

  /**
   * Get health status for all providers
   */
  getHealthStatus(): Record<string, any> {
    const status: Record<string, any> = {};

    for (const provider of this.providers) {
      status[provider] = {
        healthy: this.healthStatus.get(provider) ?? false,
        lastCheck: this.lastHealthCheck.get(provider),
        consecutiveFailures: this.consecutiveFailures.get(provider) ?? 0,
        consecutiveSuccesses: this.consecutiveSuccesses.get(provider) ?? 0,
      };
    }

    return status;
  }

  /**
   * Force health check for a specific provider
   */
  async checkProvider(provider: string): Promise<HealthCheckResult> {
    console.log(`[Health Monitor] Checking provider: ${provider}`);
    
    const startTime = Date.now();
    
    try {
      const result = await this.performProviderHealthCheck(provider);
      const responseTime = Date.now() - startTime;
      
      return {
        provider,
        healthy: result,
        responseTime,
        timestamp: Date.now(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        provider,
        healthy: false,
        responseTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Perform health checks for all providers
   */
  private async performHealthChecks(): Promise<void> {
    console.log('[Health Monitor] Performing health checks...');

    const healthCheckPromises = this.providers.map(async (provider) => {
      try {
        const result = await this.checkProvider(provider);
        this.updateProviderHealth(provider, result.healthy, result.error);
        return result;
      } catch (error) {
        console.error(`[Health Monitor] Health check failed for ${provider}:`, error);
        this.updateProviderHealth(provider, false, error instanceof Error ? error.message : String(error));
        return {
          provider,
          healthy: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        };
      }
    });

    const results = await Promise.allSettled(healthCheckPromises);
    
    // Log summary
    const healthyCount = results.filter(r => 
      r.status === 'fulfilled' && r.value.healthy
    ).length;
    
    console.log(`[Health Monitor] Health check complete: ${healthyCount}/${this.providers.length} providers healthy`);
  }

  /**
   * Perform health check for a specific provider
   */
  private async performProviderHealthCheck(provider: string): Promise<boolean> {
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), this.timeout);
    });

    // Create the actual health check promise
    const healthCheckPromise = this.executeProviderHealthCheck(provider);

    try {
      // Race between health check and timeout
      const result = await Promise.race([healthCheckPromise, timeoutPromise]);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute actual health check for provider
   */
  private async executeProviderHealthCheck(provider: string): Promise<boolean> {
    try {
      // Import spawn dynamically to avoid circular dependencies
      const { spawn } = await import('child_process');
      
      return new Promise<boolean>((resolve, reject) => {
        // Simple ping command to test provider availability
        const process = spawn('qwen', ['-p', 'ping'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            // Provider-specific environment variables would be set here
            // This would come from the auth manager
          },
        });

        let stdout = '';
        let stderr = '';

        process.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        process.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        process.on('close', (code) => {
          if (code === 0) {
            resolve(true);
          } else {
            reject(new Error(`Health check failed with code ${code}: ${stderr}`));
          }
        });

        process.on('error', (error) => {
          reject(new Error(`Health check process error: ${error.message}`));
        });

        // Send simple ping
        if (process.stdin) {
          process.stdin.write('ping\n');
          process.stdin.end();
        }
      });
    } catch (error) {
      throw new Error(`Health check execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update provider health status
   */
  private updateProviderHealth(provider: string, isHealthy: boolean, error?: string): void {
    const currentStatus = this.healthStatus.get(provider) ?? true;
    this.lastHealthCheck.set(provider, Date.now());

    if (isHealthy) {
      // Reset failure count and increment success count
      this.consecutiveFailures.set(provider, 0);
      const successes = (this.consecutiveSuccesses.get(provider) ?? 0) + 1;
      this.consecutiveSuccesses.set(provider, successes);

      // Mark as healthy if enough consecutive successes
      if (!currentStatus && successes >= this.healthyThreshold) {
        this.healthStatus.set(provider, true);
        console.log(`[Health Monitor] Provider ${provider} restored to healthy`);
        this.emit('worker-healthy', provider);
      }
    } else {
      // Reset success count and increment failure count
      this.consecutiveSuccesses.set(provider, 0);
      const failures = (this.consecutiveFailures.get(provider) ?? 0) + 1;
      this.consecutiveFailures.set(provider, failures);

      // Mark as unhealthy if enough consecutive failures
      if (currentStatus && failures >= this.unhealthyThreshold) {
        this.healthStatus.set(provider, false);
        console.warn(`[Health Monitor] Provider ${provider} marked as unhealthy: ${error || 'Unknown error'}`);
        this.emit('worker-unhealthy', provider);
      }
    }
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): Record<string, any> {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      timeout: this.timeout,
      providers: this.providers.length,
      healthyProviders: Array.from(this.healthStatus.values()).filter(Boolean).length,
      lastHealthChecks: Object.fromEntries(this.lastHealthCheck),
      healthStatus: Object.fromEntries(this.healthStatus),
    };
  }
}