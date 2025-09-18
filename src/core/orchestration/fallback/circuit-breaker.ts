/**
 * Circuit Breaker Pattern - Automatic failure detection and recovery
 * Part of DevFlow Dream Team Fallback System
 */

// Agent types for Dream Team
export type AgentType = 'claude' | 'codex' | 'gemini' | 'qwen' | 'synthetic';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes before closing
  timeout: number; // Time in ms before attempting recovery
  maxTimeout: number; // Maximum timeout before emergency mode
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: Date | null;
  nextAttemptTime: Date | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailureTime: Date | null = null;
  private nextAttemptTime: Date | null = null;
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;

  constructor(
    private agent: AgentType,
    private config: CircuitBreakerConfig
  ) {
    console.log(`[CIRCUIT-BREAKER] Initialized for ${agent.toUpperCase()}`);
  }

  /**
   * Execute a task with circuit breaker protection
   */
  async execute<T>(task: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check circuit state before execution
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
        console.log(`[CIRCUIT-BREAKER] ${this.agent.toUpperCase()} transitioning to HALF-OPEN`);
      } else {
        const waitTime = this.nextAttemptTime ? Math.ceil((this.nextAttemptTime.getTime() - Date.now()) / 1000) : 0;
        throw new Error(`Circuit breaker OPEN for ${this.agent}. Next attempt in ${waitTime}s`);
      }
    }

    try {
      const result = await task();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.successes++;
    this.totalSuccesses++;
    this.failures = 0; // Reset failure count on success

    if (this.state === 'half-open') {
      if (this.successes >= this.config.successThreshold) {
        this.close();
      }
    }

    console.log(`[CIRCUIT-BREAKER] ${this.agent.toUpperCase()} SUCCESS - State: ${this.state}, Successes: ${this.successes}`);
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.totalFailures++;
    this.lastFailureTime = new Date();
    this.successes = 0; // Reset success count on failure

    if (this.state === 'closed' || this.state === 'half-open') {
      if (this.failures >= this.config.failureThreshold) {
        this.open();
      }
    }

    console.log(`[CIRCUIT-BREAKER] ${this.agent.toUpperCase()} FAILURE - State: ${this.state}, Failures: ${this.failures}`);
  }

  /**
   * Open the circuit breaker
   */
  private open(): void {
    this.state = 'open';
    this.nextAttemptTime = new Date(Date.now() + this.config.timeout);

    console.log(`[CIRCUIT-BREAKER] ${this.agent.toUpperCase()} OPENED - Next attempt: ${this.nextAttemptTime.toISOString()}`);
  }

  /**
   * Close the circuit breaker
   */
  private close(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.nextAttemptTime = null;

    console.log(`[CIRCUIT-BREAKER] ${this.agent.toUpperCase()} CLOSED - Agent recovered`);
  }

  /**
   * Check if should attempt reset from open to half-open
   */
  private shouldAttemptReset(): boolean {
    if (!this.nextAttemptTime) return false;
    return Date.now() >= this.nextAttemptTime.getTime();
  }

  /**
   * Force reset the circuit breaker (for manual recovery)
   */
  forceReset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.nextAttemptTime = null;

    console.log(`[CIRCUIT-BREAKER] ${this.agent.toUpperCase()} FORCE RESET`);
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses
    };
  }

  /**
   * Check if circuit breaker is available for requests
   */
  isAvailable(): boolean {
    if (this.state === 'closed' || this.state === 'half-open') {
      return true;
    }

    // Open state - check if ready for retry
    return this.shouldAttemptReset();
  }

  /**
   * Get failure rate
   */
  getFailureRate(): number {
    if (this.totalRequests === 0) return 0;
    return this.totalFailures / this.totalRequests;
  }

  /**
   * Check if agent is in emergency mode (exceeded max timeout)
   */
  isEmergencyMode(): boolean {
    if (this.state !== 'open' || !this.lastFailureTime) return false;

    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure > this.config.maxTimeout;
  }
}

/**
 * Circuit Breaker Manager - Manages circuit breakers for all agents
 */
export class CircuitBreakerManager {
  private circuitBreakers: Map<AgentType, CircuitBreaker> = new Map();

