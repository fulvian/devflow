/**
 * Enhanced Project Memory System - Phase 1 Integration Service
 * Unified interface for all Phase 1 semantic memory capabilities
 * Provides production-ready semantic memory with Ollama integration
 */

import { SemanticMemoryEngine, MemoryContent, MemoryRecord } from './semantic-memory-engine';
import { SemanticSearchEngine, SearchQuery, MemorySearchResult } from './semantic-search-engine';
import { MemoryClusteringEngine, MemoryCluster } from './memory-clustering-engine';
import { OllamaEmbeddingService } from './ollama-embedding-service';
import { MemoryMigrationUtils, ValidationResult, MemorySystemHealth } from './memory-migration-utils';
import { PerformanceTestingUtils, SystemBenchmarkResult } from './performance-testing-utils';

export interface EnhancedMemoryConfig {
  enableClustering: boolean;
  enablePerformanceMonitoring: boolean;
  autoMigration: boolean;
  clusteringInterval: number; // in hours
  performanceThresholds: {
    searchTime: number;
    embeddingTime: number;
    storageTime: number;
  };
}

export interface MemoryOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  performanceMetrics?: {
    duration: number;
    memoryUsed: number;
  };
}

export interface ProjectMemoryStats {
  totalMemories: number;
  totalClusters: number;
  averageSimilarity: number;
  storageEfficiency: number;
  lastClusteringUpdate: Date | null;
}

export class EnhancedProjectMemorySystem {
  private memoryEngine: SemanticMemoryEngine;
  private searchEngine: SemanticSearchEngine;
  private clusteringEngine: MemoryClusteringEngine;
  private embedding: OllamaEmbeddingService;
  private migrationUtils: MemoryMigrationUtils;
  private performanceUtils: PerformanceTestingUtils;

  private config: EnhancedMemoryConfig;
  private isInitialized: boolean = false;

  constructor(config?: Partial<EnhancedMemoryConfig>) {
    this.config = {
      enableClustering: true,
      enablePerformanceMonitoring: true,
      autoMigration: true,
      clusteringInterval: 24, // 24 hours
      performanceThresholds: {
        searchTime: 50, // ms
        embeddingTime: 100, // ms
        storageTime: 50 // ms
      },
      ...config
    };

    this.memoryEngine = new SemanticMemoryEngine();
    this.searchEngine = new SemanticSearchEngine();
    this.clusteringEngine = new MemoryClusteringEngine();
    this.embedding = new OllamaEmbeddingService();
    this.migrationUtils = new MemoryMigrationUtils();
    this.performanceUtils = new PerformanceTestingUtils();
  }

  /**
   * Initialize the enhanced memory system
   */
  async initialize(): Promise<MemoryOperationResult<ValidationResult>> {
    const startTime = performance.now();

    try {
      console.log('Initializing Enhanced Project Memory System (Phase 1)...');

      // Validate system requirements
      const validation = await this.migrationUtils.validateSystem();

      if (!validation.schemaValid || !validation.embeddingServiceHealthy || !validation.databaseConnected) {
        return {
          success: false,
          data: validation,
          error: 'System validation failed: ' + validation.issues.join(', ')
        };
      }

      // Run auto-migration if enabled
      if (this.config.autoMigration) {
        const migration = await this.migrationUtils.migrateExistingData();
        console.log(`Migration completed: ${migration.migratedCount} records migrated`);
      }

      this.isInitialized = true;
      const duration = performance.now() - startTime;

      console.log(`Enhanced Memory System initialized successfully in ${duration.toFixed(2)}ms`);

      return {
        success: true,
        data: validation,
        performanceMetrics: {
          duration,
          memoryUsed: process.memoryUsage().heapUsed
        }
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Initialization failed: ${message}`
      };
    }
  }

  /**
   * Store memory with automatic clustering update
   */
  async storeMemory(
    memoryContent: MemoryContent
  ): Promise<MemoryOperationResult<string>> {
    if (!this.isInitialized) {
      return { success: false, error: 'System not initialized' };
    }

    const startTime = performance.now();

    try {
      const contentHash = await this.memoryEngine.storeMemory(memoryContent);

      // Trigger clustering update if enabled
      if (this.config.enableClustering) {
        this.scheduleClusteringUpdate(memoryContent.projectId);
      }

      const duration = performance.now() - startTime;

      // Check performance threshold
      if (this.config.enablePerformanceMonitoring && duration > this.config.performanceThresholds.storageTime) {
        console.warn(`Storage operation exceeded threshold: ${duration.toFixed(2)}ms`);
      }

      return {
        success: true,
        data: contentHash,
        performanceMetrics: {
          duration,
          memoryUsed: process.memoryUsage().heapUsed
        }
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Memory storage failed: ${message}`
      };
    }
  }

