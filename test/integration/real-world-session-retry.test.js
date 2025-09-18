const { SmartSessionRetry } = require('../../src/core/smart-session-retry');
const { mockAPIFactory, generateTestData } = require('../utils/test-helpers');

describe('Real-World Smart Session Retry', () => {
  let sessionRetry;
  let mockAPI;
  
  beforeEach(() => {
    mockAPI = mockAPIFactory();
    sessionRetry = new SmartSessionRetry({
      maxRetries: 3,
      timeout: 5000,
      fallbackPlatforms: ['platform-a', 'platform-b', 'platform-c']
    });
  });

  describe('Cross-Platform Session Recovery', () => {
    test('recovers session after platform failure', async () => {
      const testData = generateTestData({
        sessionId: 'test-session-123',
        platform: 'platform-a'
      });
      
      mockAPI.onPost('/api/session').replyOnce(500)
        .onPost('/api/session').reply(200, testData);
      
      const result = await sessionRetry.executeWithRetry(
        () => mockAPI.post('/api/session', testData),
        { sessionId: testData.sessionId }
      );
      
      expect(result.sessionId).toBe(testData.sessionId);
      expect(result.platform).toBe('platform-b'); // Should fallback
    });

    test('persists session state across retries', async () => {
      const sessionData = generateTestData({
        sessionId: 'persistent-session',
        state: { step: 3, progress: 75 }
      });
      
      mockAPI.onPut('/api/session/persist').reply(200, { success: true });
      
      const persisted = await sessionRetry.persistSession(sessionData);
      expect(persisted.success).toBe(true);
      
      // Simulate recovery
      mockAPI.onGet('/api/session/persistent-session').reply(200, sessionData);
      const recovered = await sessionRetry.recoverSession('persistent-session');
      
      expect(recovered.state.step).toBe(3);
      expect(recovered.state.progress).toBe(75);
    });
  });

  describe('Failure Mode Handling', () => {
    test('handles timeout scenarios gracefully', async () => {
      mockAPI.onPost('/api/slow-endpoint').timeoutOnce()
        .onPost('/api/slow-endpoint').reply(200, { success: true });
      
      const result = await sessionRetry.executeWithRetry(
        () => mockAPI.post('/api/slow-endpoint'),
        {},
        { timeout: 1000 }
      );
      
      expect(result.success).toBe(true);
    });

    test('implements exponential backoff', async () => {
      const start = Date.now();
      mockAPI.onPost('/api/unstable').reply(500);
      
      try {
        await sessionRetry.executeWithRetry(
          () => mockAPI.post('/api/unstable'),
          {},
          { maxRetries: 3 }
        );
      } catch (error) {
        // Expected failure
      }
      
      const duration = Date.now() - start;
      // Should take longer than immediate retries due to backoff
      expect(duration).toBeGreaterThan(1000);
    });
  });
});