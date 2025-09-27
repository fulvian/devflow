/**
 * Fallback Chain Orchestration Module
 * 
 * This module implements a fallback chain mechanism that orchestrates
 * execution across multiple AI agents in a priority-based sequence:
 * 1. Codex (highest priority)
 * 2. Gemini CLI 
 * 3. Qwen3 (lowest priority)
 * 
 * Features:
 * - Priority-based agent selection
 * - Context preservation between agents
 * - Timeout management per agent
 * - Error propagation and handling
 * - Performance metrics tracking
 * - Circuit breaker integration
 */

// External dependencies
import { EventEmitter } from 'events';

// Type definitions
export interface AgentResponse {
  agent: string;
  response: any;
  executionTime: number;
  success: boolean;
  error?: Error;
}

export interface AgentContext {
  [key: string]: any;
}

export interface AgentConfig {
  timeout: number;
  priority: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
}

export interface Agent {
  name: string;
  execute: (input: string, context: AgentContext) => Promise<any>;
  config: AgentConfig;
}

export interface Metrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  agentUsage: Record<string, number>;
}

export interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  open: boolean;
}

// Circuit Breaker Implementation
class CircuitBreaker {
  private state: CircuitBreakerState;
  private threshold: number;
  private timeout: number;

  constructor(threshold: number, timeout: number) {
    this.state = {
      failures: 0,
      lastFailure: 0,
      open: false
    };
    this.threshold = threshold;
    this.timeout = timeout;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state.open) {
      const now = Date.now();
      if (now - this.state.lastFailure > this.timeout) {
        // Half-open state - try one request
        this.state.open = false;
        this.state.failures = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.state.failures = 0;
  }

  private onFailure(): void {
    this.state.failures++;
    this.state.lastFailure = Date.now();
    
    if (this.state.failures >= this.threshold) {
      this.state.open = true;
    }
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  reset(): void {
    this.state = {
      failures: 0,
      lastFailure: 0,
      open: false
    };
  }
}

// Main Fallback Chain Orchestrator
export class FallbackChainOrchestrator extends EventEmitter {
  private agents: Agent[] = [];
  private metrics: Metrics;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private context: AgentContext = {};

  constructor() {
    super();
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      agentUsage: {}
    };
  }

  /**
   * Register an agent with the orchestrator
   * @param agent The agent to register
   */
  registerAgent(agent: Agent): void {
    this.agents.push(agent);
    this.agents.sort((a, b) => a.config.priority - b.config.priority);
    
    // Initialize circuit breaker for the agent
    this.circuitBreakers.set(
      agent.name,
      new CircuitBreaker(
        agent.config.circuitBreakerThreshold,
        agent.config.circuitBreakerTimeout
      )
    );
    
    // Initialize metrics counter for the agent
    if (!this.metrics.agentUsage[agent.name]) {
      this.metrics.agentUsage[agent.name] = 0;
    }
  }

  /**
   * Execute the fallback chain with the given input
   * @param input The input to process
   * @param initialContext Optional initial context
   * @returns Promise resolving to the first successful response
   */
  async execute(input: string, initialContext?: AgentContext): Promise<AgentResponse> {
    this.metrics.totalRequests++;
    
    // Initialize or update context
    if (initialContext) {
      this.context = { ...this.context, ...initialContext };
    }

    const startTime = Date.now();
    let lastError: Error | null = null;

    // Try each agent in priority order
    for (const agent of this.agents) {
      try {
        const agentStartTime = Date.now();
        
        // Check if circuit breaker is open
        const circuitBreaker = this.circuitBreakers.get(agent.name);
        if (!circuitBreaker) {
          throw new Error(`Circuit breaker not found for agent: ${agent.name}`);
        }

        // Execute with timeout and circuit breaker
        const response = await Promise.race([
          circuitBreaker.execute(() => agent.execute(input, this.context)),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Agent timeout')), agent.config.timeout)
          )
        ]);

        const agentExecutionTime = Date.now() - agentStartTime;
        
        // Update context with results
        this.context = {
          ...this.context,
          [`${agent.name}Response`]: response,
          lastSuccessfulAgent: agent.name
        };

        // Update metrics
        this.updateMetrics(true, agent.name, agentExecutionTime);

        const result: AgentResponse = {
          agent: agent.name,
          response,
          executionTime: Date.now() - startTime,
          success: true
        };

        this.emit('agentSuccess', result);
        return result;

      } catch (error) {
        const executionTime = Date.now() - startTime;
        
        // Update metrics for failure
        this.updateMetrics(false, agent.name, executionTime);
        
        const errorResponse: AgentResponse = {
          agent: agent.name,
          response: null,
          executionTime,
          success: false,
          error: error as Error
        };

        this.emit('agentFailure', errorResponse);
        lastError = error as Error;
      }
    }

    // All agents failed
    this.metrics.failedRequests++;
    const finalError = new Error(`All agents failed. Last error: ${lastError?.message}`);
    
    this.emit('chainFailure', finalError);
    throw finalError;
  }

