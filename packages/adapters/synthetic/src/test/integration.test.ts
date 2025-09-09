import { describe, it, expect, beforeAll } from 'vitest';
import { SyntheticGateway } from '../gateway.js';

describe('Synthetic.new Integration', () => {
  let gateway: SyntheticGateway;

  beforeAll(() => {
    // Skip tests if no API key provided
    if (!process.env.SYNTHETIC_API_KEY) {
      console.log('Skipping Synthetic.new integration tests - no API key provided');
      return;
    }
    
    gateway = new SyntheticGateway({
      apiKey: process.env.SYNTHETIC_API_KEY,
      baseUrl: process.env.SYNTHETIC_BASE_URL || 'https://api.synthetic.new/v1',
      timeoutMs: 30000,
    });
  });

  it('should classify code implementation tasks correctly', { 
    skip: !process.env.SYNTHETIC_API_KEY 
  }, () => {
    const classification = gateway.classifyTask({
      title: 'Implement TypeScript API client',
      description: 'Create a new API client for the REST API with proper error handling',
      messages: [{ role: 'user', content: 'Please implement the client class' }]
    });

    expect(classification.type).toBe('code');
    expect(classification.confidence).toBeGreaterThan(0.5);
  });

  it('should classify reasoning tasks correctly', { 
    skip: !process.env.SYNTHETIC_API_KEY 
  }, () => {
    const classification = gateway.classifyTask({
      title: 'Architecture Decision',
      description: 'Analyze the trade-offs between microservices and monolith architecture for our project',
      messages: [{ role: 'user', content: 'What approach should we take and why?' }]
    });

    expect(classification.type).toBe('reasoning');
    expect(classification.confidence).toBeGreaterThan(0.5);
  });

  it('should process simple code generation request', { 
    skip: !process.env.SYNTHETIC_API_KEY,
    timeout: 60000 
  }, async () => {
    const response = await gateway.processWithAgent('code', {
      title: 'Simple Function',
      description: 'Create a TypeScript function',
      messages: [{
        role: 'user',
        content: 'Write a simple TypeScript function that adds two numbers and returns the result'
      }],
      maxTokens: 150,
    });

    expect(response.agent).toBe('synthetic-code');
    expect(response.text).toContain('function');
    expect(response.text).toContain('number');
    expect(response.tokensUsed).toBeGreaterThan(0);
  });

  it('should track cost and usage', { 
    skip: !process.env.SYNTHETIC_API_KEY 
  }, async () => {
    // Process a small request first
    await gateway.processWithAgent('code', {
      description: 'Test cost tracking',
      messages: [{ role: 'user', content: 'Say hello' }],
      maxTokens: 10,
    });

    const stats = gateway.getCostStats();
    expect(stats.totalRequests).toBeGreaterThan(0);
    expect(stats.totalTokens).toBeGreaterThan(0);
    expect(stats.monthlyCostUsd).toBe(20); // Flat fee
  });

  it('should provide agent information', { 
    skip: !process.env.SYNTHETIC_API_KEY 
  }, () => {
    const agents = gateway.getAvailableAgents();
    
    expect(agents.code).toBeDefined();
    expect(agents.reasoning).toBeDefined();
    expect(agents.context).toBeDefined();
    
    expect(agents.code.model).toContain('Qwen');
    expect(agents.reasoning.model).toContain('DeepSeek');
    expect(agents.context.model).toContain('Qwen');
  });

  it('should calculate cost savings vs pay-per-use', { 
    skip: !process.env.SYNTHETIC_API_KEY 
  }, () => {
    const savings = gateway.getPayPerUseSavings(0.002); // $0.002 per token
    
    expect(savings.flatFeeUsd).toBe(20);
    expect(typeof savings.payPerUseUsd).toBe('number');
    expect(typeof savings.savedUsd).toBe('number');
    expect(typeof savings.savingsPercent).toBe('number');
  });
});