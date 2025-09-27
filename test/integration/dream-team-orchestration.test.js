const { DreamTeamOrchestrator } = require('../../src/orchestration/dream-team-orchestrator');
const { mockAPIFactory, performanceTimer } = require('../utils/test-helpers');

describe('Dream Team Multi-Platform Orchestration', () => {
  let orchestrator;
  let mockAPI;
  
  beforeEach(() => {
    mockAPI = mockAPIFactory();
    orchestrator = new DreamTeamOrchestrator({
      platforms: [
        { name: 'codex', endpoint: '/api/codex', weight: 0.4 },
        { name: 'gemini', endpoint: '/api/gemini', weight: 0.3 },
        { name: 'qwen', endpoint: '/api/qwen', weight: 0.3 }
      ],
      circuitBreaker: {
        failureThreshold: 5,
        timeout: 60000
      }
    });
  });

  describe('Intelligent Agent Selection', () => {
    test('routes requests based on platform performance', async () => {
      // Mock different response times
      mockAPI.onPost('/api/codex').delay(100).reply(200, { result: 'fast' });
      mockAPI.onPost('/api/gemini').delay(300).reply(200, { result: 'slow' });
      mockAPI.onPost('/api/qwen').delay(200).reply(200, { result: 'medium' });
      
      const timer = performanceTimer();
      const results = [];
      
      for (let i = 0; i < 6; i++) {
        const result = await orchestrator.routeRequest({
          query: `test query ${i}`
        });
        results.push(result.platform);
      }
      
      const duration = timer.stop();
      expect(duration).toBeLessThan(2000); // Should optimize for speed
      
      // Codex should be preferred due to faster responses
      const codexCount = results.filter(p => p === 'codex').length;
      expect(codexCount).toBeGreaterThan(2);
    });

    test('implements circuit breaker for failing platforms', async () => {
      // Fail codex repeatedly
      mockAPI.onPost('/api/codex').reply(500);
      
      // Succeed with others
      mockAPI.onPost('/api/gemini').reply(200, { result: 'gemini response' });
      mockAPI.onPost('/api/qwen').reply(200, { result: 'qwen response' });
      
      // Force circuit breaker to trip
      for (let i = 0; i < 6; i++) {
        try {
          await orchestrator.routeRequest({ query: `fail ${i}` });
        } catch (error) {
          // Expected
        }
      }
      
      // Next request should bypass codex
      mockAPI.onPost('/api/gemini').reply(200, { result: 'recovered' });
      const result = await orchestrator.routeRequest({ query: 'recovery' });
      
      expect(result.platform).not.toBe('codex');
      expect(result.result).toBe('recovered');
    });
  });

  describe('Rate Limiting and Resource Management', () => {
    test('respects platform rate limits', async () => {
      // Mock rate limiting response
      mockAPI.onPost('/api/rate-limited').reply(429, {
        error: 'Rate limit exceeded',
        retryAfter: 1000
      });
      
      mockAPI.onPost('/api/rate-limited').reply(200, { success: true });
      
      const timer = performanceTimer();
      const result = await orchestrator.routeRequest({
        query: 'rate test',
        endpoint: '/api/rate-limited'
      });
      const duration = timer.stop();
      
      expect(result.success).toBe(true);
      // Should wait before retry
      expect(duration).toBeGreaterThan(900);
    });
  });
});