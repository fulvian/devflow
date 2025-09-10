// Test Predictive Cost Modeling

import { PredictiveCostModel } from './mcp-servers/synthetic/src/cost-prediction/PredictiveCostModel.js';
import { CostDataPoint } from './mcp-servers/synthetic/src/cost-prediction/types.js';

async function testCostModeling() {
  console.log('🧪 Testing Predictive Cost Modeling...');
  
  const costModel = new PredictiveCostModel({
    learningRate: 0.01,
    minTrainingSamples: 5
  });
  
  // Add test data points
  const testData: CostDataPoint[] = [
    { taskId: 'TEST-1', platform: 'synthetic', executionTime: 1000, cost: 0.005, tokensUsed: 500, complexity: 3, timestamp: Date.now() },
    { taskId: 'TEST-2', platform: 'claude', executionTime: 2000, cost: 0.030, tokensUsed: 1000, complexity: 5, timestamp: Date.now() },
    { taskId: 'TEST-3', platform: 'codex', executionTime: 1500, cost: 0.045, tokensUsed: 750, complexity: 4, timestamp: Date.now() },
    { taskId: 'TEST-4', platform: 'synthetic', executionTime: 800, cost: 0.004, tokensUsed: 400, complexity: 2, timestamp: Date.now() },
    { taskId: 'TEST-5', platform: 'claude', executionTime: 2500, cost: 0.038, tokensUsed: 1200, complexity: 6, timestamp: Date.now() }
  ];
  
  // Add training data
  testData.forEach(data => costModel.addDataPoint(data));
  
  // Train models
  await costModel.trainModels();
  
  // Test predictions
  const predictions = costModel.predictCosts(4, 800, 1200);
  console.log('📊 Cost Predictions:', predictions);
  
  // Test routing decision
  const decision = costModel.makeRoutingDecision(4, 800, 1200);
  console.log('🎯 Routing Decision:', decision);
  
  // Get performance metrics
  const performance = costModel.getPerformance();
  console.log('📈 Model Performance:', performance);
  
  console.log('✅ Cost modeling test completed');
  return true;
}

testCostModeling().catch(console.error);