#!/usr/bin/env node

/**
 * Test Script for Synthetic API Batch Processing System
 * Tests rate limiting, batch processing, and optimization features
 */

import { syntheticService } from './services/SyntheticService.js';
import { apiRateLimiter } from './utils/ApiRateLimiter.js';
import { batchProcessor } from './services/BatchProcessor.js';
import { SYNTHETIC_API_LIMITS } from './config/apiLimits.js';

async function testRateLimiter() {
  console.log('\n🧪 Testing Rate Limiter...');
  
  // Test initial status
  const initialStatus = apiRateLimiter.getStatus();
  console.log(`Initial Status: ${initialStatus.remainingCalls}/${SYNTHETIC_API_LIMITS.maxCalls} calls remaining`);
  
  // Test recording calls
  for (let i = 0; i < 5; i++) {
    apiRateLimiter.recordCall('test-session', 'test-model');
    const status = apiRateLimiter.getStatus();
    console.log(`After call ${i + 1}: ${status.remainingCalls} remaining, ${(status.usagePercentage * 100).toFixed(1)}% usage`);
  }
  
  // Test usage stats
  const stats = apiRateLimiter.getUsageStats();
  console.log(`Usage Stats: ${stats.successfulCalls} successful, ${stats.failedCalls} failed calls`);
  
  console.log('✅ Rate Limiter test completed\n');
}

async function testBatchProcessor() {
  console.log('\n🧪 Testing Batch Processor...');
  
  // Test single request
  console.log('Testing single request...');
  try {
    const result = await batchProcessor.enqueueRequest(
      'code',
      'test-file.ts',
      'Create a simple function',
      'typescript',
      0.5,
      0.3
    );
    console.log('Single request result:', result);
  } catch (error) {
    console.log('Single request error:', error.message);
  }
  
  // Test batch requests
  console.log('Testing batch requests...');
  const batchPromises = [];
  for (let i = 0; i < 3; i++) {
    batchPromises.push(
      batchProcessor.enqueueRequest(
        'code',
        `test-file-${i}.ts`,
        `Create function ${i}`,
        'typescript',
        0.3, // Lower priority for batching
        0.4
      )
    );
  }
  
  try {
    const batchResults = await Promise.all(batchPromises);
    console.log('Batch results:', batchResults.length, 'requests completed');
  } catch (error) {
    console.log('Batch request error:', error.message);
  }
  
  // Test queue status
  const queueStatus = batchProcessor.getQueueStatus();
  console.log('Queue Status:', queueStatus);
  
  console.log('✅ Batch Processor test completed\n');
}

async function testSyntheticService() {
  console.log('\n🧪 Testing Synthetic Service...');
  
  // Test single operation
  console.log('Testing single operation...');
  try {
    const result = await syntheticService.executeOperation({
      taskId: 'TEST-001',
      filePath: 'test-single.ts',
      objective: 'Create a utility function',
      language: 'typescript',
      agentType: 'code',
      priority: 0.7,
      complexity: 0.4,
    });
    
    console.log('Single operation result:', {
      success: result.success,
      tokensUsed: result.tokensUsed,
      batchOptimized: result.batchOptimized,
      executionTime: result.executionTime,
    });
  } catch (error) {
    console.log('Single operation error:', error.message);
  }
  
  // Test batch operations
  console.log('Testing batch operations...');
  try {
    const batchResult = await syntheticService.executeBatchOperations(
      'TEST-BATCH-001',
      [
        { filePath: 'batch-1.ts', objective: 'Create class A', language: 'typescript' },
        { filePath: 'batch-2.ts', objective: 'Create class B', language: 'typescript' },
        { filePath: 'batch-3.ts', objective: 'Create interface C', language: 'typescript' },
      ],
      'code',
      true
    );
    
    console.log('Batch operation result:', {
      success: batchResult.success,
      tokensUsed: batchResult.tokensUsed,
      batchOptimized: batchResult.batchOptimized,
      executionTime: batchResult.executionTime,
    });
  } catch (error) {
    console.log('Batch operation error:', error.message);
  }
  
  // Test service stats
  const serviceStats = syntheticService.getServiceStats();
  console.log('Service Stats:', {
    totalRequests: serviceStats.totalRequests,
    totalTokensSaved: serviceStats.totalTokensSaved,
    totalCallsOptimized: serviceStats.totalCallsOptimized,
    optimizationEfficiency: serviceStats.optimizationEfficiency.toFixed(1) + '%',
  });
  
  console.log('✅ Synthetic Service test completed\n');
}

async function testRateLimitScenarios() {
  console.log('\n🧪 Testing Rate Limit Scenarios...');
  
  // Simulate high usage
  console.log('Simulating high API usage...');
  for (let i = 0; i < 10; i++) {
    apiRateLimiter.recordCall('stress-test', 'test-model');
  }
  
  const highUsageStatus = apiRateLimiter.getStatus();
  console.log(`High usage status: ${highUsageStatus.remainingCalls} remaining, ${(highUsageStatus.usagePercentage * 100).toFixed(1)}% usage`);
  
  // Test canCall with high usage
  const canCall = apiRateLimiter.canCall();
  console.log(`Can make more calls: ${canCall}`);
  
  if (!canCall) {
    const waitTime = apiRateLimiter.getTimeUntilNextCall();
    console.log(`Time until next call: ${Math.ceil(waitTime / 1000)} seconds`);
  }
  
  // Test burst tokens
  const usageStats = apiRateLimiter.getUsageStats();
  console.log(`Burst tokens remaining: ${usageStats.burstTokensRemaining}`);
  
  console.log('✅ Rate Limit Scenarios test completed\n');
}

async function runAllTests() {
  console.log('🚀 Starting Synthetic API Batch Processing System Tests\n');
  
  try {
    await testRateLimiter();
    await testBatchProcessor();
    await testSyntheticService();
    await testRateLimitScenarios();
    
    console.log('🎉 All tests completed successfully!');
    
    // Final summary
    const finalStats = syntheticService.getServiceStats();
    const finalRateLimit = apiRateLimiter.getStatus();
    
    console.log('\n📊 Final Test Summary:');
    console.log(`- Total Requests: ${finalStats.totalRequests}`);
    console.log(`- Total Tokens Saved: ${finalStats.totalTokensSaved}`);
    console.log(`- Calls Optimized: ${finalStats.totalCallsOptimized}`);
    console.log(`- Optimization Efficiency: ${finalStats.optimizationEfficiency.toFixed(1)}%`);
    console.log(`- Rate Limit Usage: ${(finalRateLimit.usagePercentage * 100).toFixed(1)}%`);
    console.log(`- Remaining Calls: ${finalRateLimit.remainingCalls}/${SYNTHETIC_API_LIMITS.maxCalls}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { testRateLimiter, testBatchProcessor, testSyntheticService, testRateLimitScenarios };
