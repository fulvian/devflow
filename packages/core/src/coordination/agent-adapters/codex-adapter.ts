// src/adapters/codex-mcp-adapter.ts
import { Agent, AgentResponse, AgentRequest, Context } from '../types/agent';
import { Logger } from '../utils/logger';
import { PerformanceMonitor } from '../utils/performance-monitor';

/**
 * Configuration interface for Codex MCP adapter
 */
export interface CodexMcpConfig {
  serverUrl: string;
  timeout?: number;
  retries?: number;
  healthCheckInterval?: number;
}

/**
 * Codex MCP server adapter for fallback chain integration
 */
export class CodexMcpAdapter implements Agent {
  private readonly config: CodexMcpConfig;
  private readonly logger: Logger;
  private readonly performanceMonitor: PerformanceMonitor;
  private isHealthy: boolean = true;
  private healthCheckIntervalId?: NodeJS.Timeout;

  constructor(config: CodexMcpConfig) {
    this.config = {
      timeout: 5000,
      retries: 3,
      healthCheckInterval: 30000,
      ...config
    };
    
    this.logger = new Logger('CodexMcpAdapter');
    this.performanceMonitor = new PerformanceMonitor('CodexMcpAdapter');
    
    // Start health check monitoring
    this.startHealthCheck();
  }

  /**
   * Execute a request through the Codex MCP server
   * @param request The agent request
   * @returns Promise resolving to agent response
   */
  async execute(request: AgentRequest): Promise<AgentResponse> {
    const startTime = this.performanceMonitor.startMeasurement();
    
    try {
      this.logger.debug('Executing request', { requestId: request.id });
      
      // Inject context into request
      const enrichedRequest = this.injectContext(request);
      
      // Transform request to Codex MCP format
      const mcpRequest = this.transformRequest(enrichedRequest);
      
      // Execute with retry logic
      const mcpResponse = await this.executeWithRetry(mcpRequest);
      
      // Transform response back to standard format
      const response = this.transformResponse(mcpResponse, request.id);
      
      this.performanceMonitor.endMeasurement(startTime, 'execute');
      this.logger.debug('Request executed successfully', { requestId: request.id });
      
      return response;
    } catch (error) {
      this.performanceMonitor.endMeasurement(startTime, 'execute', true);
      this.logger.error('Request execution failed', {
        requestId: request.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw this.handleExecutionError(error, request);
    }
  }

  /**
   * Health check implementation
   * @returns Promise resolving to health status
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
      
      const response = await fetch(`${this.config.serverUrl}/health`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      this.isHealthy = response.ok;
      return this.isHealthy;
    } catch (error) {
      this.logger.warn('Health check failed', { error });
      this.isHealthy = false;
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.healthCheckIntervalId) {
      clearInterval(this.healthCheckIntervalId);
    }
    
    this.performanceMonitor.destroy();
    this.logger.info('Adapter destroyed');
  }

  /**
   * Inject context into the request
   * @param request Original request
   * @returns Request with injected context
   */
  private injectContext(request: AgentRequest): AgentRequest {
    // Extract and inject relevant context
    const context: Context = {
      timestamp: new Date().toISOString(),
      userAgent: 'CodexMcpAdapter/1.0',
      traceId: request.id,
      ...request.context
    };
    
    return {
      ...request,
      context
    };
  }

  /**
   * Transform standard request to Codex MCP format
   * @param request Standard agent request
   * @returns Codex MCP formatted request
   */
  private transformRequest(request: AgentRequest): any {
    return {
      id: request.id,
      method: request.method,
      params: request.params,
      context: request.context,
      metadata: {
        timestamp: request.context?.timestamp,
        userAgent: request.context?.userAgent
      }
    };
  }

  /**
   * Transform Codex MCP response to standard format
   * @param mcpResponse Codex MCP response
   * @param requestId Original request ID
   * @returns Standard agent response
   */
  private transformResponse(mcpResponse: any, requestId: string): AgentResponse {
    return {
      id: requestId,
      result: mcpResponse.result,
      error: mcpResponse.error ? {
        code: mcpResponse.error.code,
        message: mcpResponse.error.message,
        data: mcpResponse.error.data
      } : undefined,
      context: {
        responseTime: mcpResponse.metadata?.responseTime,
        server: mcpResponse.metadata?.server
      }
    };
  }

  /**
   * Execute request with retry logic
   * @param request Codex MCP formatted request
   * @returns Promise resolving to response
   */
  private async executeWithRetry(request: any): Promise<any> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.config.retries!; attempt++) {
      try {
        this.logger.debug(`Attempt ${attempt}/${this.config.retries}`, { requestId: request.id });
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
        
        const response = await fetch(this.config.serverUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(request),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`Attempt ${attempt} failed`, {
          requestId: request.id,
          error: lastError.message
        });
        
        // Don't wait after the last attempt
        if (attempt < this.config.retries!) {
          // Exponential backoff: 100ms, 200ms, 400ms, ...
          await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
        }
      }
    }
    
    throw lastError || new Error('Execution failed after retries');
  }

  /**
   * Handle execution errors with appropriate recovery
   * @param error Original error
   * @param request Request that caused the error
   * @returns Transformed error
   */
  private handleExecutionError(error: unknown, request: AgentRequest): Error {
    // Mark as unhealthy if it's a connection error
    if (error instanceof Error && 
        (error.name === 'AbortError' || 
         error.message.includes('fetch') || 
         error.message.includes('network'))) {
      this.isHealthy = false;
    }
    
    // Transform to standard error format
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Error(`CodexMcpAdapter execution failed: ${errorMessage}`);
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    this.healthCheckIntervalId = setInterval(async () => {
      try {
        await this.healthCheck();
        this.logger.debug('Health check completed', { isHealthy: this.isHealthy });
      } catch (error) {
        this.logger.error('Health check error', { error });
      }
    }, this.config.healthCheckInterval);
  }
}