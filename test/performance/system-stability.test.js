const { performanceTimer, generateTestData } = require('../utils/test-helpers');
const { DreamTeamOrchestrator } = require('../../src/orchestration/dream-team-orchestrator');
const { CCRContextBridge } = require('../../src/context/ccr-context-bridge');
const { SmartSessionRetry } = require('../../src/core/smart-session-retry');

describe('System Performance and Stability', () => {
  let orchestrator;
  let contextBridge;
  let sessionRetry;
  
  beforeAll(() => {
    orchestrator = new DreamTeamOrchestrator({
      platforms: [
        { name: 'codex', endpoint: '/api/codex' },
        { name: 'gemini', endpoint: '/api/gemini' }
      ]
    });
    
    contextBridge = new CCRContextBridge({
      maxTokens: 4000
    });
    
    sessionRetry = new SmartSessionRetry({
      maxRetries: 3
    });
  });

  describe('Load Testing', () => {
    test('handles concurrent requests without degradation', async () => {
      const concurrency = 20;
      const requests = [];
      
      const timer = performanceTimer();
      
      for (let i = 0; i < concurrency; i++) {
        const request = orchestrator.routeRequest({
          query: `concurrent request ${i}`
        });
        requests.push(request);
      }
      
      const results = await Promise.all(requests);
      const duration = timer.stop();
      
      expect(results).toHaveLength(concurrency);
      // Should handle 20 concurrent requests within reasonable time
      expect(duration).toBeLessThan(5000);
      
      // All requests should succeed
      results.forEach(result => {
        expect(result).toHaveProperty('result');
      });
    });

    test('maintains performance under sustained load', async () => {
      const sustainedLoad = 100;
      const results = [];
      
      for (let i = 0; i < sustainedLoad; i++) {
        const timer = performanceTimer();
        const result = await orchestrator.routeRequest({
          query: `sustained ${i}`
        });
        const duration = timer.stop();
        
        results.push({ result, duration });
        
        // Small delay to simulate real usage
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      
      // Average response time should remain stable
      expect(avgDuration).toBeLessThan(500);
      
      // Success rate should be high
      const successRate = results.filter(r => r.result).length / results.length;
      expect(successRate).toBeGreaterThan(0.95);
    });
  });

  describe('Memory Leak Detection', () => {
    test('does not leak memory during repeated operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        const sessionId = `session-${i}`;
        const testData = generateTestData({ sessionId });
        
        await contextBridge.updateContext(sessionId, {
          role: 'user',
          content: `Test message ${i}`
        });
        
        if (i % 100 === 0) {
          // Periodic cleanup
          await contextBridge.cleanupOldSessions();
        }
      }
      
      const finalMemory = process.memoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Should not grow excessively (less than 5MB)
      expect(memoryGrowth).toBeLessThan(5 * 1024 * 1024);
    });
  });

  describe('Resource Utilization', () => {
    test('manages CPU usage during intensive operations', async () => {
      const startTime = process.hrtime.bigint();
      
      // CPU intensive context operations
      for (let i = 0; i < 50; i++) {
        const sessionId = `cpu-test-${i}`;
        let context = null;
        
        for (let j = 0; j < 20; j++) {
          context = await contextBridge.updateContext(sessionId, {
            role: 'user',
            content: `CPU intensive message ${j} with lots of content to process`.repeat(10)
          }, context);
        }
      }
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // ms
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(10000);
    });
  });
});