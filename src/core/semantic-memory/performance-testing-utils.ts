/**
 * Performance Testing & Benchmarking Utilities
 * Validates Phase 1 performance targets: <50ms search, <100ms embedding
 * Provides comprehensive benchmarking and performance monitoring
 */

import { SemanticMemoryEngine } from './semantic-memory-engine';
import { SemanticSearchEngine } from './semantic-search-engine';
import { MemoryClusteringEngine } from './memory-clustering-engine';
import { OllamaEmbeddingService } from './ollama-embedding-service';

export interface PerformanceBenchmark {
  testName: string;
  targetTime: number;
  actualTime: number;
  passed: boolean;
  iterations: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  standardDeviation: number;
}

export interface SystemBenchmarkResult {
  embeddingGeneration: PerformanceBenchmark;
  memoryStorage: PerformanceBenchmark;
  semanticSearch: PerformanceBenchmark;
  memoryClustering: PerformanceBenchmark;
  overallScore: number;
  recommendations: string[];
}

export interface LoadTestResult {
  concurrentUsers: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  throughputPerSecond: number;
  errorRate: number;
}

export class PerformanceTestingUtils {
  private memoryEngine: SemanticMemoryEngine;
  private searchEngine: SemanticSearchEngine;
  private clusteringEngine: MemoryClusteringEngine;
  private embedding: OllamaEmbeddingService;

  constructor() {
    this.memoryEngine = new SemanticMemoryEngine();
    this.searchEngine = new SemanticSearchEngine();
    this.clusteringEngine = new MemoryClusteringEngine();
    this.embedding = new OllamaEmbeddingService();
  }

  /**
   * Run comprehensive system benchmark
   */
  async runSystemBenchmark(projectId: number = 19): Promise<SystemBenchmarkResult> {
    console.log('Running Phase 1 performance benchmark...');

    const results: Partial<SystemBenchmarkResult> = {
      recommendations: []
    };

    try {
      // Test embedding generation (target: <100ms)
      results.embeddingGeneration = await this.benchmarkEmbeddingGeneration();

      // Test memory storage (target: <50ms)
      results.memoryStorage = await this.benchmarkMemoryStorage(projectId);

      // Test semantic search (target: <50ms)
      results.semanticSearch = await this.benchmarkSemanticSearch(projectId);

      // Test memory clustering (target: <500ms for 100 memories)
      results.memoryClustering = await this.benchmarkMemoryClustering(projectId);

      // Calculate overall score
      results.overallScore = this.calculateOverallScore(results as SystemBenchmarkResult);

      // Generate recommendations
      results.recommendations = this.generateRecommendations(results as SystemBenchmarkResult);

    } catch (error) {
      console.error('Benchmark failed:', error);
      results.recommendations!.push(`Benchmark failed: ${error}`);
      results.overallScore = 0;
    }

    return results as SystemBenchmarkResult;
  }

  /**
   * Benchmark embedding generation performance
   */
  private async benchmarkEmbeddingGeneration(): Promise<PerformanceBenchmark> {
    const testCases = [
      'Simple test content for embedding generation',
      'More complex content with technical details about software architecture and implementation patterns',
      'Very long content with multiple paragraphs discussing various aspects of system design, performance optimization, and scalability considerations in modern distributed architectures',
      'Short',
      'Medium length content discussing database optimization and query performance tuning strategies'
    ];

    return await this.runPerformanceBenchmark(
      'Embedding Generation',
      100, // 100ms target
      10, // iterations
      async () => {
        const testContent = testCases[Math.floor(Math.random() * testCases.length)];
        await this.embedding.generateEmbedding(testContent);
      }
    );
  }

  /**
   * Benchmark memory storage performance
   */
  private async benchmarkMemoryStorage(projectId: number): Promise<PerformanceBenchmark> {
    return await this.runPerformanceBenchmark(
      'Memory Storage',
      50, // 50ms target
      5, // iterations
      async () => {
        await this.memoryEngine.storeMemory({
          content: `Benchmark test content ${Date.now()}`,
          contentType: 'task',
          projectId,
          metadata: { benchmark: true }
        });
      }
    );
  }

  /**
   * Benchmark semantic search performance
   */
  private async benchmarkSemanticSearch(projectId: number): Promise<PerformanceBenchmark> {
    // First ensure we have some test data
    await this.createTestMemories(projectId);

    return await this.runPerformanceBenchmark(
      'Semantic Search',
      50, // 50ms target
      10, // iterations
      async () => {
        await this.searchEngine.search({
          query: 'test search query for performance benchmarking',
          projectId,
          limit: 5
        });
      }
    );
  }

  /**
   * Benchmark memory clustering performance
   */
  private async benchmarkMemoryClustering(projectId: number): Promise<PerformanceBenchmark> {
    // Ensure we have test data for clustering
    await this.createTestMemories(projectId, 20);

    return await this.runPerformanceBenchmark(
      'Memory Clustering',
      500, // 500ms target for clustering
      3, // fewer iterations due to complexity
      async () => {
        await this.clusteringEngine.clusterProjectMemories(projectId);
      }
    );
  }

  /**
   * Create test memories for benchmarking
   */
  private async createTestMemories(projectId: number, count: number = 10): Promise<void> {
    const testContents = [
      'Database query optimization techniques',
      'React component lifecycle methods',
      'TypeScript interface definitions',
      'API endpoint authentication',
      'Memory management strategies',
      'Performance monitoring tools',
      'Code review best practices',
      'Testing automation frameworks',
      'DevOps deployment pipelines',
      'Security vulnerability assessment'
    ];

    for (let i = 0; i < count; i++) {
      const content = testContents[i % testContents.length] + ` ${i}`;

      try {
        await this.memoryEngine.storeMemory({
          content,
          contentType: 'task',
          projectId,
          metadata: { benchmark: true, index: i }
        });
      } catch {
        // Ignore duplicate content errors during benchmarking
      }
    }
  }

