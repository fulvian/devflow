const { CCRContextBridge } = require('../../src/context/ccr-context-bridge');
const { generateTestData, mockAPIFactory } = require('../utils/test-helpers');

describe('CCR Context Bridge Multi-Turn Testing', () => {
  let contextBridge;
  let mockAPI;
  
  beforeEach(() => {
    mockAPI = mockAPIFactory();
    contextBridge = new CCRContextBridge({
      maxTokens: 4000,
      compressionThreshold: 3000,
      relevanceThreshold: 0.3
    });
  });

  describe('Multi-Turn Conversation Persistence', () => {
    test('maintains context across conversation turns', async () => {
      const sessionId = 'conversation-123';
      const turns = [
        { role: 'user', content: 'What is the weather like?' },
        { role: 'assistant', content: 'It is sunny today with 25°C' },
        { role: 'user', content: 'Will it rain tomorrow?' }
      ];
      
      // Simulate conversation turns
      let context = null;
      for (const turn of turns) {
        context = await contextBridge.updateContext(sessionId, turn, context);
      }
      
      expect(context.turns.length).toBe(3);
      expect(context.sessionId).toBe(sessionId);
      
      // Verify context persistence
      const retrievedContext = await contextBridge.getContext(sessionId);
      expect(retrievedContext.turns.length).toBe(3);
    });

    test('compresses context when approaching token limits', async () => {
      const sessionId = 'long-conversation';
      let context = null;
      
      // Generate long conversation exceeding threshold
      for (let i = 0; i < 10; i++) {
        const turn = {
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `This is a long message number ${i} with lots of content to exceed token limits eventually`
        };
        context = await contextBridge.updateContext(sessionId, turn, context);
      }
      
      // Should trigger compression
      expect(context.compressionCount).toBeGreaterThan(0);
      expect(context.totalTokens).toBeLessThan(4000);
      
      // Verify important context is preserved
      const recentTurns = context.turns.slice(-3);
      expect(recentTurns.length).toBe(3);
    });
  });

  describe('Cross-Session Memory Bridging', () => {
    test('bridges relevant context between sessions', async () => {
      const session1Id = 'session-001';
      const session2Id = 'session-002';
      
      // Establish context in first session
      const context1 = await contextBridge.updateContext(
        session1Id, 
        { role: 'user', content: 'I am working on project X' }
      );
      
      await contextBridge.updateContext(
        session1Id, 
        { role: 'assistant', content: 'Project X involves machine learning' },
        context1
      );
      
      // Start new session with related query
      const bridgedContext = await contextBridge.bridgeContext(
        session2Id,
        'Tell me about machine learning projects',
        [session1Id]
      );
      
      expect(bridgedContext.relevanceScore).toBeGreaterThan(0.5);
      expect(bridgedContext.bridgedFrom).toContain(session1Id);
    });

    test('prunes low-relevance context during bridging', async () => {
      const sessionId = 'pruning-test';
      
      // Add high and low relevance content
      await contextBridge.updateContext(sessionId, {
        role: 'user',
        content: 'Important project details about deadlines'
      });
      
      await contextBridge.updateContext(sessionId, {
        role: 'assistant',
        content: 'The weather is nice today'
      });
      
      // Bridge with query focused on projects
      const bridged = await contextBridge.bridgeContext(
        'new-session',
        'What are our project deadlines?',
        [sessionId]
      );
      
      // Should filter out weather mention
      const hasWeather = bridged.turns.some(t => 
        t.content.includes('weather')
      );
      expect(hasWeather).toBe(false);
      
      // Should keep project details
      const hasDeadlines = bridged.turns.some(t => 
        t.content.includes('deadlines')
      );
      expect(hasDeadlines).toBe(true);
    });
  });
});