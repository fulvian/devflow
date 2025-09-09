import dotenv from 'dotenv';
import { SyntheticGateway } from './packages/adapters/synthetic/dist/index.js';

// Load environment variables
dotenv.config();

async function testSyntheticIntegration() {
  console.log('🚀 Testing Synthetic.new Integration...\n');

  const gateway = new SyntheticGateway();

  try {
    // Test 1: Agent Information
    console.log('📋 Available Agents:');
    const agents = gateway.getAvailableAgents();
    Object.entries(agents).forEach(([type, info]) => {
      console.log(`  ${type}: ${info.name} (${info.model})`);
    });
    console.log();

    // Test 2: Task Classification
    console.log('🧠 Task Classification Test:');
    const codeTask = gateway.classifyTask({
      title: 'Implement API Client',
      description: 'Create a TypeScript API client with error handling',
      messages: [{ role: 'user', content: 'Please implement the client' }]
    });
    console.log(`  Code Task: ${codeTask.type} (confidence: ${codeTask.confidence.toFixed(2)})`);

    const reasoningTask = gateway.classifyTask({
      title: 'Architecture Decision',
      description: 'Analyze microservices vs monolith trade-offs',
      messages: [{ role: 'user', content: 'What approach should we use?' }]
    });
    console.log(`  Reasoning Task: ${reasoningTask.type} (confidence: ${reasoningTask.confidence.toFixed(2)})`);
    console.log();

    // Test 3: Live API Call
    console.log('🌐 Live API Test:');
    const response = await gateway.processWithAgent('code', {
      title: 'Simple Function',
      description: 'Create a TypeScript utility function',
      messages: [{
        role: 'user',
        content: 'Write a simple TypeScript function called `greet` that takes a name parameter and returns "Hello, {name}!"'
      }],
      maxTokens: 200,
    });

    console.log(`  Agent: ${response.agent}`);
    console.log(`  Model: ${response.model}`);
    console.log(`  Tokens Used: ${response.tokensUsed}`);
    console.log(`  Response:\n${response.text.substring(0, 200)}${response.text.length > 200 ? '...' : ''}`);
    console.log();

    // Test 4: Cost Tracking
    console.log('💰 Cost Tracking:');
    const stats = gateway.getCostStats();
    console.log(`  Total Requests: ${stats.totalRequests}`);
    console.log(`  Total Tokens: ${stats.totalTokens}`);
    console.log(`  Monthly Cost: $${stats.monthlyCostUsd}`);
    console.log(`  Average Cost per Request: $${stats.averageCostPerRequest.toFixed(6)}`);
    console.log();

    // Test 5: Cost Comparison
    console.log('📊 Cost Comparison (vs pay-per-use at $0.002/token):');
    const savings = gateway.getPayPerUseSavings(0.002);
    console.log(`  Flat Fee: $${savings.flatFeeUsd}`);
    console.log(`  Pay-per-use would cost: $${savings.payPerUseUsd}`);
    console.log(`  Savings: $${savings.savedUsd} (${savings.savingsPercent}%)`);
    console.log();

    console.log('✅ Synthetic.new integration test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testSyntheticIntegration();