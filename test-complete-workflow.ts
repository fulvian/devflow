import dotenv from 'dotenv';
import { UnifiedSmartGateway, UnifiedCostTracker } from './packages/core/src/index.js';

// Load environment variables
dotenv.config();

async function testCompleteWorkflow() {
  console.log('🚀 Testing Complete DevFlow Multi-Platform Workflow\n');
  console.log('Architecture: Claude Code (Architect) → Synthetic.new (Secondary) → OpenRouter (Premium)');
  console.log('='.repeat(80) + '\n');

  // Initialize components
  const costTracker = new UnifiedCostTracker({
    daily: 5.0,    // $5 daily limit
    monthly: 100.0, // $100 monthly limit
    perRequest: 0.50, // $0.50 per request limit
    alertThresholds: {
      warning: 0.5,  // 50%
      critical: 0.8, // 80%
    }
  });

  const gateway = new UnifiedSmartGateway({
    synthetic: {
      enabled: true,
      apiKey: process.env.SYNTHETIC_API_KEY,
    },
    openRouter: {
      enabled: true,
      apiKey: process.env.OPENROUTER_API_KEY,
      budgetUsd: 20.0,
    },
    routing: {
      enableLearning: true,
      costOptimization: true,
      qualityThreshold: 0.7,
    },
    fallbackChain: ['synthetic', 'openrouter'],
  });

  console.log('📊 Platform Status Check:');
  const status = gateway.getPlatformStatus();
  console.log(`  Synthetic.new: ${status.coordinator.synthetic?.available ? '✅ Available' : '❌ Unavailable'}`);
  console.log(`  OpenRouter: ${status.coordinator.openrouter?.available ? '✅ Available' : '❌ Unavailable'}`);
  console.log();

  // Test scenarios representing different types of tasks
  const testScenarios = [
    {
      name: 'Simple Code Generation',
      task: {
        title: 'Create utility function',
        description: 'Write a TypeScript function that validates email addresses using regex',
        domain: 'code' as const,
        complexity: 'simple' as const,
        priority: 'medium' as const,
      },
      expectedPlatform: 'synthetic',
      maxCost: 0.05,
    },
    {
      name: 'Complex Architecture Analysis',
      task: {
        title: 'System architecture review',
        description: 'Analyze the trade-offs between microservices vs monolith architecture for a high-traffic e-commerce platform. Consider scalability, maintainability, deployment complexity, and team structure implications.',
        domain: 'reasoning' as const,
        complexity: 'complex' as const,
        priority: 'high' as const,
      },
      expectedPlatform: 'synthetic',
      maxCost: 0.10,
    },
    {
      name: 'Critical System Design',
      task: {
        title: 'Database optimization strategy',
        description: 'Design a comprehensive database optimization strategy for a system handling 1M+ daily transactions with sub-100ms response time requirements.',
        domain: 'analysis' as const,
        complexity: 'complex' as const,
        priority: 'critical' as const,
      },
      expectedPlatform: 'openrouter', // Should route to premium for critical tasks
      maxCost: 0.20,
    },
    {
      name: 'Documentation Task',
      task: {
        title: 'API documentation',
        description: 'Create comprehensive API documentation for a REST endpoint that handles user authentication including request/response examples and error codes.',
        domain: 'documentation' as const,
        complexity: 'simple' as const,
        priority: 'low' as const,
      },
      expectedPlatform: 'synthetic',
      maxCost: 0.05,
    }
  ];

  const results: any[] = [];

  for (let i = 0; i < testScenarios.length; i++) {
    const scenario = testScenarios[i];
    console.log(`🧪 Test ${i + 1}: ${scenario.name}`);
    console.log(`   Task: ${scenario.task.description.substring(0, 60)}...`);
    console.log(`   Expected Platform: ${scenario.expectedPlatform}`);

    try {
      const startTime = Date.now();
      
      const result = await gateway.execute(scenario.task, {
        maxCost: scenario.maxCost,
        requireHighQuality: scenario.task.priority === 'critical',
        timeout: 45000, // 45s timeout
      });

      const executionTime = Date.now() - startTime;

      // Record cost event
      costTracker.recordEvent({
        platform: result.platform as any,
        taskId: result.taskId,
        model: result.model,
        agent: result.agent,
        inputTokens: Math.ceil(scenario.task.description.length / 4),
        outputTokens: Math.ceil(result.content.length / 4),
        totalTokens: result.tokensUsed,
        costUsd: result.totalCost,
        executionTime: result.executionTime,
        quality: result.qualityScore,
        success: true,
      });

      results.push({
        scenario: scenario.name,
        success: true,
        platform: result.platform,
        expectedPlatform: scenario.expectedPlatform,
        cost: result.totalCost,
        maxCost: scenario.maxCost,
        tokens: result.tokensUsed,
        quality: result.qualityScore,
        executionTime,
        routingReason: result.routingDecision.reason,
      });

      console.log(`   ✅ Success: ${result.platform} (${result.model || result.agent})`);
      console.log(`   💰 Cost: $${result.totalCost.toFixed(4)} (limit: $${scenario.maxCost})`);
      console.log(`   🎯 Quality: ${(result.qualityScore * 100).toFixed(0)}%`);
      console.log(`   ⏱️ Time: ${result.executionTime}ms`);
      console.log(`   🧠 Routing: ${result.routingDecision.reason.substring(0, 50)}...`);
      console.log(`   📝 Output: ${result.content.substring(0, 100)}${result.content.length > 100 ? '...' : ''}`);
      console.log();

    } catch (error) {
      results.push({
        scenario: scenario.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: null,
        expectedPlatform: scenario.expectedPlatform,
      });

      console.log(`   ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log();
    }

    // Brief delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Analysis and Summary
  console.log('📊 WORKFLOW ANALYSIS & SUMMARY');
  console.log('='.repeat(50));

  const successfulTests = results.filter(r => r.success);
  const failedTests = results.filter(r => !r.success);

  console.log(`\n✅ Success Rate: ${successfulTests.length}/${results.length} (${(successfulTests.length / results.length * 100).toFixed(0)}%)`);

  if (successfulTests.length > 0) {
    const totalCost = successfulTests.reduce((sum, r) => sum + (r.cost || 0), 0);
    const avgQuality = successfulTests.reduce((sum, r) => sum + (r.quality || 0), 0) / successfulTests.length;
    const avgTime = successfulTests.reduce((sum, r) => sum + (r.executionTime || 0), 0) / successfulTests.length;

    console.log(`💰 Total Cost: $${totalCost.toFixed(4)}`);
    console.log(`🎯 Average Quality: ${(avgQuality * 100).toFixed(0)}%`);
    console.log(`⏱️ Average Time: ${avgTime.toFixed(0)}ms`);

    // Platform usage analysis
    const platformUsage = successfulTests.reduce((acc, r) => {
      acc[r.platform] = (acc[r.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\n🏗️ Platform Usage:');
    Object.entries(platformUsage).forEach(([platform, count]) => {
      const percentage = (count / successfulTests.length * 100).toFixed(0);
      console.log(`   ${platform}: ${count} requests (${percentage}%)`);
    });

    // Routing accuracy
    const correctRouting = successfulTests.filter(r => r.platform === r.expectedPlatform).length;
    console.log(`\n🎯 Routing Accuracy: ${correctRouting}/${successfulTests.length} (${(correctRouting / successfulTests.length * 100).toFixed(0)}%)`);
  }

  if (failedTests.length > 0) {
    console.log('\n❌ Failed Tests:');
    failedTests.forEach(test => {
      console.log(`   ${test.scenario}: ${test.error}`);
    });
  }

  // Cost Analysis
  console.log('\n💹 COST ANALYSIS');
  console.log('='.repeat(30));
  
  const costSummary = costTracker.getSummary();
  if (typeof costSummary === 'object' && !('platform' in costSummary)) {
    Object.entries(costSummary).forEach(([platform, summary]) => {
      console.log(`\n${platform.toUpperCase()}:`);
      console.log(`   Requests: ${summary.totalRequests}`);
      console.log(`   Total Cost: $${summary.totalCostUsd}`);
      console.log(`   Avg/Request: $${summary.avgCostPerRequest.toFixed(4)}`);
      console.log(`   Quality: ${(summary.avgQuality * 100).toFixed(0)}%`);
      console.log(`   Success Rate: ${(summary.successRate * 100).toFixed(0)}%`);
    });
  }

  // Budget Status
  const budgetStatus = costTracker.getBudgetStatus();
  console.log('\n💳 BUDGET STATUS');
  console.log(`   Daily: $${budgetStatus.current.daily} / $${budgetStatus.limits.daily || 'unlimited'}`);
  console.log(`   Monthly: $${budgetStatus.current.monthly} / $${budgetStatus.limits.monthly || 'unlimited'}`);
  console.log(`   Daily Burn Rate: $${budgetStatus.projections.dailyBurn}`);
  console.log(`   Monthly Projection: $${budgetStatus.projections.monthlyProjection}`);

  if (budgetStatus.alerts.length > 0) {
    console.log('\n🚨 BUDGET ALERTS:');
    budgetStatus.alerts.forEach(alert => {
      console.log(`   ${alert.severity.toUpperCase()}: ${alert.message}`);
    });
  }

  // Optimization Recommendations
  const recommendations = costTracker.getOptimizationRecommendations();
  if (recommendations.length > 0) {
    console.log('\n💡 OPTIMIZATION RECOMMENDATIONS');
    console.log('='.repeat(40));
    recommendations.forEach((rec, i) => {
      console.log(`\n${i + 1}. ${rec.description}`);
      console.log(`   Type: ${rec.type}`);
      console.log(`   Potential Savings: $${rec.estimatedSavings.toFixed(4)}`);
      console.log(`   Confidence: ${(rec.confidence * 100).toFixed(0)}%`);
      console.log(`   Action: ${rec.actionRequired}`);
    });
  }

  // Gateway Insights
  const insights = gateway.getInsights();
  console.log('\n🔍 SYSTEM INSIGHTS');
  console.log('='.repeat(25));
  console.log(`Reliability Score: ${Object.values(insights.reliability.platformAvailability).filter(Boolean).length}/${Object.keys(insights.reliability.platformAvailability).length} platforms available`);
  console.log(`Fallback Coverage: ${insights.reliability.fallbackCoverage} levels`);
  
  if (insights.recommendations.length > 0) {
    console.log('\nSystem Recommendations:');
    insights.recommendations.forEach(rec => {
      console.log(`   • ${rec}`);
    });
  }

  console.log('\n🎉 COMPLETE WORKFLOW TEST FINISHED');
  console.log('DevFlow multi-platform integration is operational!');
  
  // Export test data
  const testData = costTracker.exportData('json');
  console.log(`\n📄 Test data exported (${JSON.parse(testData).events.length} events tracked)`);

  return {
    success: successfulTests.length === results.length,
    results,
    costSummary,
    budgetStatus,
    recommendations,
    insights
  };
}

// Run the test
testCompleteWorkflow()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Workflow test failed:', error);
    process.exit(1);
  });