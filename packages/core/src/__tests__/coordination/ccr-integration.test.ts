/**
 * CCR Integration Tests
 * 
 * Tests for CCR Fallback Manager and Session Independence
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CCRFallbackManager } from '../src/coordination/ccr-fallback-manager.js';
import { SessionLimitDetector } from '../src/coordination/session-limit-detector.js';
import { ContextPreservation } from '../src/coordination/context-preservation.js';
import { SQLiteMemoryManager } from '../src/memory/manager.js';

// Mock dependencies
vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    on: vi.fn(),
    kill: vi.fn(),
    stdout: {
      on: vi.fn()
    }
  }))
}));

describe('CCR Session Independence', () => {
  let memory: SQLiteMemoryManager;
  let ccrManager: CCRFallbackManager;
  let detector: SessionLimitDetector;
  let preservation: ContextPreservation;

  beforeEach(async () => {
    // Initialize memory manager
    memory = new SQLiteMemoryManager();
    await memory.initialize();

    // Initialize CCR components
    ccrManager = new CCRFallbackManager(memory);
    detector = new SessionLimitDetector(memory);
    preservation = new ContextPreservation(memory);

    // Set up environment variables
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
  });

  afterEach(async () => {
    await detector.stopMonitoring();
    await ccrManager.shutdown();
    await memory.cleanup();
  });

  describe('CCRFallbackManager', () => {
    it('should initialize successfully', async () => {
      await expect(ccrManager.initialize()).resolves.not.toThrow();
    });

    it('should handle Claude Code limit gracefully', async () => {
      await ccrManager.initialize();
      
      const taskId = 'test-task-123';
      const handoff = await ccrManager.handleClaudeCodeLimit(taskId);
      
      expect(handoff).toBeDefined();
      expect(handoff.fromPlatform).toBe('claude_code');
      expect(handoff.success).toBe(true);
    });

    it('should preserve context during handoff', async () => {
      await ccrManager.initialize();
      
      // Create test memory blocks
      await memory.storeMemoryBlock({
        taskId: 'test-task',
        sessionId: 'test-session',
        blockType: 'architectural',
        label: 'Test Decision',
        content: 'This is a test architectural decision',
        metadata: {},
        importanceScore: 0.9
      });

      const handoff = await ccrManager.handleClaudeCodeLimit('test-task');
      
      expect(handoff.context.memoryBlocks).toHaveLength(1);
      expect(handoff.context.memoryBlocks[0].content).toBe('This is a test architectural decision');
    });
  });

  describe('SessionLimitDetector', () => {
    it('should start monitoring successfully', async () => {
      await expect(detector.startMonitoring()).resolves.not.toThrow();
      expect(detector.isMonitoringActive()).toBe(true);
    });

    it('should stop monitoring successfully', async () => {
      await detector.startMonitoring();
      await detector.stopMonitoring();
      expect(detector.isMonitoringActive()).toBe(false);
    });

    it('should calculate utilization correctly', () => {
      const utilization = detector.calculateUtilization(100000, 'claude_code');
      expect(utilization).toBe(0.5); // 100k / 200k max
    });

    it('should determine warning levels correctly', () => {
      const metrics = {
        sessionId: 'test-session',
        taskId: 'test-task',
        platform: 'claude_code',
        utilization: 0.75,
        contextSize: 150000,
        maxContextSize: 200000,
        tokensUsed: 0,
        estimatedTokensRemaining: 200000,
        lastActivity: new Date(),
        warningLevel: 'warning' as const
      };

      expect(detector.isSessionApproachingLimit('test-session')).toBe(false);
    });
  });

  describe('ContextPreservation', () => {
    it('should preserve context for CCR handoff', async () => {
      // Create test data
      await memory.storeMemoryBlock({
        taskId: 'test-task',
        sessionId: 'test-session',
        blockType: 'architectural',
        label: 'Test Decision',
        content: 'Important architectural decision',
        metadata: {},
        importanceScore: 0.9
      });

      const preservedContext = await preservation.preserveForCCRHandoff(
        'test-task',
        'test-session',
        'claude_code'
      );

      expect(preservedContext).toBeDefined();
      expect(preservedContext.taskId).toBe('test-task');
      expect(preservedContext.platform).toBe('claude_code');
      expect(preservedContext.memoryBlocks).toHaveLength(1);
    });

    it('should create context snapshots', async () => {
      const snapshot = await preservation.createSnapshot(
        'test-task',
        'test-session',
        'claude_code',
        'test'
      );

      expect(snapshot).toBeDefined();
      expect(snapshot.taskId).toBe('test-task');
      expect(snapshot.platform).toBe('claude_code');
      expect(snapshot.metadata.totalBlocks).toBeGreaterThanOrEqual(0);
    });

    it('should apply compression when context is too large', async () => {
      // Create large context
      const largeBlocks = Array.from({ length: 100 }, (_, i) => ({
        taskId: 'test-task',
        sessionId: 'test-session',
        blockType: 'architectural' as const,
        label: `Block ${i}`,
        content: 'x'.repeat(1000), // 1k chars each
        metadata: {},
        importanceScore: i < 10 ? 0.9 : 0.3 // First 10 are important
      }));

      for (const block of largeBlocks) {
        await memory.storeMemoryBlock(block);
      }

      const preservedContext = await preservation.preserveForCCRHandoff(
        'test-task',
        'test-session',
        'claude_code'
      );

      // Should have compression applied
      expect(preservedContext.compressionRatio).toBeLessThan(1);
      expect(preservedContext.memoryBlocks.length).toBeLessThan(100);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete CCR workflow', async () => {
      // Initialize all components
      await ccrManager.initialize();
      await detector.startMonitoring();

      // Create test session data
      await memory.storeMemoryBlock({
        taskId: 'integration-test',
        sessionId: 'integration-session',
        blockType: 'architectural',
        label: 'Integration Test Decision',
        content: 'This is an integration test decision',
        metadata: {},
        importanceScore: 0.95
      });

      // Simulate session limit reached
      const handoff = await ccrManager.handleClaudeCodeLimit('integration-test');

      // Verify handoff was successful
      expect(handoff.success).toBe(true);
      expect(handoff.context.memoryBlocks).toHaveLength(1);
      expect(handoff.context.memoryBlocks[0].content).toBe('This is an integration test decision');

      // Clean up
      await detector.stopMonitoring();
    });

    it('should handle multiple platform fallbacks', async () => {
      await ccrManager.initialize();

      // Test fallback chain
      const platforms = ['claude_code', 'codex', 'synthetic', 'gemini'];
      
      for (let i = 0; i < platforms.length - 1; i++) {
        const currentPlatform = platforms[i];
        const handoff = await ccrManager.handleClaudeCodeLimit('fallback-test');
        
        expect(handoff.fromPlatform).toBe(currentPlatform);
        expect(handoff.success).toBe(true);
      }
    });
  });
});