  /**
   * Enhanced semantic search with performance monitoring
   */
  async searchMemories(
    searchQuery: SearchQuery
  ): Promise<MemoryOperationResult<MemorySearchResult[]>> {
    if (!this.isInitialized) {
      return { success: false, error: 'System not initialized' };
    }

    const startTime = performance.now();

    try {
      const results = await this.searchEngine.search(searchQuery);
      const duration = performance.now() - startTime;

      // Check performance threshold
      if (this.config.enablePerformanceMonitoring && duration > this.config.performanceThresholds.searchTime) {
        console.warn(`Search operation exceeded threshold: ${duration.toFixed(2)}ms`);
      }

      return {
        success: true,
        data: results,
        performanceMetrics: {
          duration,
          memoryUsed: process.memoryUsage().heapUsed
        }
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Search failed: ${message}`
      };
    }
  }

  /**
   * Get project memory clusters with automatic refresh
   */
  async getProjectClusters(projectId: number): Promise<MemoryOperationResult<MemoryCluster[]>> {
    if (!this.isInitialized) {
      return { success: false, error: 'System not initialized' };
    }

    try {
      const clusters = await this.clusteringEngine.clusterProjectMemories(projectId);

      return {
        success: true,
        data: clusters
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Clustering failed: ${message}`
      };
    }
  }

  /**
   * Get comprehensive project memory statistics
   */
  async getProjectStats(projectId: number): Promise<MemoryOperationResult<ProjectMemoryStats>> {
    if (!this.isInitialized) {
      return { success: false, error: 'System not initialized' };
    }

    try {
      const [memoryCount, clusters, memories] = await Promise.all([
        this.memoryEngine.getMemoryCount(projectId),
        this.clusteringEngine.clusterProjectMemories(projectId),
        this.memoryEngine.getProjectMemories(projectId)
      ]);

      // Calculate average similarity (simplified metric)
      let totalSimilarity = 0;
      let comparisons = 0;

      for (let i = 0; i < Math.min(memories.length, 10); i++) {
        for (let j = i + 1; j < Math.min(memories.length, 10); j++) {
          const similarity = await this.embedding.calculateSimilarity(
            memories[i].embeddingVector,
            memories[j].embeddingVector
          );
          totalSimilarity += similarity;
          comparisons++;
        }
      }

      const averageSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 0;
      const storageEfficiency = memories.length > 0 ? (clusters.length / memories.length) : 0;

      return {
        success: true,
        data: {
          totalMemories: memoryCount,
          totalClusters: clusters.length,
          averageSimilarity,
          storageEfficiency,
          lastClusteringUpdate: clusters.length > 0 ? clusters[0].lastUpdated : null
        }
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Stats calculation failed: ${message}`
      };
    }
  }

  /**
   * Run system health check and benchmarking
   */
  async runHealthCheck(projectId?: number): Promise<MemoryOperationResult<{
    systemHealth: MemorySystemHealth;
    benchmarkResults?: SystemBenchmarkResult;
  }>> {
    if (!this.isInitialized) {
      return { success: false, error: 'System not initialized' };
    }

    try {
      const systemHealth = await this.migrationUtils.getSystemHealth();

      let benchmarkResults: SystemBenchmarkResult | undefined;

      if (this.config.enablePerformanceMonitoring && projectId) {
        benchmarkResults = await this.performanceUtils.runSystemBenchmark(projectId);
      }

      return {
        success: true,
        data: {
          systemHealth,
          benchmarkResults
        }
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Health check failed: ${message}`
      };
    }
  }

  /**
   * Get memory recommendations for improved context injection
   */
  async getContextRecommendations(
    projectId: number,
    currentContext: string,
    maxRecommendations: number = 5
  ): Promise<MemoryOperationResult<MemorySearchResult[]>> {
    if (!this.isInitialized) {
      return { success: false, error: 'System not initialized' };
    }

    try {
      const recommendations = await this.searchEngine.getSearchRecommendations(
        projectId,
        currentContext,
        {
          maxRecommendations,
          minSimilarity: 0.6,
          diversityFactor: 0.8
        }
      );

      return {
        success: true,
        data: recommendations
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Context recommendations failed: ${message}`
      };
    }
  }

  /**
   * Schedule clustering update (debounced)
   */
  private clusteringTimeouts: Map<number, NodeJS.Timeout> = new Map();

  private scheduleClusteringUpdate(projectId: number): void {
    // Cancel existing timeout for this project
    const existingTimeout = this.clusteringTimeouts.get(projectId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule new clustering update (debounced by 5 minutes)
    const timeout = setTimeout(async () => {
      try {
        await this.clusteringEngine.clusterProjectMemories(projectId);
        this.clusteringTimeouts.delete(projectId);
      } catch (error) {
        console.warn(`Scheduled clustering update failed for project ${projectId}:`, error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    this.clusteringTimeouts.set(projectId, timeout);
  }

  /**
   * Cleanup and shutdown system
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down Enhanced Project Memory System...');

    // Cancel all scheduled clustering updates
    this.clusteringTimeouts.forEach((timeout) => {
      clearTimeout(timeout);
    });
    this.clusteringTimeouts.clear();

    // Optimize database before shutdown
    try {
      await this.migrationUtils.optimizeDatabase();
      console.log('Database optimization completed');
    } catch (error) {
      console.warn('Database optimization failed:', error);
    }

    this.isInitialized = false;
    console.log('Enhanced Project Memory System shutdown completed');
  }
}