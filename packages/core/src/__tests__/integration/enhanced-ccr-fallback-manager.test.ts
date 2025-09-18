import { CCRFallbackManager } from '../../coordination/enhanced-ccr-fallback-manager';
import { CircuitBreaker, CircuitBreakerState } from '../../coordination/circuit-breaker';
import { CodexMCPClient } from '../../coordination/codex-mcp-client';
import { AgentContext, FallbackStrategy, FallbackStrategyConfig } from '../../coordination/types';

// Mock dependencies
jest.mock('../../coordination/circuit-breaker');
jest.mock('../../coordination/codex-mcp-client');
jest.mock('winston', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  })
}));

describe('Enhanced CCR Fallback Manager Integration Tests', () => {
  let fallbackManager: CCRFallbackManager;
  let mockCircuitBreaker: jest.Mocked<CircuitBreaker>;
  let mockCodexClient: jest.Mocked<CodexMCPClient>;
  let mockLogger: any;

  const createMockContext = (overrides: Partial<AgentContext> = {}): AgentContext => ({
    sessionId: 'test-session-123',
    taskId: 'task-456',
    metadata: { test: true },
    timestamp: Date.now(),
    agentId: 'primary-agent',
    requestId: 'req-789',
    ...overrides
  });

  const createMockExecutionFn = (shouldFail = false, data: any = {}) => {
    return jest.fn().mockImplementation(() => {
      if (shouldFail) {
        return Promise.reject(new Error('Execution failed'));
      }
      return Promise.resolve(data);
    });
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };

    // Setup mock circuit breaker
    mockCircuitBreaker = {
      canExecute: jest.fn().mockReturnValue(true),
      onSuccess: jest.fn(),
      onFailure: jest.fn(),
      getState: jest.fn().mockReturnValue(CircuitBreakerState.CLOSED),
      on: jest.fn(),
      getMetrics: jest.fn().mockReturnValue({
        state: CircuitBreakerState.CLOSED,
        failureCount: 0,
        successCount: 0
      })
    } as any;

    // Setup mock Codex client
    mockCodexClient = {
      executeGeminiCommand: jest.fn().mockResolvedValue({ success: true }),
      sendMetrics: jest.fn().mockResolvedValue({ success: true })
    } as any;

    // Create fallback manager with mocks
    fallbackManager = new CCRFallbackManager({
      codexClient: mockCodexClient,
      logger: mockLogger
    });

    // Register circuit breaker
    fallbackManager.registerCircuitBreaker('primary-agent', mockCircuitBreaker);
  });

  describe('Context Preservation During Agent Switches', () => {
    it('should preserve conversation context when switching agents', async () => {
      const context = createMockContext({
        agentId: 'primary-agent'
      });

      const mockExecutionFn = createMockExecutionFn(true);

      // Configure fallback chain
      fallbackManager.configureFallbackChain('primary-agent', {
        strategies: [
          {
            type: FallbackStrategy.SWITCH_AGENT,
            targetAgent: 'secondary-agent'
          }
        ],
        context,
        maxRetries: 3
      });

      const result = await fallbackManager.executeWithFallback(
        'primary-agent',
        context,
        mockExecutionFn
      );

      expect(result).toBeDefined();
      expect(mockExecutionFn).toHaveBeenCalledWith(context);
    });

    it('should maintain context metadata through fallback chain', async () => {
      const context = createMockContext({
        metadata: {
          originalRequest: 'test-request',
          userPreferences: { theme: 'dark' }
        }
      });

      const mockExecutionFn = createMockExecutionFn(true);

      fallbackManager.configureFallbackChain('primary-agent', {
        strategies: [
          {
            type: FallbackStrategy.SYNTHETIC_RESPONSE,
            defaultData: { fallback: true }
          }
        ],
        context,
        maxRetries: 3
      });

      const result = await fallbackManager.executeWithFallback(
        'primary-agent',
        context,
        mockExecutionFn
      );

      expect(result).toEqual({
        status: 'synthetic',
        data: { fallback: true },
        timestamp: expect.any(String)
      });
    });
  });

  describe('Circuit Breaker State Transitions', () => {
    it('should handle circuit breaker open state', async () => {
      const context = createMockContext();

      // Configure circuit breaker to be open
      mockCircuitBreaker.canExecute.mockReturnValue(false);
      mockCircuitBreaker.getState.mockReturnValue(CircuitBreakerState.OPEN);

      const mockExecutionFn = createMockExecutionFn(false, { success: true });

      fallbackManager.configureFallbackChain('primary-agent', {
        strategies: [
          {
            type: FallbackStrategy.SYNTHETIC_RESPONSE,
            defaultData: { circuitOpen: true }
          }
        ],
        context,
        maxRetries: 3
      });

      const result = await fallbackManager.executeWithFallback(
        'primary-agent',
        context,
        mockExecutionFn
      );

      expect(mockExecutionFn).not.toHaveBeenCalled();
      expect(result).toEqual({
        status: 'synthetic',
        data: { circuitOpen: true },
        timestamp: expect.any(String)
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker open for agent primary-agent')
      );
    });

    it('should record circuit breaker events', async () => {
      const context = createMockContext();

      // Simulate state change event
      const stateChangeCallback = jest.fn();
      mockCircuitBreaker.on.mockImplementation((event, callback) => {
        if (event === 'stateChange') {
          stateChangeCallback.mockImplementation(callback);
        }
      });

      // Register the circuit breaker (which sets up event listeners)
      fallbackManager.registerCircuitBreaker('test-agent', mockCircuitBreaker);

      // Simulate state change
      stateChangeCallback(CircuitBreakerState.CLOSED, CircuitBreakerState.OPEN);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker state change for test-agent: OPEN')
      );
    });
  });

  describe('Fallback Chain Execution', () => {
    it('should execute SWITCH_AGENT strategy successfully', async () => {
      const context = createMockContext();
      const mockExecutionFn = createMockExecutionFn(true);

      fallbackManager.configureFallbackChain('primary-agent', {
        strategies: [
          {
            type: FallbackStrategy.SWITCH_AGENT,
            targetAgent: 'secondary-agent'
          }
        ],
        context,
        maxRetries: 3
      });

      const result = await fallbackManager.executeWithFallback(
        'primary-agent',
        context,
        mockExecutionFn
      );

      expect(result).toBeDefined();
      expect(mockCircuitBreaker.onFailure).toHaveBeenCalled();
    });

    it('should execute SYNTHETIC_RESPONSE strategy', async () => {
      const context = createMockContext();
      const mockExecutionFn = createMockExecutionFn(true);

      fallbackManager.configureFallbackChain('primary-agent', {
        strategies: [
          {
            type: FallbackStrategy.SYNTHETIC_RESPONSE,
            defaultData: { syntheticResponse: true, message: 'Generated response' }
          }
        ],
        context,
        maxRetries: 3
      });

      const result = await fallbackManager.executeWithFallback(
        'primary-agent',
        context,
        mockExecutionFn
      );

      expect(result).toEqual({
        status: 'synthetic',
        data: { syntheticResponse: true, message: 'Generated response' },
        timestamp: expect.any(String)
      });
    });

    it('should execute GEMINI_CLI strategy', async () => {
      const context = createMockContext();
      const mockExecutionFn = createMockExecutionFn(true);

      fallbackManager.configureFallbackChain('primary-agent', {
        strategies: [
          {
            type: FallbackStrategy.GEMINI_CLI,
            command: 'gemini --query "test command"'
          }
        ],
        context,
        maxRetries: 3
      });

      const result = await fallbackManager.executeWithFallback(
        'primary-agent',
        context,
        mockExecutionFn
      );

      expect(mockCodexClient.executeGeminiCommand).toHaveBeenCalledWith(
        'gemini --query "test command"',
        context
      );
      expect(result).toEqual({ success: true });
    });

    it('should handle all fallbacks failing', async () => {
      const context = createMockContext();
      const mockExecutionFn = createMockExecutionFn(true);

      // Configure Gemini CLI to fail
      mockCodexClient.executeGeminiCommand.mockRejectedValue(new Error('Gemini failed'));

      fallbackManager.configureFallbackChain('primary-agent', {
        strategies: [
          {
            type: FallbackStrategy.GEMINI_CLI,
            command: 'gemini --query "test"'
          }
        ],
        context,
        maxRetries: 3
      });

      await expect(
        fallbackManager.executeWithFallback('primary-agent', context, mockExecutionFn)
      ).rejects.toThrow('All fallbacks exhausted for agent primary-agent');
    });
  });

  describe('Metrics Collection and Integration', () => {
    it('should collect success metrics', async () => {
      const context = createMockContext();
      const mockExecutionFn = createMockExecutionFn(false, { success: true });

      const result = await fallbackManager.executeWithFallback(
        'primary-agent',
        context,
        mockExecutionFn
      );

      expect(result).toEqual({ success: true });
      expect(mockCircuitBreaker.onSuccess).toHaveBeenCalled();
      expect(mockCodexClient.sendMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'primary-agent',
          metrics: expect.any(Object),
          timestamp: expect.any(String)
        }),
        expect.objectContaining({
          sessionId: 'ccr-fallback',
          taskId: 'primary-agent',
          metadata: { type: 'metrics' },
          timestamp: expect.any(Number),
          agentId: 'primary-agent',
          requestId: expect.stringMatching(/^ccr-/)
        })
      );
    });

    it('should collect failure metrics', async () => {
      const context = createMockContext();
      const mockExecutionFn = createMockExecutionFn(true);

      fallbackManager.configureFallbackChain('primary-agent', {
        strategies: [
          {
            type: FallbackStrategy.SYNTHETIC_RESPONSE,
            defaultData: { fallback: true }
          }
        ],
        context,
        maxRetries: 3
      });

      await fallbackManager.executeWithFallback(
        'primary-agent',
        context,
        mockExecutionFn
      );

      expect(mockCircuitBreaker.onFailure).toHaveBeenCalled();
    });

    it('should track metrics for multiple agents', async () => {
      const context1 = createMockContext({ agentId: 'agent-1' });
      const context2 = createMockContext({ agentId: 'agent-2' });

      const mockExecution1 = createMockExecutionFn(false, { agent: 1 });
      const mockExecution2 = createMockExecutionFn(false, { agent: 2 });

      await fallbackManager.executeWithFallback('agent-1', context1, mockExecution1);
      await fallbackManager.executeWithFallback('agent-2', context2, mockExecution2);

      const metrics1 = fallbackManager.getMetrics('agent-1');
      const metrics2 = fallbackManager.getMetrics('agent-2');

      expect(metrics1.executions).toBe(1);
      expect(metrics1.successes).toBe(1);
      expect(metrics2.executions).toBe(1);
      expect(metrics2.successes).toBe(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle no fallback chain configured', async () => {
      const context = createMockContext();
      const mockExecutionFn = createMockExecutionFn(true);

      await expect(
        fallbackManager.executeWithFallback('unconfigured-agent', context, mockExecutionFn)
      ).rejects.toThrow('No fallback available for agent unconfigured-agent');
    });

    it('should handle Codex MCP client failures gracefully', async () => {
      const context = createMockContext();
      const mockExecutionFn = createMockExecutionFn(false, { success: true });

      // Configure Codex client to fail
      mockCodexClient.sendMetrics.mockRejectedValue(new Error('MCP connection failed'));

      // Should still succeed despite metrics failure
      const result = await fallbackManager.executeWithFallback(
        'primary-agent',
        context,
        mockExecutionFn
      );

      expect(result).toEqual({ success: true });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send metrics to Codex MCP')
      );
    });

    it('should handle malformed strategy configuration', async () => {
      const context = createMockContext();
      const mockExecutionFn = createMockExecutionFn(true);

      fallbackManager.configureFallbackChain('primary-agent', {
        strategies: [
          {
            type: 'INVALID_STRATEGY' as any
          }
        ],
        context,
        maxRetries: 3
      });

      await expect(
        fallbackManager.executeWithFallback('primary-agent', context, mockExecutionFn)
      ).rejects.toThrow('Unknown fallback strategy: INVALID_STRATEGY');
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent executions', async () => {
      const contexts = Array.from({ length: 5 }, (_, i) =>
        createMockContext({ agentId: `agent-${i}`, requestId: `req-${i}` })
      );

      const executions = contexts.map(context => {
        const mockExecution = createMockExecutionFn(false, { id: context.agentId });
        return fallbackManager.executeWithFallback(context.agentId, context, mockExecution);
      });

      const results = await Promise.all(executions);

      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result).toEqual({ id: `agent-${index}` });
      });
    });

    it('should complete fallback execution within reasonable time', async () => {
      const context = createMockContext();
      const startTime = Date.now();

      const mockExecutionFn = createMockExecutionFn(true);

      fallbackManager.configureFallbackChain('primary-agent', {
        strategies: [
          {
            type: FallbackStrategy.SYNTHETIC_RESPONSE,
            defaultData: { fast: true }
          }
        ],
        context,
        maxRetries: 3
      });

      const result = await fallbackManager.executeWithFallback(
        'primary-agent',
        context,
        mockExecutionFn
      );

      const executionTime = Date.now() - startTime;

      expect(result.data.fast).toBe(true);
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});