  /**
   * Update performance metrics
   * @param success Whether the execution was successful
   * @param agentName Name of the agent
   * @param executionTime Execution time in milliseconds
   */
  private updateMetrics(success: boolean, agentName: string, executionTime: number): void {
    if (success) {
      this.metrics.successfulRequests++;
      
      // Update average response time
      const totalSuccessfulTime = 
        this.metrics.averageResponseTime * (this.metrics.successfulRequests - 1) + executionTime;
      this.metrics.averageResponseTime = totalSuccessfulTime / this.metrics.successfulRequests;
    } else {
      this.metrics.failedRequests++;
    }

    // Update agent usage count
    this.metrics.agentUsage[agentName] = (this.metrics.agentUsage[agentName] || 0) + 1;
  }

  /**
   * Get current performance metrics
   * @returns Current metrics
   */
  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  /**
   * Get current context
   * @returns Current context
   */
  getContext(): AgentContext {
    return { ...this.context };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      agentUsage: {}
    };
    
    // Reset agent usage counters
    for (const agent of this.agents) {
      this.metrics.agentUsage[agent.name] = 0;
    }
  }

  /**
   * Reset circuit breakers
   */
  resetCircuitBreakers(): void {
    for (const breaker of this.circuitBreakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Get circuit breaker state for an agent
   * @param agentName Name of the agent
   * @returns Circuit breaker state
   */
  getCircuitBreakerState(agentName: string): CircuitBreakerState | undefined {
    const breaker = this.circuitBreakers.get(agentName);
    return breaker ? breaker.getState() : undefined;
  }
}

// Example agent implementations
export class CodexAgent implements Agent {
  name = 'Codex';
  config: AgentConfig = {
    timeout: 5000,
    priority: 1,
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 60000
  };

  async execute(input: string, context: AgentContext): Promise<any> {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          result: `Codex processed: ${input}`,
          context: { ...context, codexProcessed: true }
        });
      }, 100);
    });
  }
}

export class GeminiCLI implements Agent {
  name = 'GeminiCLI';
  config: AgentConfig = {
    timeout: 10000,
    priority: 2,
    circuitBreakerThreshold: 3,
    circuitBreakerTimeout: 30000
  };

  async execute(input: string, context: AgentContext): Promise<any> {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          result: `Gemini CLI processed: ${input}`,
          context: { ...context, geminiProcessed: true }
        });
      }, 200);
    });
  }
}

export class Qwen3Agent implements Agent {
  name = 'Qwen3';
  config: AgentConfig = {
    timeout: 15000,
    priority: 3,
    circuitBreakerThreshold: 3,
    circuitBreakerTimeout: 30000
  };

  async execute(input: string, context: AgentContext): Promise<any> {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          result: `Qwen3 processed: ${input}`,
          context: { ...context, qwen3Processed: true }
        });
      }, 300);
    });
  }
}

// Export types and classes
export {
  CircuitBreaker,
  Agent,
  AgentResponse,
  AgentContext,
  AgentConfig,
  Metrics,
  CircuitBreakerState
};