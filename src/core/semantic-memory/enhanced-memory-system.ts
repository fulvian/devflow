/**
 * Enhanced Project Memory System - Phase 4 Complete Integration Service
 * Unified interface for all semantic memory capabilities including advanced intelligence
 * Provides production-ready semantic memory with AI-driven context injection and predictive analytics
 */

import { SemanticMemoryEngine, MemoryContent, MemoryRecord } from './semantic-memory-engine';
import { SemanticSearchEngine, SearchQuery, MemorySearchResult } from './semantic-search-engine';
import { MemoryClusteringEngine, MemoryCluster } from './memory-clustering-engine';
import { OllamaEmbeddingService } from './ollama-embedding-service';
import { MemoryMigrationUtils, ValidationResult, MemorySystemHealth } from './memory-migration-utils';
import { PerformanceTestingUtils, SystemBenchmarkResult } from './performance-testing-utils';
// Phase 4: Advanced Intelligence Imports
import { IntelligentContextInjector, ContextInjectionConfig, IntelligentContext } from './intelligent-context-injector';
import { PredictiveMemorySystem, PredictiveContext, PredictiveRecommendation } from './predictive-memory-system';

export interface EnhancedMemoryConfig {
  enableClustering: boolean;
  enablePerformanceMonitoring: boolean;
  autoMigration: boolean;
  clusteringInterval: number; // in hours
  // Phase 4: Advanced Intelligence Configuration
  enableIntelligentContext: boolean;
  enablePredictiveAnalytics: boolean;
  enableCrossProjectLearning: boolean;
  adaptiveThresholds: boolean;
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

  // Phase 4: Advanced Intelligence Components
  private contextInjector: IntelligentContextInjector;
  private predictiveSystem: PredictiveMemorySystem;

  private config: EnhancedMemoryConfig;
  private isInitialized: boolean = false;

