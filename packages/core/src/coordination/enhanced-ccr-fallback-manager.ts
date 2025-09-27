/**
 * Enhanced CCR Fallback Manager
 * 
 * This module implements an enhanced CCR (Circuit Breaker Retry) fallback manager
 * with dynamic fallback chain configuration, context preservation, real-time
 * monitoring, and integration with Codex MCP server.
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { CircuitBreaker, CircuitBreakerState } from './circuit-breaker';
import { CodexMCPClient } from './codex-mcp-client';
import { AgentContext, FallbackChain, FallbackStrategy } from './types';

// Define custom events for monitoring
interface CCRFallbackManagerEvents {
  'fallback-triggered': (context: AgentContext, fromAgent: string, toAgent: string) => void;
  'circuit-state-change': (agent: string, newState: CircuitBreakerState) => void;
  'context-preserved': (context: AgentContext) => void;
  'error-recovery': (agent: string, recoveryInfo: any) => void;
  'metrics-update': (metrics: any) => void;
}

// Define typed emitter for better type safety
declare interface CCRFallbackManager {
  on<U extends keyof CCRFallbackManagerEvents>(
    event: U, listener: CCRFallbackManagerEvents[U]
  ): this;

  emit<U extends keyof CCRFallbackManagerEvents>(
    event: U, ...args: Parameters<CCRFallbackManagerEvents[U]>
  ): boolean;
}

/**
 * Enhanced CCR Fallback Manager Class
 */
class CCRFallbackManager extends EventEmitter {
  private fallbackChains: Map<string, FallbackChain>;
  private circuitBreakers: Map<string, CircuitBreaker>;
  private codexClient: CodexMCPClient;
  private logger: Logger;
  private metrics: Map<string, any>;
  private contextStore: Map<string, AgentContext>;

  constructor(options: {
    codexClient: CodexMCPClient;
    logger: Logger;
  }) {
    super();
    this.fallbackChains = new Map();
    this.circuitBreakers = new Map();
    this.codexClient = options.codexClient;
    this.logger = options.logger;
    this.metrics = new Map();
    this.contextStore = new Map();
    
    // Set up monitoring integration
    this.setupMonitoring();
  }

  /**
   * Configure a dynamic fallback chain for an agent
   */
  public configureFallbackChain(agentId: string, chain: FallbackChain): void {
    this.fallbackChains.set(agentId, chain);
    this.logger.info(`Configured fallback chain for agent ${agentId}`, { chain });
  }

  /**
   * Register a circuit breaker for an agent
   */
  public registerCircuitBreaker(agentId: string, breaker: CircuitBreaker): void {
    this.circuitBreakers.set(agentId, breaker);
    
    // Listen to circuit breaker state changes
    breaker.on('stateChange', (newState: CircuitBreakerState) => {
      this.emit('circuit-state-change', agentId, newState);
      this.logger.info(`Circuit breaker for ${agentId} changed to ${newState}`);
    });
  }