  private readonly defaultConfigs: Map<AgentType, CircuitBreakerConfig> = new Map([
    ['codex', { failureThreshold: 3, successThreshold: 2, timeout: 60000, maxTimeout: 300000 }], // 1min timeout, 5min max
    ['gemini', { failureThreshold: 4, successThreshold: 3, timeout: 90000, maxTimeout: 600000 }], // 1.5min timeout, 10min max
    ['qwen', { failureThreshold: 3, successThreshold: 2, timeout: 60000, maxTimeout: 300000 }], // 1min timeout, 5min max
    ['synthetic', { failureThreshold: 2, successThreshold: 1, timeout: 120000, maxTimeout: 900000 }], // 2min timeout, 15min max
    ['claude', { failureThreshold: 10, successThreshold: 1, timeout: 5000, maxTimeout: 30000 }] // Local - very lenient
  ]);

  constructor() {
    this.initializeCircuitBreakers();
  }

  private initializeCircuitBreakers(): void {
    for (const [agent, config] of this.defaultConfigs.entries()) {
      this.circuitBreakers.set(agent, new CircuitBreaker(agent, config));
    }

    console.log('[CIRCUIT-BREAKER-MANAGER] All circuit breakers initialized');
  }

  /**
   * Execute task with circuit breaker protection
   */
  async executeWithProtection<T>(agent: AgentType, task: () => Promise<T>): Promise<T> {
    const circuitBreaker = this.circuitBreakers.get(agent);
    if (!circuitBreaker) {
      throw new Error(`No circuit breaker found for agent: ${agent}`);
    }

    return circuitBreaker.execute(task);
  }

  /**
   * Check if agent is available (circuit breaker allows requests)
   */
  isAgentAvailable(agent: AgentType): boolean {
    const circuitBreaker = this.circuitBreakers.get(agent);
    return circuitBreaker ? circuitBreaker.isAvailable() : false;
  }

  /**
   * Get circuit breaker metrics for an agent
   */
  getAgentMetrics(agent: AgentType): CircuitBreakerMetrics | null {
    const circuitBreaker = this.circuitBreakers.get(agent);
    return circuitBreaker ? circuitBreaker.getMetrics() : null;
  }

  /**
   * Get all circuit breaker metrics
   */
  getAllMetrics(): Map<AgentType, CircuitBreakerMetrics> {
    const metrics = new Map<AgentType, CircuitBreakerMetrics>();
    for (const [agent, circuitBreaker] of this.circuitBreakers.entries()) {
      metrics.set(agent, circuitBreaker.getMetrics());
    }
    return metrics;
  }

  /**
   * Force reset circuit breaker for an agent
   */
  forceReset(agent: AgentType): void {
    const circuitBreaker = this.circuitBreakers.get(agent);
    if (circuitBreaker) {
      circuitBreaker.forceReset();
    }
  }

  /**
   * Get agents in emergency mode
   */
  getEmergencyModeAgents(): AgentType[] {
    const emergencyAgents: AgentType[] = [];
    for (const [agent, circuitBreaker] of this.circuitBreakers.entries()) {
      if (circuitBreaker.isEmergencyMode()) {
        emergencyAgents.push(agent);
      }
    }
    return emergencyAgents;
  }

  /**
   * Get system-wide circuit breaker health
   */
  getSystemHealth(): {
    totalAgents: number;
    availableAgents: number;
    openCircuits: number;
    emergencyModeAgents: number;
    overallFailureRate: number;
  } {
    const allMetrics = this.getAllMetrics();
    const emergencyAgents = this.getEmergencyModeAgents();

    let totalRequests = 0;
    let totalFailures = 0;
    let openCircuits = 0;
    let availableAgents = 0;

    for (const metrics of allMetrics.values()) {
      totalRequests += metrics.totalRequests;
      totalFailures += metrics.totalFailures;

      if (metrics.state === 'open') {
        openCircuits++;
      }

      if (metrics.state === 'closed' || metrics.state === 'half-open') {
        availableAgents++;
      }
    }

    return {
      totalAgents: allMetrics.size,
      availableAgents,
      openCircuits,
      emergencyModeAgents: emergencyAgents.length,
      overallFailureRate: totalRequests > 0 ? totalFailures / totalRequests : 0
    };
  }
}