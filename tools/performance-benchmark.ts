/**
 * CODEX-4A: Performance Benchmarking Tools
 * Comprehensive performance analysis and reporting utilities
 */

import { performance } from 'perf_hooks';
import { DevFlowCore } from '../packages/core/src/index.js';
import type { 
  BenchmarkResult, 
  PerformanceStats, 
  PerformanceTargets,
  BenchmarkConfig 
} from '../packages/shared/src/types.js';

export class PerformanceBenchmark {
  private devFlow: DevFlowCore;
  private results: Map<string, BenchmarkResult[]> = new Map();

  constructor(devFlow: DevFlowCore) {
    this.devFlow = devFlow;
  }

  /**
   * Calculate statistical performance metrics
   */
  calculateStats(durations: number[]): PerformanceStats {
    if (durations.length === 0) {
      throw new Error('Cannot calculate stats for empty array');
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);
    
    return {
      count: durations.length,
      average: sum / durations.length,
      median: this.getPercentile(sorted, 0.5),
      p95: this.getPercentile(sorted, 0.95),
      p99: this.getPercentile(sorted, 0.99),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      standardDeviation: this.calculateStandardDeviation(durations, sum / durations.length)
    };
  }

  /**
   * Estimate token count for prompts (simplified estimation)
   */
  estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    // This is a simplified estimation for testing purposes
    const baseTokens = Math.ceil(text.length / 4);
    