  /**
   * Generic performance benchmark runner
   */
  private async runPerformanceBenchmark(
    testName: string,
    targetTime: number,
    iterations: number,
    testFunction: () => Promise<void>
  ): Promise<PerformanceBenchmark> {
    const times: number[] = [];

    console.log(`  Running ${testName} benchmark (${iterations} iterations)...`);

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();

      try {
        await testFunction();
        const endTime = performance.now();
        times.push(endTime - startTime);
      } catch (error) {
        console.warn(`  Iteration ${i + 1} failed:`, error);
        times.push(targetTime * 2); // Penalty for failure
      }
    }

    const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const variance = times.reduce((sum, time) => sum + Math.pow(time - averageTime, 2), 0) / times.length;
    const standardDeviation = Math.sqrt(variance);

    const passed = averageTime <= targetTime;

    console.log(`  ${testName}: ${averageTime.toFixed(2)}ms avg (target: ${targetTime}ms) - ${passed ? 'PASS' : 'FAIL'}`);

    return {
      testName,
      targetTime,
      actualTime: averageTime,
      passed,
      iterations,
      averageTime,
      minTime,
      maxTime,
      standardDeviation
    };
  }

  /**
   * Calculate overall performance score (0-100)
   */
  private calculateOverallScore(results: SystemBenchmarkResult): number {
    const benchmarks = [
      results.embeddingGeneration,
      results.memoryStorage,
      results.semanticSearch,
      results.memoryClustering
    ];

    const weights = [0.3, 0.2, 0.3, 0.2]; // Weight by importance
    let totalScore = 0;

    benchmarks.forEach((benchmark, index) => {
      const efficiency = Math.min(benchmark.targetTime / benchmark.actualTime, 1);
      const score = efficiency * 100;
      totalScore += score * weights[index];
    });

    return Math.round(totalScore);
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(results: SystemBenchmarkResult): string[] {
    const recommendations: string[] = [];

    if (!results.embeddingGeneration.passed) {
      recommendations.push(
        'Embedding generation is slow. Consider using a faster Ollama model or optimizing batch processing.'
      );
    }

    if (!results.memoryStorage.passed) {
      recommendations.push(
        'Memory storage is slow. Check database indexes and consider connection pooling.'
      );
    }

    if (!results.semanticSearch.passed) {
      recommendations.push(
        'Semantic search is slow. Consider adding vector indexes or reducing search scope.'
      );
    }

    if (!results.memoryClustering.passed) {
      recommendations.push(
        'Memory clustering is slow. Consider reducing cluster complexity or using batch processing.'
      );
    }

    if (results.overallScore < 70) {
      recommendations.push(
        'Overall performance is below target. Consider hardware upgrades or algorithm optimization.'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('All performance targets met! System is optimally configured.');
    }

    return recommendations;
  }

  /**
   * Run load testing with concurrent users
   */
  async runLoadTest(
    projectId: number,
    concurrentUsers: number,
    requestsPerUser: number
  ): Promise<LoadTestResult> {
    console.log(`Running load test: ${concurrentUsers} concurrent users, ${requestsPerUser} requests each`);

    const startTime = Date.now();
    const promises: Promise<boolean>[] = [];

    // Create concurrent user simulations
    for (let user = 0; user < concurrentUsers; user++) {
      for (let request = 0; request < requestsPerUser; request++) {
        promises.push(this.simulateUserRequest(projectId));
      }
    }

    // Execute all requests concurrently
    const results = await Promise.allSettled(promises);
    const endTime = Date.now();

    const totalRequests = results.length;
    const successfulRequests = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failedRequests = totalRequests - successfulRequests;
    const totalTime = (endTime - startTime) / 1000; // Convert to seconds
    const averageResponseTime = totalTime / totalRequests * 1000; // Convert back to ms
    const throughputPerSecond = totalRequests / totalTime;
    const errorRate = (failedRequests / totalRequests) * 100;

    console.log(`Load test completed: ${successfulRequests}/${totalRequests} successful (${errorRate.toFixed(1)}% error rate)`);

    return {
      concurrentUsers,
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      throughputPerSecond,
      errorRate
    };
  }

  /**
   * Simulate a single user request for load testing
   */
  private async simulateUserRequest(projectId: number): Promise<boolean> {
    try {
      const operations = [
        () => this.searchEngine.search({
          query: `Load test query ${Math.random()}`,
          projectId,
          limit: 3
        }),
        () => this.memoryEngine.storeMemory({
          content: `Load test content ${Math.random()}`,
          contentType: 'task',
          projectId
        }),
        () => this.memoryEngine.getMemoryCount(projectId)
      ];

      const operation = operations[Math.floor(Math.random() * operations.length)];
      await operation();
      return true;

    } catch {
      return false;
    }
  }

  /**
   * Cleanup benchmark data
   */
  async cleanupBenchmarkData(projectId: number): Promise<void> {
    try {
      // This would require access to delete functionality
      console.log(`Cleaning up benchmark data for project ${projectId}`);
      // Implementation depends on having delete methods available
    } catch (error) {
      console.warn('Failed to cleanup benchmark data:', error);
    }
  }
}