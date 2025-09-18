#!/usr/bin/env ts-node

/**
 * Agent Fallback Test Runner
 * Test the Claude→Codex→Gemini→Qwen3 hierarchy
 */

import { IntelligentAgentRouter, AgentType, Task } from './src/core/orchestration/intelligent-agent-router';
import { AgentFallbackTester } from './src/core/testing/agent-fallback-tester';
import { Logger } from './src/core/logging/logger';

// Mock Logger for testing
class TestLogger implements Logger {
  info(message: string, meta?: any): void {
    console.log(`[INFO] ${message}`, meta || '');
  }

  warn(message: string, meta?: any): void {
    console.log(`[WARN] ${message}`, meta || '');
  }

  error(message: string, meta?: any): void {
    console.log(`[ERROR] ${message}`, meta || '');
  }

  debug(message: string, meta?: any): void {
    console.log(`[DEBUG] ${message}`, meta || '');
  }
}

async function main() {
  console.log('🚀 Starting Agent Fallback Testing');
  console.log('Testing hierarchy: Claude → Codex → Gemini → Qwen3');
  console.log('=====================================');

  const logger = new TestLogger();
  const router = new IntelligentAgentRouter(logger);
  const tester = new AgentFallbackTester(router, { verbose: true });

  try {
    // Test 1: Normal operation test
    console.log('\n📋 Test 1: Normal Operation');
    const task1: Task = {
      id: 'test-normal-001',
      content: 'Simple test to verify agent routing works',
      priority: 5
    };

    const result1 = await router.routeTask(task1);
    console.log(`Result: ${result1.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Agent used: ${result1.agentType}`);
    console.log(`Fallback used: ${result1.fallbackUsed}`);
    if (result1.error) console.log(`Error: ${result1.error}`);

    // Test 2: Coding task (should prefer Codex)
    console.log('\n💻 Test 2: Coding Task');
    const task2: Task = {
      id: 'test-code-001',
      content: 'Write a TypeScript function for code generation task',
      priority: 7
    };

    const result2 = await router.routeTask(task2);
    console.log(`Result: ${result2.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Agent used: ${result2.agentType}`);
    console.log(`Fallback used: ${result2.fallbackUsed}`);
    if (result2.error) console.log(`Error: ${result2.error}`);

    // Test 3: Debug task (should prefer Gemini)
    console.log('\n🐛 Test 3: Debug Task');
    const task3: Task = {
      id: 'test-debug-001',
      content: 'Debug authentication error in the system',
      priority: 6
    };

    const result3 = await router.routeTask(task3);
    console.log(`Result: ${result3.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Agent used: ${result3.agentType}`);
    console.log(`Fallback used: ${result3.fallbackUsed}`);
    if (result3.error) console.log(`Error: ${result3.error}`);

    // Test 4: Run comprehensive test suite
    console.log('\n🧪 Test 4: Comprehensive Test Suite');
    const allResults = await tester.runAllTests();

    // Test 5: Health check
    console.log('\n🏥 Test 5: Hierarchy Health Check');
    const health = await tester.getHierarchyHealth();
    console.log(`Overall Status: ${health.status.toUpperCase()}`);
    console.log('Agent Status:');
    health.agents.forEach(agent => {
      console.log(`  ${agent.agent}: ${agent.status.toUpperCase()}`);
    });
    console.log(`Last Test: ${health.lastTest}`);

    // Summary
    console.log('\n📊 TEST SUMMARY');
    console.log('================');
    const passed = allResults.filter(r => r.passed).length;
    const total = allResults.length;
    console.log(`Tests Passed: ${passed}/${total}`);
    console.log(`Success Rate: ${((passed/total) * 100).toFixed(1)}%`);
    console.log(`System Health: ${health.status.toUpperCase()}`);

    // Check if delegation is working correctly
    const hasQwen3 = allResults.some(r => r.finalAgent === AgentType.QWEN3);
    const hasClaude = allResults.some(r => r.finalAgent === AgentType.CLAUDE);

    console.log('\n🔄 DELEGATION ANALYSIS');
    console.log('=====================');
    console.log(`Claude used: ${hasClaude ? 'YES' : 'NO'}`);
    console.log(`Qwen3 fallback used: ${hasQwen3 ? 'YES' : 'NO'}`);

    if (hasQwen3) {
      console.log('✅ Fallback system is working - Qwen3 being used when other agents fail');
    } else {
      console.log('⚠️  All tasks staying in Claude - may indicate auth issues with other agents');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

// Run the tests
main().then(() => {
  console.log('\n✅ Agent Fallback Testing Complete');
}).catch(error => {
  console.error('❌ Testing failed:', error);
  process.exit(1);
});