    // Add complexity factors
    const complexity = this.analyzeComplexity(text);
    return Math.ceil(baseTokens * complexity.multiplier);
  }

  /**
   * Run comprehensive benchmark suite
   */
  async runBenchmarkSuite(config: BenchmarkConfig): Promise<Map<string, PerformanceStats>> {
    const results = new Map<string, PerformanceStats>();

    console.log('🔄 Running DevFlow Performance Benchmark Suite...');

    // Context Operations Benchmark
    console.log('  📊 Benchmarking context operations...');
    const contextResults = await this.benchmarkContextOperations(config.iterations.context);
    results.set('context_operations', this.calculateStats(contextResults));

    // Memory Operations Benchmark
    console.log('  💾 Benchmarking memory operations...');
    const memoryResults = await this.benchmarkMemoryOperations(config.iterations.memory);
    results.set('memory_operations', this.calculateStats(memoryResults));

    // End-to-End Workflow Benchmark
    console.log('  🔄 Benchmarking end-to-end workflows...');
    const workflowResults = await this.benchmarkEndToEndWorkflow(config.iterations.workflow);
    results.set('end_to_end_workflow', this.calculateStats(workflowResults.map(r => r.totalTime)));

    // Concurrent Operations Benchmark
    console.log('  ⚡ Benchmarking concurrent operations...');
    const concurrentResults = await this.benchmarkConcurrentOperations(config.concurrency);
    results.set('concurrent_operations', this.calculateStats(concurrentResults));

    // Token Optimization Benchmark
    console.log('  🎯 Benchmarking token optimization...');
    const tokenResults = await this.benchmarkTokenOptimization();
    results.set('token_optimization', tokenResults);

    console.log('✅ Benchmark suite completed!');
    return results;
  }

  /**
   * Benchmark context extraction and injection operations
   */
  private async benchmarkContextOperations(iterations: number): Promise<number[]> {
    const results: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      const context = {
        id: `bench-context-${i}`,
        title: 'Benchmark Context',
        architecturalContext: {
          decisions: ['TypeScript strict mode', 'Repository pattern', 'Dependency injection'],
          constraints: ['Node.js 20+', 'Memory < 512MB', 'Response time < 100ms'],
          patterns: ['Factory', 'Observer', 'Strategy']
        },
        implementationContext: {
          codebase: '/test/benchmark',
          frameworks: ['Node.js', 'TypeScript', 'Vitest'],
          dependencies: ['better-sqlite3', 'fastify', 'zod']
        }
      };

      await this.devFlow.context.inject(context);
      const duration = performance.now() - start;
      results.push(duration);
    }

    return results;
  }

  /**
   * Benchmark memory storage and retrieval operations
   */
  private async benchmarkMemoryOperations(iterations: number): Promise<number[]> {
    const results: number[] = [];
    const storedIds: string[] = [];

    // Store phase
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      const memoryBlock = {
        id: `bench-memory-${i}`,
        taskId: `bench-task-${Math.floor(i / 10)}`,
        sessionId: `bench-session-${Math.floor(i / 50)}`,
        blockType: 'implementation' as const,
        content: `Benchmark memory block ${i} with substantial content for realistic testing`,
        metadata: { 
          importance: 0.5 + (Math.random() * 0.5),
          tags: ['benchmark', 'test', `iteration-${i}`]
        }
      };

      await this.devFlow.memory.store(memoryBlock);
      storedIds.push(memoryBlock.id);
      
      const duration = performance.now() - start;
      results.push(duration);
    }

    // Retrieval phase
    for (let i = 0; i < Math.min(iterations, 100); i++) {
      const start = performance.now();
      
      const randomId = storedIds[Math.floor(Math.random() * storedIds.length)];
      await this.devFlow.memory.retrieve(randomId);
      
      const duration = performance.now() - start;
      results.push(duration);
    }

    return results;
  }

  /**
   * Benchmark complete end-to-end workflows
   */
  private async benchmarkEndToEndWorkflow(iterations: number): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    for (let i = 0; i < iterations; i++) {
      const workflowStart = performance.now();
      let contextTime = 0;
      let memoryTime = 0;
      let handoffTime = 0;

      try {
        // Context extraction
        const contextStart = performance.now();
        const context = {
          id: `workflow-${i}`,
          title: `Workflow Test ${i}`,
          architecturalContext: {
            decisions: ['Use microservices', 'Implement CQRS'],
            constraints: ['High availability', 'Low latency'],
            patterns: ['Event sourcing', 'API Gateway']
          }
        };
        contextTime = performance.now() - contextStart;

        // Memory storage
        const memoryStart = performance.now();
        await this.devFlow.memory.store({
          id: `workflow-memory-${i}`,
          taskId: context.id,
          sessionId: `workflow-session-${i}`,
          blockType: 'architectural',
          content: JSON.stringify(context),
          metadata: { importance: 0.9 }
        });
        memoryTime = performance.now() - memoryStart;

        // Simulated handoff
        const handoffStart = performance.now();
        await this.simulateHandoff(context);
        handoffTime = performance.now() - handoffStart;

        const totalTime = performance.now() - workflowStart;

        results.push({
          iteration: i,
          contextTime,
          memoryTime,
          handoffTime,
          totalTime,
          success: true
        });

      } catch (error) {
        results.push({
          iteration: i,
          contextTime,
          memoryTime,
          handoffTime,
          totalTime: performance.now() - workflowStart,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Benchmark concurrent operations under load
   */
  private async benchmarkConcurrentOperations(concurrency: { sessions: number; operationsPerSession: number }): Promise<number[]> {
    const startTime = performance.now();
    
    const sessionPromises = Array(concurrency.sessions).fill(0).map(async (_, sessionIndex) => {
      const sessionStart = performance.now();
      const operations: Promise<void>[] = [];

      for (let opIndex = 0; opIndex < concurrency.operationsPerSession; opIndex++) {
        operations.push(
          this.devFlow.memory.store({
            id: `concurrent-${sessionIndex}-${opIndex}`,
            taskId: `task-${sessionIndex}`,
            sessionId: `session-${sessionIndex}`,
            blockType: 'implementation',
            content: `Concurrent operation ${sessionIndex}-${opIndex}`,
            metadata: { importance: 0.5 }
          })
        );
      }

      await Promise.all(operations);
      return performance.now() - sessionStart;
    });

    const sessionTimes = await Promise.all(sessionPromises);
    const totalTime = performance.now() - startTime;

    return [...sessionTimes, totalTime];
  }

  /**
   * Benchmark token optimization effectiveness
   */
  private async benchmarkTokenOptimization(): Promise<PerformanceStats> {
    const testCases = [
      'Implement user authentication with JWT and bcrypt',
      'Create REST API endpoints for CRUD operations',
      'Design database schema with foreign key relationships',
      'Build responsive React components with styled-components',
      'Set up CI/CD pipeline with GitHub Actions and Docker'
    ];

    const optimizationResults: number[] = [];

    for (const testCase of testCases) {
      const baselineTokens = this.estimateTokens(testCase);
      
      // Simulate context retrieval and optimization
      const context = await this.devFlow.memory.retrieveRelevantContext(testCase);
      const optimizedPrompt = await this.devFlow.optimization.optimizePrompt(testCase, context);
      const optimizedTokens = this.estimateTokens(optimizedPrompt);

      const reduction = (baselineTokens - optimizedTokens) / baselineTokens;
      optimizationResults.push(reduction * 100); // Convert to percentage
    }

    return this.calculateStats(optimizationResults);
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport(benchmarkResults: Map<string, PerformanceStats>, targets: PerformanceTargets): string {
    let report = '\n🎯 DevFlow Performance Benchmark Report\n';
    report += '═'.repeat(50) + '\n\n';

    for (const [category, stats] of benchmarkResults) {
      report += `📊 ${category.replace(/_/g, ' ').toUpperCase()}\n`;
      report += '─'.repeat(30) + '\n';
      report += `Average: ${stats.average.toFixed(2)}ms\n`;
      report += `Median:  ${stats.median.toFixed(2)}ms\n`;
      report += `P95:     ${stats.p95.toFixed(2)}ms\n`;
      report += `P99:     ${stats.p99.toFixed(2)}ms\n`;
      report += `Range:   ${stats.min.toFixed(2)}ms - ${stats.max.toFixed(2)}ms\n`;

      // Compare against targets
      const target = this.getTargetForCategory(category, targets);
      if (target) {
        const status = stats.average <= target ? '✅ PASS' : '❌ FAIL';
        report += `Target:  ${target}ms ${status}\n`;
      }

      report += '\n';
    }

    // Summary
    const passedTests = this.countPassedTests(benchmarkResults, targets);
    const totalTests = benchmarkResults.size;
    
    report += `📈 SUMMARY\n`;
    report += '─'.repeat(30) + '\n';
    report += `Tests Passed: ${passedTests}/${totalTests}\n`;
    report += `Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n`;

    if (passedTests === totalTests) {
      report += '\n🎉 ALL PERFORMANCE TARGETS MET!\n';
    } else {
      report += '\n⚠️  Some performance targets not met. Consider optimization.\n';
    }

    return report;
  }

  // Helper methods
  private getPercentile(sorted: number[], percentile: number): number {
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  private calculateStandardDeviation(values: number[], mean: number): number {
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private analyzeComplexity(text: string): { multiplier: number; factors: string[] } {
    const factors: string[] = [];
    let multiplier = 1.0;

    // Technical terms increase complexity
    if (/\b(architecture|implementation|algorithm|optimization)\b/i.test(text)) {
      multiplier += 0.2;
      factors.push('technical_terminology');
    }

    // Code-related content
    if (/\b(function|class|interface|async|await)\b/i.test(text)) {
      multiplier += 0.3;
      factors.push('code_content');
    }

    // Multiple requirements
    const requirements = text.split(/[.!?]/).length;
    if (requirements > 3) {
      multiplier += 0.1 * (requirements - 3);
      factors.push('multiple_requirements');
    }

    return { multiplier: Math.min(multiplier, 2.0), factors };
  }

  private async simulateHandoff(context: any): Promise<void> {
    // Simulate network delay and processing time
    const delay = 50 + Math.random() * 100; // 50-150ms simulation
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private getTargetForCategory(category: string, targets: PerformanceTargets): number | null {
    switch (category) {
      case 'context_operations': return targets.contextInjection;
      case 'memory_operations': return targets.memoryOperations;
      case 'end_to_end_workflow': return targets.totalHandoff;
      default: return null;
    }
  }

  private countPassedTests(results: Map<string, PerformanceStats>, targets: PerformanceTargets): number {
    let passed = 0;
    
    for (const [category, stats] of results) {
      const target = this.getTargetForCategory(category, targets);
      if (target && stats.average <= target) {
        passed++;
      }
    }
    
    return passed;
  }
}