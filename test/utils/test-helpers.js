// Mock factory using axios-mock-adapter
const MockAdapter = require('axios-mock-adapter');
const axios = require('axios');

// Performance measurement utility
function performanceTimer() {
  const start = process.hrtime.bigint();
  
  return {
    stop() {
      const end = process.hrtime.bigint();
      return Number(end - start) / 1000000; // Convert to milliseconds
    }
  };
}

// Mock API factory
function mockAPIFactory() {
  const instance = axios.create();
  const mock = new MockAdapter(instance);
  return mock;
}

// Test data generators
function generateTestData(overrides = {}) {
  const defaults = {
    sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    userId: `user-${Math.floor(Math.random() * 10000)}`,
    platform: ['codex', 'gemini', 'qwen'][Math.floor(Math.random() * 3)],
    content: `Test content generated at ${new Date().toISOString()}`,
    metadata: {
      version: '1.0.0',
      test: true
    }
  };
  
  return { ...defaults, ...overrides };
}

// Database test fixtures
function createDatabaseFixture() {
  const sessions = new Map();
  const contexts = new Map();
  
  return {
    async saveSession(sessionId, data) {
      sessions.set(sessionId, { ...data, updatedAt: Date.now() });
      return { success: true };
    },
    
    async getSession(sessionId) {
      return sessions.get(sessionId) || null;
    },
    
    async saveContext(sessionId, context) {
      contexts.set(sessionId, context);
      return { success: true };
    },
    
    async getContext(sessionId) {
      return contexts.get(sessionId) || null;
    },
    
    async clear() {
      sessions.clear();
      contexts.clear();
    }
  };
}

// Redis test fixtures
function createRedisFixture() {
  const store = new Map();
  
  return {
    async set(key, value, expiry = 3600) {
      store.set(key, {
        value: JSON.stringify(value),
        expiry: Date.now() + (expiry * 1000)
      });
      return 'OK';
    },
    
    async get(key) {
      const item = store.get(key);
      if (!item) return null;
      
      if (Date.now() > item.expiry) {
        store.delete(key);
        return null;
      }
      
      return JSON.parse(item.value);
    },
    
    async del(key) {
      store.delete(key);
      return 1;
    },
    
    async flushall() {
      store.clear();
      return 'OK';
    }
  };
}

// Common assertion helpers
const assertHelpers = {
  async expectError(asyncFn, expectedErrorType) {
    try {
      await asyncFn();
      throw new Error('Expected function to throw');
    } catch (error) {
      if (expectedErrorType) {
        expect(error.constructor.name).toBe(expectedErrorType);
      }
      return error;
    }
  },
  
  expectWithinRange(value, min, max) {
    expect(value).toBeGreaterThanOrEqual(min);
    expect(value).toBeLessThanOrEqual(max);
  },
  
  expectArrayToContain(arr, expectedElements) {
    expectedElements.forEach(element => {
      expect(arr).toContainEqual(element);
    });
  }
};

module.exports = {
  performanceTimer,
  mockAPIFactory,
  generateTestData,
  createDatabaseFixture,
  createRedisFixture,
  assertHelpers
};