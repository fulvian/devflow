/**
 * CODEX-4A: End-to-End Integration Test
 * Complete Claude Code → OpenRouter handoff workflow validation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MultiPlatformCoordinator } from '@devflow/core';
import { ClaudeAdapter } from '@devflow/claude-adapter';
import { OpenRouterGateway } from '@devflow/openrouter';
import type { 
  TaskContext, 
  MemoryBlock, 
  HandoffResult, 
  PerformanceMetrics 
} from '../../../packages/shared/src/types.js';

describe('Claude Code → OpenRouter End-to-End Integration', () => {
  let devFlow: MultiPlatformCoordinator;
  let claudeAdapter: ClaudeAdapter;
  let openRouterGateway: OpenRouterGateway;
  let testStartTime: number;

  beforeAll(async () => {
    // Initialize DevFlow system with test configuration
    devFlow = new DevFlowCore({
      dbPath: ':memory:', // In-memory SQLite for testing
      logLevel: 'debug'
    });
    
    claudeAdapter = new ClaudeAdapter({
      hookPath: '.claude/hooks',
      sessionPath: '.claude/sessions'
    });
    
    openRouterGateway = new OpenRouterGateway({
      apiKey: process.env.OPEN_ROUTER_API_KEY!,
      maxRetries: 3,
      timeout: 30000
    });

    await devFlow.initialize();
    await claudeAdapter.initialize();
    await openRouterGateway.initialize();
  });

  afterAll(async () => {
    await devFlow.cleanup();
    await claudeAdapter.cleanup();
    await openRouterGateway.cleanup();
  });

  beforeEach(() => {
    testStartTime = Date.now();
  });

  describe('Complete Workflow Integration', () => {
    it('should execute full Claude Code → Context Save → OpenRouter handoff', async () => {
      // Step 1: Simulate Claude Code session start
      const sessionId = 'test-session-' + Date.now();
      const taskContext: TaskContext = {
        id: 'task-end-to-end-test',
        title: 'End-to-End Integration Test',
        priority: 'h-',
        status: 'in_progress',
        architecturalContext: {
          decisions: ['Use TypeScript strict mode', 'Implement memory persistence'],
          constraints: ['Node.js 20+', 'pnpm workspaces'],
          patterns: ['Repository pattern', 'Dependency injection']
        },
        implementationContext: {
          codebase: '/Users/fulvioventura/devflow',
          frameworks: ['Node.js', 'TypeScript', 'Vitest'],
          dependencies: ['better-sqlite3', 'fastify', 'zod']
        }
      };

      // Step 2: Claude Adapter extracts and saves context
      const contextExtractionStart = Date.now();
      const memoryBlocks = await claudeAdapter.extractContext(sessionId, taskContext);
      const contextExtractionTime = Date.now() - contextExtractionStart;
      
      expect(memoryBlocks).toHaveLength.greaterThan(0);
      expect(contextExtractionTime).toBeLessThan(100); // <100ms requirement

      // Step 3: Memory system stores context
      const memoryStoreStart = Date.now();
      const storedBlocks: MemoryBlock[] = [];
      for (const block of memoryBlocks) {
        const stored = await devFlow.memory.store(block);
        storedBlocks.push(stored);
      }
      const memoryStoreTime = Date.now() - memoryStoreStart;
      
      expect(storedBlocks).toHaveLength(memoryBlocks.length);
      expect(memoryStoreTime).toBeLessThan(50); // <50ms requirement

      // Step 4: Context retrieval for OpenRouter handoff
      const contextRetrievalStart = Date.now();
      const retrievedContext = await devFlow.memory.retrieveTaskContext(taskContext.id);
      const contextRetrievalTime = Date.now() - contextRetrievalStart;
      
      expect(retrievedContext).toBeDefined();
      expect(retrievedContext.architecturalContext).toEqual(taskContext.architecturalContext);
      expect(contextRetrievalTime).toBeLessThan(50); // <50ms requirement

      // Step 5: OpenRouter handoff with context injection
      const handoffStart = Date.now();
      const prompt = `Based on the architectural context: ${JSON.stringify(retrievedContext.architecturalContext)}, implement a simple utility function.`;
      
      const handoffResult: HandoffResult = await openRouterGateway.executeTask({
        prompt,
        model: 'gpt-4o-mini', // Cost-effective model for testing
        context: retrievedContext,
        maxTokens: 500
      });
      const handoffTime = Date.now() - handoffStart;
      
      expect(handoffResult.success).toBe(true);
      expect(handoffResult.response).toBeDefined();
      expect(handoffResult.tokensUsed).toBeGreaterThan(0);
      expect(handoffResult.cost).toBeGreaterThan(0);
      expect(handoffTime).toBeLessThan(2000); // <2s requirement

      // Step 6: Validate total workflow time
      const totalWorkflowTime = Date.now() - testStartTime;
      expect(totalWorkflowTime).toBeLessThan(3000); // <3s total handoff requirement

      // Step 7: Validate performance metrics
      const metrics: PerformanceMetrics = {
        contextExtractionTime,
        memoryStoreTime,
        contextRetrievalTime,
        handoffTime,
        totalWorkflowTime,
        tokensUsed: handoffResult.tokensUsed,
        cost: handoffResult.cost,
        successRate: 1.0
      };

      // Store metrics for analysis
      await devFlow.analytics.recordPerformanceMetrics(sessionId, metrics);
      
      console.log('End-to-End Performance Metrics:', metrics);
    });

    it('should handle context compaction during large sessions', async () => {
      const sessionId = 'large-session-' + Date.now();
      const largeContext: TaskContext = {
        id: 'task-large-context',
        title: 'Large Context Test',
        priority: 'm-',
        status: 'in_progress',
        architecturalContext: {
          decisions: Array(50).fill(0).map((_, i) => `Decision ${i}`),
          constraints: Array(30).fill(0).map((_, i) => `Constraint ${i}`),
          patterns: Array(20).fill(0).map((_, i) => `Pattern ${i}`)
        }
      };

      // Test context compaction threshold
      const compactionStart = Date.now();
      const compactedContext = await devFlow.memory.compactContext(largeContext);
      const compactionTime = Date.now() - compactionStart;

      expect(compactedContext).toBeDefined();
      expect(compactionTime).toBeLessThan(200); // Reasonable compaction time
      
      // Verify important information preserved
      expect(compactedContext.architecturalContext.decisions.length).toBeGreaterThan(0);
      expect(compactedContext.architecturalContext.decisions.length).toBeLessThanOrEqual(largeContext.architecturalContext.decisions.length);
    });

    it('should demonstrate token reduction through context optimization', async () => {
      const baselinePrompt = `
        Implement a TypeScript function that processes user data.
        Requirements: Type safety, error handling, validation.
        Use modern TypeScript patterns and best practices.
        Ensure compatibility with Node.js 20+.
        Follow clean code principles.
        Add comprehensive JSDoc documentation.
      `;

      const optimizedContext = await devFlow.memory.retrieveTaskContext('task-end-to-end-test');
      const optimizedPrompt = await devFlow.optimization.optimizePrompt(baselinePrompt, optimizedContext);

      // Calculate token estimates (simplified)
      const baselineTokens = Math.ceil(baselinePrompt.length / 4); // Rough estimate
      const optimizedTokens = Math.ceil(optimizedPrompt.length / 4);
      const tokenReduction = (baselineTokens - optimizedTokens) / baselineTokens;

      expect(tokenReduction).toBeGreaterThan(0.1); // At least 10% reduction
      console.log(`Token reduction: ${(tokenReduction * 100).toFixed(1)}%`);
      
      // Target: 30% reduction
      if (tokenReduction >= 0.3) {
        console.log('🎯 30% token reduction target ACHIEVED!');
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle OpenRouter API failures gracefully', async () => {
      const invalidGateway = new OpenRouterGateway({
        apiKey: 'invalid-key',
        maxRetries: 1,
        timeout: 1000
      });

      const result = await invalidGateway.executeTask({
        prompt: 'Test prompt',
        model: 'gpt-4o-mini',
        context: {} as TaskContext,
        maxTokens: 100
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.fallbackUsed).toBe(true);
    });

    it('should handle memory system failures with recovery', async () => {
      // Simulate database corruption
      const corruptedDevFlow = new DevFlowCore({
        dbPath: '/invalid/path/test.db',
        logLevel: 'error'
      });

      try {
        await corruptedDevFlow.initialize();
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
        
        // Test recovery mechanism
        const recoveredDevFlow = new DevFlowCore({
          dbPath: ':memory:',
          logLevel: 'error',
          recoveryMode: true
        });
        
        await expect(recoveredDevFlow.initialize()).resolves.not.toThrow();
      }
    });
  });

  describe('Performance Benchmarking', () => {
    it('should maintain performance under load', async () => {
      const concurrentSessions = 10;
      const promises = Array(concurrentSessions).fill(0).map(async (_, i) => {
        const sessionId = `load-test-${i}-${Date.now()}`;
        const start = Date.now();
        
        const context: TaskContext = {
          id: `task-load-${i}`,
          title: `Load Test Task ${i}`,
          priority: 'l-',
          status: 'in_progress'
        };
        
        const blocks = await claudeAdapter.extractContext(sessionId, context);
        await Promise.all(blocks.map(block => devFlow.memory.store(block)));
        
        return Date.now() - start;
      });

      const results = await Promise.all(promises);
      const avgTime = results.reduce((a, b) => a + b, 0) / results.length;
      const maxTime = Math.max(...results);

      expect(avgTime).toBeLessThan(200); // Average under 200ms
      expect(maxTime).toBeLessThan(500); // Max under 500ms
      
      console.log(`Load test - Avg: ${avgTime}ms, Max: ${maxTime}ms`);
    });
  });
});