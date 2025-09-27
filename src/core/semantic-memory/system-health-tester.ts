/**
 * System Health Tester for Enhanced Semantic Memory System
 * Validates Phase 1 implementation and tests integration points
 * Provides comprehensive health check for all semantic memory components
 */

import { EnhancedProjectMemorySystem } from './enhanced-memory-system';
import { OllamaEmbeddingService } from './ollama-embedding-service';
import { DatabaseAdapter } from './database-adapter';

export interface SystemHealthReport {
  overall_status: 'healthy' | 'warning' | 'critical';
  components: {
    enhanced_memory_system: ComponentHealth;
    ollama_embedding_service: ComponentHealth;
    database_adapter: ComponentHealth;
    database_schema: ComponentHealth;
    performance_benchmarks: ComponentHealth;
  };
  performance_metrics: {
    embedding_generation_time: number;
    memory_storage_time: number;
    semantic_search_time: number;
    memory_clustering_time: number;
  };
  recommendations: string[];
  timestamp: string;
}

export interface ComponentHealth {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  message: string;
  details?: any;
  test_results?: TestResult[];
}

export interface TestResult {
  test_name: string;
  passed: boolean;
  duration_ms: number;
  error_message?: string;
  details?: any;
}

export class SystemHealthTester {
  private memorySystem: EnhancedProjectMemorySystem;
  private ollamaService: OllamaEmbeddingService;
  private dbAdapter: DatabaseAdapter;

  constructor() {
    this.memorySystem = new EnhancedProjectMemorySystem({
      enablePerformanceMonitoring: true,
      enableClustering: true
    });
    this.ollamaService = new OllamaEmbeddingService();
    this.dbAdapter = new DatabaseAdapter();
  }

