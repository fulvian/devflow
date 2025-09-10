// Simple Cost Modeling Test

const { PredictiveCostModel } = require('./mcp-servers/synthetic/dist/cost-prediction/PredictiveCostModel');

async function testCostModeling() {
  console.log('🧪 Testing Predictive Cost Modeling...');
  
  try {
    const costModel = new PredictiveCostModel({
      learningRate: 0.01,
      minTrainingSamples: 3
    });
    
    // Add minimal test data
    const testData = [
      { taskId: 'TEST-1', platform: 'synthetic', executionTime: 1000, cost: 0.005, tokensUsed: 500, complexity: 3, timestamp: Date.now() },
      { taskId: 'TEST-2', platform: 'claude', executionTime: 2000, cost: 0.030, tokensUsed: 1000, complexity: 5, timestamp: Date.now() },
      { taskId: 'TEST-3', platform: 'codex', executionTime: 1500, cost: 0.045, tokensUsed: 750, complexity: 4, timestamp: Date.now() }
    ];
    
    // Add training data
    testData.forEach(data => costModel.addDataPoint(data));
    
    // Test predictions
    const predictions = costModel.predictCosts(4, 800, 1200);
    console.log('📊 Cost Predictions:', predictions);
    
    // Test routing decision
    const decision = costModel.makeRoutingDecision(4, 800, 1200);
    console.log('🎯 Routing Decision:', decision);
    
    console.log('✅ Cost modeling test completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Cost modeling test failed:', error);
    return false;
  }
}

testCostModeling();