  constructor(config?: Partial<EnhancedMemoryConfig>) {
    this.config = {
      enableClustering: true,
      enablePerformanceMonitoring: true,
      autoMigration: true,
      clusteringInterval: 24, // 24 hours
      // Phase 4: Default Advanced Intelligence Configuration
      enableIntelligentContext: true,
      enablePredictiveAnalytics: true,
      enableCrossProjectLearning: false, // Conservative default
      adaptiveThresholds: true,
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

    // Phase 4: Initialize Advanced Intelligence Components
    this.contextInjector = new IntelligentContextInjector();
    this.predictiveSystem = new PredictiveMemorySystem();
  }

  /**
   * Initialize the enhanced memory system
   */
  async initialize(): Promise<MemoryOperationResult<ValidationResult>> {
    const startTime = performance.now();

    try {
      console.log('Initializing Enhanced Project Memory System (Phase 4 - Complete)...');

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

  // ====================================================================
  // Phase 4: Advanced Intelligence & Learning Methods
  // ====================================================================

  /**
   * Phase 4: Get intelligent context with AI-driven analysis
   * Context7: Intelligent context injection with adaptive learning
   */
  async getIntelligentContext(
    config: ContextInjectionConfig
  ): Promise<MemoryOperationResult<IntelligentContext>> {
    if (!this.isInitialized) {
      return { success: false, error: 'System not initialized' };
    }

    if (!this.config.enableIntelligentContext) {
      return { success: false, error: 'Intelligent context disabled in configuration' };
    }

    const startTime = performance.now();

    try {
      const context = await this.contextInjector.injectIntelligentContext(config);

      return {
        success: true,
        data: context,
        performanceMetrics: {
          duration: performance.now() - startTime,
          memoryUsed: 0 // Would implement actual memory measurement
        }
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Intelligent context injection failed: ${message}`
      };
    }
  }

  /**
   * Phase 4: Get predictive context with AI-driven recommendations
   * Context7: Proactive suggestions and learning pattern recognition
   */
  async getPredictiveContext(
    config: ContextInjectionConfig
  ): Promise<MemoryOperationResult<PredictiveContext>> {
    if (!this.isInitialized) {
      return { success: false, error: 'System not initialized' };
    }

    if (!this.config.enablePredictiveAnalytics) {
      return { success: false, error: 'Predictive analytics disabled in configuration' };
    }

    const startTime = performance.now();

    try {
      const context = await this.predictiveSystem.generatePredictiveContext(config);

      return {
        success: true,
        data: context,
        performanceMetrics: {
          duration: performance.now() - startTime,
          memoryUsed: 0
        }
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Predictive context generation failed: ${message}`
      };
    }
  }

  /**
   * Phase 4: Enhanced search with intelligent context integration
   * Combines semantic search with AI-driven context analysis
   */
  async searchWithIntelligentContext(
    query: string,
    projectId: number,
    options?: {
      sessionContext?: string;
      activeTask?: string;
      codeContext?: string[];
      userIntent?: 'development' | 'debugging' | 'learning' | 'planning';
      includeRecommendations?: boolean;
    }
  ): Promise<MemoryOperationResult<{
    searchResults: MemorySearchResult[];
    intelligentContext?: IntelligentContext;
    recommendations?: PredictiveRecommendation[];
  }>> {
    if (!this.isInitialized) {
      return { success: false, error: 'System not initialized' };
    }

    const startTime = performance.now();

    try {
      // Phase 4: Standard search
      const searchResult = await this.searchMemories({
        query,
        projectId,
        limit: options?.includeRecommendations ? 8 : 10,
        similarityThreshold: this.config.adaptiveThresholds ? undefined : 0.3 // Let intelligent context decide
      });

      if (!searchResult.success || !searchResult.data) {
        return {
          success: false,
          error: searchResult.error || 'Search failed',
          performanceMetrics: searchResult.performanceMetrics
        };
      }

      const result: any = {
        searchResults: searchResult.data
      };

      // Phase 4: Add intelligent context if enabled
      if (this.config.enableIntelligentContext && options) {
        const contextConfig: ContextInjectionConfig = {
          projectId,
          sessionContext: options.sessionContext,
          activeTask: options.activeTask,
          codeContext: options.codeContext,
          userIntent: options.userIntent,
          adaptiveThreshold: this.config.adaptiveThresholds,
          crossProjectLearning: this.config.enableCrossProjectLearning
        };

        const intelligentResult = await this.getIntelligentContext(contextConfig);
        if (intelligentResult.success) {
          result.intelligentContext = intelligentResult.data;
        }

        // Phase 4: Add predictive recommendations if requested
        if (options.includeRecommendations && this.config.enablePredictiveAnalytics) {
          const predictiveResult = await this.getPredictiveContext(contextConfig);
          if (predictiveResult.success) {
            result.recommendations = predictiveResult.data?.upcomingNeeds?.slice(0, 5);
          }
        }
      }

      return {
        success: true,
        data: result,
        performanceMetrics: {
          duration: performance.now() - startTime,
          memoryUsed: 0
        }
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Intelligent search failed: ${message}`
      };
    }
  }

  /**
   * Phase 4: Get learning insights and analytics
   * Context7: Learning pattern analysis and performance metrics
   */
  async getLearningInsights(projectId: number): Promise<MemoryOperationResult<{
    learningPatterns: any;
    predictiveInsights: any;
    performanceMetrics: any;
  }>> {
    if (!this.isInitialized) {
      return { success: false, error: 'System not initialized' };
    }

    try {
      const [learningInsights, predictiveInsights] = await Promise.all([
        this.contextInjector.getLearningInsights(projectId),
        this.predictiveSystem.getPredictiveInsights(projectId)
      ]);

      // Get performance benchmarks
      const benchmarkResults = await this.performanceUtils.runSystemBenchmark(projectId);

      return {
        success: true,
        data: {
          learningPatterns: learningInsights,
          predictiveInsights,
          performanceMetrics: benchmarkResults
        }
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Learning insights failed: ${message}`
      };
    }
  }

  /**
   * Phase 4: Get system configuration and capabilities
   */
  getSystemCapabilities(): {
    phase: string;
    capabilities: string[];
    configuration: EnhancedMemoryConfig;
    version: string;
  } {
    const capabilities = [
      'Semantic Memory Storage',
      'Vector Similarity Search',
      'K-means Clustering',
      'Performance Benchmarking'
    ];

    // Phase 4: Advanced capabilities
    if (this.config.enableIntelligentContext) {
      capabilities.push('Intelligent Context Injection');
    }

    if (this.config.enablePredictiveAnalytics) {
      capabilities.push('Predictive Analytics');
    }

    if (this.config.enableCrossProjectLearning) {
      capabilities.push('Cross-Project Learning');
    }

    if (this.config.adaptiveThresholds) {
      capabilities.push('Adaptive Threshold Optimization');
    }

    return {
      phase: 'Phase 4: Advanced Intelligence & Learning',
      capabilities,
      configuration: this.config,
      version: '4.0.0'
    };
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