  /**
   * Run comprehensive system health check
   */
  async runHealthCheck(): Promise<SystemHealthReport> {
    console.log('Starting Enhanced Semantic Memory System Health Check...');
    const startTime = Date.now();

    // Test all components
    const [
      enhancedMemoryHealth,
      ollamaHealth,
      databaseHealth,
      schemaHealth,
      performanceHealth
    ] = await Promise.all([
      this.testEnhancedMemorySystem(),
      this.testOllamaEmbeddingService(),
      this.testDatabaseAdapter(),
      this.testDatabaseSchema(),
      this.testPerformanceBenchmarks()
    ]);

    // Determine overall system status
    const componentStatuses = [
      enhancedMemoryHealth.status,
      ollamaHealth.status,
      databaseHealth.status,
      schemaHealth.status,
      performanceHealth.status
    ];

    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (componentStatuses.includes('critical')) {
      overallStatus = 'critical';
    } else if (componentStatuses.includes('warning')) {
      overallStatus = 'warning';
    }

    // Generate performance metrics
    const performanceMetrics = await this.gatherPerformanceMetrics();

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      enhancedMemoryHealth,
      ollamaHealth,
      databaseHealth,
      schemaHealth,
      performanceHealth
    }, performanceMetrics);

    const report: SystemHealthReport = {
      overall_status: overallStatus,
      components: {
        enhanced_memory_system: enhancedMemoryHealth,
        ollama_embedding_service: ollamaHealth,
        database_adapter: databaseHealth,
        database_schema: schemaHealth,
        performance_benchmarks: performanceHealth
      },
      performance_metrics: performanceMetrics,
      recommendations,
      timestamp: new Date().toISOString()
    };

    const duration = Date.now() - startTime;
    console.log(`Health check completed in ${duration}ms - Status: ${overallStatus.toUpperCase()}`);

    return report;
  }

  /**
   * Test Enhanced Memory System initialization and basic operations
   */
  private async testEnhancedMemorySystem(): Promise<ComponentHealth> {
    const tests: TestResult[] = [];

    try {
      // Test 1: System initialization
      let testStart = performance.now();
      const initResult = await this.memorySystem.initialize();
      tests.push({
        test_name: 'system_initialization',
        passed: initResult.success,
        duration_ms: performance.now() - testStart,
        error_message: initResult.success ? undefined : initResult.error,
        details: initResult.data
      });

      if (!initResult.success) {
        return {
          status: 'critical',
          message: 'Enhanced Memory System failed to initialize',
          test_results: tests
        };
      }

      // Test 2: Memory storage
      testStart = performance.now();
      const storageResult = await this.memorySystem.storeMemory({
        content: 'Test memory content for health check validation',
        contentType: 'context',
        projectId: 1,
        metadata: { test: true, timestamp: Date.now() }
      });
      tests.push({
        test_name: 'memory_storage',
        passed: storageResult.success,
        duration_ms: performance.now() - testStart,
        error_message: storageResult.success ? undefined : storageResult.error
      });

      // Test 3: Memory search
      testStart = performance.now();
      const searchResult = await this.memorySystem.searchMemories({
        query: 'test memory content validation',
        projectId: 1,
        limit: 5
      });
      tests.push({
        test_name: 'memory_search',
        passed: searchResult.success,
        duration_ms: performance.now() - testStart,
        error_message: searchResult.success ? undefined : searchResult.error,
        details: { results_count: searchResult.data?.length || 0 }
      });

      // Test 4: Project stats
      testStart = performance.now();
      const statsResult = await this.memorySystem.getProjectStats(1);
      tests.push({
        test_name: 'project_stats',
        passed: statsResult.success,
        duration_ms: performance.now() - testStart,
        error_message: statsResult.success ? undefined : statsResult.error,
        details: statsResult.data
      });

      // Determine component health
      const failedTests = tests.filter(t => !t.passed);
      if (failedTests.length === 0) {
        return {
          status: 'healthy',
          message: 'Enhanced Memory System is operating normally',
          test_results: tests
        };
      } else if (failedTests.length <= 1) {
        return {
          status: 'warning',
          message: `Enhanced Memory System has minor issues: ${failedTests.length} test(s) failed`,
          test_results: tests
        };
      } else {
        return {
          status: 'critical',
          message: `Enhanced Memory System has critical issues: ${failedTests.length} test(s) failed`,
          test_results: tests
        };
      }

    } catch (error) {
      return {
        status: 'critical',
        message: `Enhanced Memory System test failed: ${error}`,
        test_results: tests
      };
    }
  }

  /**
   * Test Ollama embedding service connectivity and performance
   */
  private async testOllamaEmbeddingService(): Promise<ComponentHealth> {
    const tests: TestResult[] = [];

    try {
      // Test 1: Connection test
      let testStart = performance.now();
      const connectionTest = await this.ollamaService.testConnection();
      tests.push({
        test_name: 'ollama_connection',
        passed: connectionTest,
        duration_ms: performance.now() - testStart,
        error_message: connectionTest ? undefined : 'Cannot connect to Ollama service'
      });

      if (!connectionTest) {
        return {
          status: 'critical',
          message: 'Ollama service is not available - check if Ollama is running on localhost:11434',
          test_results: tests
        };
      }

      // Test 2: Embedding generation
      testStart = performance.now();
      const testEmbedding = await this.ollamaService.generateEmbedding('Test embedding generation');
      const embeddingTime = performance.now() - testStart;
      tests.push({
        test_name: 'embedding_generation',
        passed: testEmbedding.length === this.ollamaService.dimensions,
        duration_ms: embeddingTime,
        error_message: testEmbedding.length !== this.ollamaService.dimensions ?
                      `Expected ${this.ollamaService.dimensions} dimensions, got ${testEmbedding.length}` : undefined,
        details: { dimensions: testEmbedding.length, target_time: 100 }
      });

      // Test 3: Similarity calculation
      testStart = performance.now();
      const embedding1 = await this.ollamaService.generateEmbedding('Hello world');
      const embedding2 = await this.ollamaService.generateEmbedding('Hello world');
      const similarity = await this.ollamaService.calculateSimilarity(embedding1, embedding2);
      tests.push({
        test_name: 'similarity_calculation',
        passed: similarity > 0.9, // Should be very similar
        duration_ms: performance.now() - testStart,
        error_message: similarity <= 0.9 ? `Low similarity for identical text: ${similarity}` : undefined,
        details: { similarity_score: similarity }
      });

      // Determine component health
      const failedTests = tests.filter(t => !t.passed);
      const slowEmbedding = embeddingTime > 100; // Target: <100ms

      if (failedTests.length === 0 && !slowEmbedding) {
        return {
          status: 'healthy',
          message: 'Ollama embedding service is operating optimally',
          test_results: tests
        };
      } else if (failedTests.length === 0 && slowEmbedding) {
        return {
          status: 'warning',
          message: `Ollama embedding service is slow: ${embeddingTime.toFixed(1)}ms (target: <100ms)`,
          test_results: tests
        };
      } else {
        return {
          status: 'critical',
          message: `Ollama embedding service has issues: ${failedTests.length} test(s) failed`,
          test_results: tests
        };
      }

    } catch (error) {
      return {
        status: 'critical',
        message: `Ollama service test failed: ${error}`,
        test_results: tests
      };
    }
  }

  /**
   * Test database adapter connectivity and operations
   */
  private async testDatabaseAdapter(): Promise<ComponentHealth> {
    const tests: TestResult[] = [];

    try {
      // Test 1: Database connection
      let testStart = performance.now();
      const connectionTest = this.dbAdapter.get('SELECT 1 as test');
      tests.push({
        test_name: 'database_connection',
        passed: connectionTest?.test === 1,
        duration_ms: performance.now() - testStart,
        error_message: connectionTest?.test !== 1 ? 'Database connection failed' : undefined
      });

      // Test 2: Table existence check
      testStart = performance.now();
      const embeddingsTableExists = this.dbAdapter.tableExists('project_memory_embeddings');
      const clustersTableExists = this.dbAdapter.tableExists('project_memory_clusters');
      tests.push({
        test_name: 'table_existence',
        passed: embeddingsTableExists && clustersTableExists,
        duration_ms: performance.now() - testStart,
        error_message: (!embeddingsTableExists || !clustersTableExists) ?
                      'Required semantic memory tables missing' : undefined,
        details: { embeddings_table: embeddingsTableExists, clusters_table: clustersTableExists }
      });

      // Test 3: Database performance
      testStart = performance.now();
      const performanceTest = this.dbAdapter.all('SELECT COUNT(*) as count FROM project_memory_embeddings');
      const queryTime = performance.now() - testStart;
      tests.push({
        test_name: 'database_performance',
        passed: queryTime < 50, // Target: <50ms
        duration_ms: queryTime,
        error_message: queryTime >= 50 ? `Slow database query: ${queryTime.toFixed(1)}ms` : undefined,
        details: { memory_count: performanceTest[0]?.count || 0 }
      });

      // Determine component health
      const failedTests = tests.filter(t => !t.passed);

      if (failedTests.length === 0) {
        return {
          status: 'healthy',
          message: 'Database adapter is operating normally',
          test_results: tests
        };
      } else if (failedTests.length === 1 && failedTests[0].test_name === 'database_performance') {
        return {
          status: 'warning',
          message: 'Database adapter has performance issues but is functional',
          test_results: tests
        };
      } else {
        return {
          status: 'critical',
          message: `Database adapter has critical issues: ${failedTests.length} test(s) failed`,
          test_results: tests
        };
      }

    } catch (error) {
      return {
        status: 'critical',
        message: `Database adapter test failed: ${error}`,
        test_results: tests
      };
    }
  }

  /**
   * Test database schema and integrity
   */
  private async testDatabaseSchema(): Promise<ComponentHealth> {
    const tests: TestResult[] = [];

    try {
      // Test 1: Schema validation
      let testStart = performance.now();
      const embeddingsSchema = this.dbAdapter.all(`PRAGMA table_info(project_memory_embeddings)`);
      const requiredColumns = ['id', 'project_id', 'content_hash', 'content', 'embedding_vector'];
      const hasRequiredColumns = requiredColumns.every(col =>
        embeddingsSchema.some((s: any) => s.name === col)
      );
      tests.push({
        test_name: 'embeddings_schema_validation',
        passed: hasRequiredColumns,
        duration_ms: performance.now() - testStart,
        error_message: hasRequiredColumns ? undefined : 'Missing required columns in embeddings table',
        details: { columns_found: embeddingsSchema.map((s: any) => s.name) }
      });

      // Test 2: Index validation
      testStart = performance.now();
      const indexes = this.dbAdapter.all(`PRAGMA index_list(project_memory_embeddings)`);
      const hasIndexes = indexes.length > 0;
      tests.push({
        test_name: 'database_indexes',
        passed: hasIndexes,
        duration_ms: performance.now() - testStart,
        error_message: hasIndexes ? undefined : 'No performance indexes found',
        details: { index_count: indexes.length }
      });

      // Test 3: Foreign key constraints
      testStart = performance.now();
      const foreignKeys = this.dbAdapter.get(`PRAGMA foreign_keys`);
      tests.push({
        test_name: 'foreign_key_constraints',
        passed: foreignKeys?.foreign_keys === 1,
        duration_ms: performance.now() - testStart,
        error_message: foreignKeys?.foreign_keys !== 1 ? 'Foreign key constraints not enabled' : undefined
      });

      // Determine component health
      const failedTests = tests.filter(t => !t.passed);

      if (failedTests.length === 0) {
        return {
          status: 'healthy',
          message: 'Database schema is properly configured',
          test_results: tests
        };
      } else if (failedTests.length === 1) {
        return {
          status: 'warning',
          message: 'Database schema has minor configuration issues',
          test_results: tests
        };
      } else {
        return {
          status: 'critical',
          message: 'Database schema has critical configuration issues',
          test_results: tests
        };
      }

    } catch (error) {
      return {
        status: 'critical',
        message: `Database schema test failed: ${error}`,
        test_results: tests
      };
    }
  }

  /**
   * Test system performance benchmarks
   */
  private async testPerformanceBenchmarks(): Promise<ComponentHealth> {
    const tests: TestResult[] = [];

    try {
      const performanceMetrics = await this.gatherPerformanceMetrics();

      // Test 1: Embedding generation performance
      tests.push({
        test_name: 'embedding_performance',
        passed: performanceMetrics.embedding_generation_time < 100,
        duration_ms: performanceMetrics.embedding_generation_time,
        error_message: performanceMetrics.embedding_generation_time >= 100 ?
                      `Slow embedding generation: ${performanceMetrics.embedding_generation_time.toFixed(1)}ms (target: <100ms)` : undefined
      });

      // Test 2: Memory storage performance
      tests.push({
        test_name: 'storage_performance',
        passed: performanceMetrics.memory_storage_time < 50,
        duration_ms: performanceMetrics.memory_storage_time,
        error_message: performanceMetrics.memory_storage_time >= 50 ?
                      `Slow memory storage: ${performanceMetrics.memory_storage_time.toFixed(1)}ms (target: <50ms)` : undefined
      });

      // Test 3: Search performance
      tests.push({
        test_name: 'search_performance',
        passed: performanceMetrics.semantic_search_time < 50,
        duration_ms: performanceMetrics.semantic_search_time,
        error_message: performanceMetrics.semantic_search_time >= 50 ?
                      `Slow semantic search: ${performanceMetrics.semantic_search_time.toFixed(1)}ms (target: <50ms)` : undefined
      });

      // Determine component health
      const failedTests = tests.filter(t => !t.passed);

      if (failedTests.length === 0) {
        return {
          status: 'healthy',
          message: 'All performance benchmarks are meeting targets',
          test_results: tests
        };
      } else if (failedTests.length <= 1) {
        return {
          status: 'warning',
          message: `Performance is below target in ${failedTests.length} area(s)`,
          test_results: tests
        };
      } else {
        return {
          status: 'critical',
          message: `Performance is significantly below target in ${failedTests.length} areas`,
          test_results: tests
        };
      }

    } catch (error) {
      return {
        status: 'critical',
        message: `Performance benchmark test failed: ${error}`,
        test_results: tests
      };
    }
  }

  /**
   * Gather performance metrics
   */
  private async gatherPerformanceMetrics(): Promise<SystemHealthReport['performance_metrics']> {
    // Embedding generation benchmark
    const embeddingStart = performance.now();
    await this.ollamaService.generateEmbedding('Performance benchmark test content');
    const embeddingTime = performance.now() - embeddingStart;

    // Memory storage benchmark
    const storageStart = performance.now();
    await this.memorySystem.storeMemory({
      content: 'Performance benchmark memory storage test',
      contentType: 'context',
      projectId: 1,
      metadata: { benchmark: true }
    });
    const storageTime = performance.now() - storageStart;

    // Search benchmark
    const searchStart = performance.now();
    await this.memorySystem.searchMemories({
      query: 'benchmark test',
      projectId: 1,
      limit: 5
    });
    const searchTime = performance.now() - searchStart;

    // Clustering benchmark (simplified)
    const clusteringStart = performance.now();
    await this.memorySystem.getProjectClusters(1);
    const clusteringTime = performance.now() - clusteringStart;

    return {
      embedding_generation_time: embeddingTime,
      memory_storage_time: storageTime,
      semantic_search_time: searchTime,
      memory_clustering_time: clusteringTime
    };
  }

  /**
   * Generate recommendations based on health check results
   */
  private generateRecommendations(
    components: any,
    performance: SystemHealthReport['performance_metrics']
  ): string[] {
    const recommendations: string[] = [];

    // Ollama service recommendations
    if (components.ollamaHealth.status !== 'healthy') {
      recommendations.push('Ensure Ollama service is running: `ollama serve`');
      recommendations.push('Verify embeddinggemma:300m model is available: `ollama pull embeddinggemma:300m`');
    }

    // Performance recommendations
    if (performance.embedding_generation_time > 100) {
      recommendations.push('Consider upgrading hardware or optimizing Ollama configuration for faster embedding generation');
    }

    if (performance.semantic_search_time > 50) {
      recommendations.push('Database may need optimization - run VACUUM and ANALYZE operations');
      recommendations.push('Consider adding more indexes for frequently searched content types');
    }

    if (performance.memory_clustering_time > 500) {
      recommendations.push('Memory clustering is slow - consider reducing the number of memories per cluster');
    }

    // Database recommendations
    if (components.databaseHealth.status !== 'healthy') {
      recommendations.push('Check database file permissions and disk space');
      recommendations.push('Run database optimization: VACUUM and ANALYZE');
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('System is healthy - no immediate actions required');
      recommendations.push('Consider running periodic health checks to monitor performance trends');
    }

    return recommendations;
  }

  /**
   * Print formatted health report to console
   */
  printHealthReport(report: SystemHealthReport): void {
    console.log('\n=== Enhanced Semantic Memory System Health Report ===');
    console.log(`Overall Status: ${report.overall_status.toUpperCase()}`);
    console.log(`Timestamp: ${report.timestamp}`);
    console.log();

    console.log('Component Health:');
    Object.entries(report.components).forEach(([name, health]) => {
      const status = health.status.toUpperCase().padEnd(8);
      console.log(`  ${name.padEnd(25)}: ${status} - ${health.message}`);
    });

    console.log('\nPerformance Metrics:');
    console.log(`  Embedding Generation: ${report.performance_metrics.embedding_generation_time.toFixed(1)}ms (target: <100ms)`);
    console.log(`  Memory Storage:       ${report.performance_metrics.memory_storage_time.toFixed(1)}ms (target: <50ms)`);
    console.log(`  Semantic Search:      ${report.performance_metrics.semantic_search_time.toFixed(1)}ms (target: <50ms)`);
    console.log(`  Memory Clustering:    ${report.performance_metrics.memory_clustering_time.toFixed(1)}ms (target: <500ms)`);

    if (report.recommendations.length > 0) {
      console.log('\nRecommendations:');
      report.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    }

    console.log('\n=== End Health Report ===\n');
  }
}