  /**
   * Execute an agent with fallback capabilities
   */
  public async executeWithFallback<T>(
    agentId: string,
    context: AgentContext,
    executionFn: (context: AgentContext) => Promise<T>
  ): Promise<T> {
    try {
      // Preserve context before execution
      this.preserveContext(agentId, context);
      
      // Check circuit breaker state
      const breaker = this.circuitBreakers.get(agentId);
      if (breaker && !breaker.canExecute()) {
        this.logger.warn(`Circuit breaker open for agent ${agentId}, triggering fallback`);
        return await this.executeFallback(agentId, context);
      }

      // Execute primary agent
      const result = await executionFn(context);
      
      // Update metrics on success
      this.updateMetrics(agentId, { success: true });
      
      // Reset circuit breaker on success
      if (breaker) {
        breaker.onSuccess();
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Error executing agent ${agentId}: ${error.message}`, { error });
      
      // Update metrics on failure
      this.updateMetrics(agentId, { success: false, error: error.message });
      
      // Trip circuit breaker on failure
      const breaker = this.circuitBreakers.get(agentId);
      if (breaker) {
        breaker.onFailure();
      }
      
      // Execute fallback chain
      return await this.executeFallback(agentId, context);
    }
  }

  /**
   * Execute the fallback chain for an agent
   */
  private async executeFallback<T>(agentId: string, context: AgentContext): Promise<T> {
    const chain = this.fallbackChains.get(agentId);
    
    if (!chain || chain.strategies.length === 0) {
      this.logger.error(`No fallback chain configured for agent ${agentId}`);
      throw new Error(`No fallback available for agent ${agentId}`);
    }

    // Try each fallback strategy in order
    for (const strategy of chain.strategies) {
      try {
        switch (strategy.type) {
          case FallbackStrategy.SWITCH_AGENT:
            return await this.switchToAgent<T>(agentId, strategy.targetAgent, context);
            
          case FallbackStrategy.RETRY:
            // Retry should be handled at the executeWithFallback level, not as a fallback strategy
            throw new Error('Retry strategy not supported in fallback chain');
            
          case FallbackStrategy.SYNTHETIC_RESPONSE:
            return this.generateSyntheticResponse<T>(strategy);
            
          case FallbackStrategy.GEMINI_CLI:
            return await this.executeGeminiCLI<T>(strategy, context);
            
          default:
            throw new Error(`Unknown fallback strategy: ${strategy.type}`);
        }
      } catch (error) {
        this.logger.warn(`Fallback strategy ${strategy.type} failed: ${error.message}`);
        continue;
      }
    }

    // If all fallbacks failed
    this.logger.error(`All fallback strategies failed for agent ${agentId}`);
    throw new Error(`All fallbacks exhausted for agent ${agentId}`);
  }

  /**
   * Switch execution to another agent while preserving context
   */
  private async switchToAgent<T>(
    fromAgent: string,
    toAgent: string,
    context: AgentContext
  ): Promise<T> {
    this.logger.info(`Switching from agent ${fromAgent} to ${toAgent}`);
    
    // Emit event for monitoring
    this.emit('fallback-triggered', context, fromAgent, toAgent);
    
    // Preserve context during transition
    const preservedContext = this.preserveContext(toAgent, context);
    
    // Get circuit breaker for target agent
    const breaker = this.circuitBreakers.get(toAgent);
    if (breaker && !breaker.canExecute()) {
      this.logger.warn(`Target agent ${toAgent} circuit breaker is open`);
      throw new Error(`Target agent ${toAgent} unavailable`);
    }

    try {
      // Execute with target agent's implementation
      // This would typically be resolved through a registry or factory
      const result = await this.executeAgent<T>(toAgent, preservedContext);
      
      // Report successful fallback
      this.emit('error-recovery', toAgent, {
        fromAgent,
        context: preservedContext
      });
      
      return result;
    } catch (error) {
      // Trip circuit breaker on failure
      if (breaker) {
        breaker.onFailure();
      }
      throw error;
    }
  }

  /**
   * Retry execution with exponential backoff
   */
  private async retryExecution<T>(
    agentId: string,
    context: AgentContext,
    strategy: any,
    executionFn: (context: AgentContext) => Promise<T>
  ): Promise<T> {
    const maxRetries = strategy.maxRetries || 3;
    const baseDelay = strategy.baseDelay || 1000;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        // Exponential backoff delay
        if (i > 0) {
          const delay = baseDelay * Math.pow(2, i - 1);
          await this.sleep(delay);
        }
        
        return await executionFn(context);
      } catch (error) {
        this.logger.warn(`Retry ${i + 1}/${maxRetries} failed for agent ${agentId}: ${error.message}`);
        
        // If this is the last retry, throw the error
        if (i === maxRetries - 1) {
          throw error;
        }
      }
    }
    
    throw new Error(`Retry execution failed after ${maxRetries} attempts`);
  }

  /**
   * Generate synthetic response for CLI compatibility
   */
  private generateSyntheticResponse<T>(strategy: any): T {
    this.logger.info('Generating synthetic response');
    
    if (strategy.responseGenerator) {
      return strategy.responseGenerator();
    }
    
    // Default synthetic response
    return {
      status: 'synthetic',
      data: strategy.defaultData || {},
      timestamp: new Date().toISOString()
    } as unknown as T;
  }

  /**
   * Execute Gemini CLI command
   */
  private async executeGeminiCLI<T>(strategy: any, context: AgentContext): Promise<T> {
    this.logger.info('Executing Gemini CLI command');
    
    try {
      // This would integrate with the actual Gemini CLI
      // For now, we simulate the execution
      const result = await this.codexClient.executeGeminiCommand(
        strategy.command,
        context
      );
      
      return result as unknown as T;
    } catch (error) {
      this.logger.error(`Gemini CLI execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Preserve context across agent transitions
   */
  private preserveContext(agentId: string, context: AgentContext): AgentContext {
    // Deep clone context to prevent mutation
    const preservedContext = JSON.parse(JSON.stringify(context));
    
    // Add metadata
    preservedContext.metadata = {
      ...preservedContext.metadata,
      fallbackFrom: context.metadata?.agentId,
      preservedAt: new Date().toISOString(),
      targetAgent: agentId
    };
    
    // Store context for potential recovery
    this.contextStore.set(`${agentId}-${Date.now()}`, preservedContext);
    
    // Emit event for monitoring
    this.emit('context-preserved', preservedContext);
    
    return preservedContext;
  }

  /**
   * Update execution metrics
   */
  private updateMetrics(agentId: string, data: any): void {
    const currentMetrics = this.metrics.get(agentId) || {
      executions: 0,
      successes: 0,
      failures: 0,
      fallbacks: 0,
      errors: []
    };

    currentMetrics.executions++;
    
    if (data.success) {
      currentMetrics.successes++;
    } else {
      currentMetrics.failures++;
      currentMetrics.errors.push({
        timestamp: new Date().toISOString(),
        message: data.error
      });
    }

    // Update fallback count if applicable
    if (data.isFallback) {
      currentMetrics.fallbacks++;
    }

    this.metrics.set(agentId, currentMetrics);
    
    // Emit metrics update event
    this.emit('metrics-update', { agentId, metrics: currentMetrics });
    
    // Send metrics to Codex MCP server
    this.sendMetricsToCodex(agentId, currentMetrics);
  }

  /**
   * Send metrics to Codex MCP server
   */
  private async sendMetricsToCodex(agentId: string, metrics: any): Promise<void> {
    try {
      await this.codexClient.sendMetrics({
        agentId,
        metrics,
        timestamp: new Date().toISOString()
      }, {
        sessionId: 'ccr-fallback',
        taskId: agentId,
        metadata: { type: 'metrics' },
        timestamp: Date.now(),
        agentId,
        requestId: this.generateRequestId()
      });
    } catch (error) {
      this.logger.error(`Failed to send metrics to Codex MCP: ${error.message}`);
    }
  }

  /**
   * Set up monitoring and event handling
   */
  private setupMonitoring(): void {
    // Periodically send metrics to Codex MCP
    setInterval(() => {
      this.metrics.forEach((metrics, agentId) => {
        this.sendMetricsToCodex(agentId, metrics);
      });
    }, 30000); // Every 30 seconds

    // Log circuit breaker state changes
    this.on('circuit-state-change', (agent, newState) => {
      this.logger.info(`Circuit breaker state change for ${agent}: ${newState}`);
    });

    // Log fallback triggers
    this.on('fallback-triggered', (context, fromAgent, toAgent) => {
      this.logger.info(`Fallback triggered from ${fromAgent} to ${toAgent}`, { context });
    });
  }

  /**
   * Helper method to simulate agent execution
   * In a real implementation, this would resolve the agent and execute it
   */
  private async executeAgent<T>(agentId: string, context: AgentContext): Promise<T> {
    // This is a placeholder - in reality, this would:
    // 1. Resolve the agent implementation
    // 2. Execute it with the provided context
    // 3. Return the result
    
    // For demonstration, we'll just return a mock result
    return Promise.resolve({ 
      agentId, 
      result: 'success',
      context
    } as unknown as T);
  }

  /**
   * Helper method for sleep/delay
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `ccr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current metrics for an agent
   */
  public getMetrics(agentId: string): any {
    return this.metrics.get(agentId) || {};
  }

  /**
   * Get all metrics
   */
  public getAllMetrics(): Map<string, any> {
    return new Map(this.metrics);
  }

  /**
   * Reset metrics for an agent
   */
  public resetMetrics(agentId: string): void {
    this.metrics.delete(agentId);
  }
}

export { CCRFallbackManager, CCRFallbackManagerEvents };