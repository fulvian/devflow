/**
 * DevFlow Orchestrator - Main Module
 * 
 * Central hub for DevFlow system integration and coordination
 */

// Import actual implemented components
import { CognitiveMappingSystem } from '../cognitive-mapping/index';
import { ActivityRegistrySystem } from '../activity-registry/index';
import { IntelligentRouter } from '../intelligent-router';
import { MemoryCache } from '../memory-bridge/memory-cache';
import { ContextCompressor } from '../memory-bridge/context-compression';
import { VectorDatabase } from '../semantic-memory/vector-database';
import { CodeRealityCheckAgent } from '../orchestration/verification/code-reality-check-agent';
import { ContinuousVerificationLoop } from '../orchestration/verification/continuous-verification-loop';

// Core interfaces
interface DevFlowConfig {
  taskHierarchy: {
    enabled: boolean;
    databasePath?: string;
  };
  cognitiveMapping: {
    enabled: boolean;
    neo4jConfig?: {
      uri: string;
      username: string;
      password: string;
    };
  };
  memoryBridge: {
    enabled: boolean;
    cacheSize?: number;
    tokenBudget?: number;
  };
  semanticMemory: {
    enabled: boolean;
    persistDirectory?: string;
    collectionName?: string;
  };
  activityRegistry: {
    enabled: boolean;
  };
  verification: {
    enabled: boolean;
    checkInterval?: number;
    inactivityThreshold?: number;
  };
}

interface SystemStatus {
  status: 'initializing' | 'ready' | 'error' | 'shutdown';
  components: {
    taskHierarchy: boolean;
    cognitiveMapping: boolean;
    memoryBridge: boolean;
    semanticMemory: boolean;
    activityRegistry: boolean;
    router: boolean;
    verification: boolean;
  };
  errors?: string[];
  uptime: number;
}

/**
 * Main DevFlow Orchestrator
 * Coordinates all system components
 */
export class DevFlowOrchestrator {
  private config: DevFlowConfig;
  private status: SystemStatus;
  private startTime: number;
  
  // Core components
  private cognitiveMapping?: CognitiveMappingSystem;
  private activityRegistry?: ActivityRegistrySystem;
  private router?: IntelligentRouter;
  private memoryCache?: MemoryCache;
  private contextCompressor?: ContextCompressor;
  private vectorDb?: VectorDatabase;

  // Verification components
  private codeRealityCheckAgent?: CodeRealityCheckAgent;
  private continuousVerificationLoop?: ContinuousVerificationLoop;

  constructor(config: DevFlowConfig) {
    this.config = config;
    this.startTime = Date.now();
    this.status = {
      status: 'initializing',
      components: {
        taskHierarchy: false,
        cognitiveMapping: false,
        memoryBridge: false,
        semanticMemory: false,
        activityRegistry: false,
        router: false,
        verification: false
      },
      uptime: 0
    };
  }

  /**
   * Initialize all enabled components
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing DevFlow Orchestrator...');
      
      // Initialize cognitive mapping
      if (this.config.cognitiveMapping.enabled) {
        this.cognitiveMapping = new CognitiveMappingSystem(
          this.config.cognitiveMapping.neo4jConfig || {
            uri: 'bolt://localhost:7687',
            username: 'neo4j',
            password: 'password'
          }
        );
        await this.cognitiveMapping.initialize();
        this.status.components.cognitiveMapping = true;
        console.log('✅ Cognitive Mapping initialized');
      }

      // Initialize activity registry
      if (this.config.activityRegistry.enabled) {
        this.activityRegistry = new ActivityRegistrySystem({
          maxConcurrentActivities: 10,
          defaultPriority: 5
        });
        this.status.components.activityRegistry = true;
        console.log('✅ Activity Registry initialized');
      }

      // Initialize memory bridge
      if (this.config.memoryBridge.enabled) {
        this.memoryCache = new MemoryCache(
          this.config.memoryBridge.cacheSize || 1000
        );
        this.contextCompressor = new ContextCompressor({
          tokenBudget: this.config.memoryBridge.tokenBudget || 2000,
          recentWeight: 0.8,
          workingWeight: 0.6,
          semanticWeight: 0.4,
          episodicWeight: 0.2
        });
        this.status.components.memoryBridge = true;
        console.log('✅ Memory Bridge initialized');
      }

      // Initialize semantic memory
      if (this.config.semanticMemory.enabled) {
        this.vectorDb = new VectorDatabase({
          persistDirectory: this.config.semanticMemory.persistDirectory || './data/vectors',
          collectionName: this.config.semanticMemory.collectionName || 'devflow_semantic'
        });
        this.status.components.semanticMemory = true;
        console.log('✅ Semantic Memory initialized');
      }

      // Initialize router
      this.router = new IntelligentRouter();
      this.status.components.router = true;
      console.log('✅ Intelligent Router initialized');

      // Initialize verification system
      if (this.config.verification.enabled) {
        this.codeRealityCheckAgent = new CodeRealityCheckAgent({
          gitRepoPath: process.cwd(),
          currentTaskPath: '.claude/state/current_task.json'
        });
        this.continuousVerificationLoop = new ContinuousVerificationLoop();
        await this.continuousVerificationLoop.start();
        this.status.components.verification = true;
        console.log('✅ Verification System initialized');
      }

      this.status.status = 'ready';
      console.log('🎯 DevFlow Orchestrator ready!');
      
    } catch (error) {
      this.status.status = 'error';
      this.status.errors = [error instanceof Error ? error.message : 'Unknown error'];
      console.error('❌ DevFlow initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get system status
   */
  getStatus(): SystemStatus {
    this.status.uptime = Date.now() - this.startTime;
    return { ...this.status };
  }

  /**
   * Execute a task with full system coordination
   */
  async executeTask(taskDescription: string, context?: any): Promise<{
    result: string;
    memoryUpdates: any[];
    cognitiveUpdates: any[];
  }> {
    if (this.status.status !== 'ready') {
      throw new Error('System not ready');
    }

    console.log(`🔄 Executing task: ${taskDescription}`);
    
    // Mock implementation - in real version would coordinate all components
    const result = {
      result: `Task executed: ${taskDescription}`,
      memoryUpdates: [],
      cognitiveUpdates: []
    };

    // Update memory if enabled
    if (this.memoryCache && this.config.memoryBridge.enabled) {
      this.memoryCache.set({
        id: `task-${Date.now()}`,
        content: taskDescription,
        type: 'working',
        importance: 0.8,
        tokens: taskDescription.length,
        timestamp: Date.now()
      });
    }

    console.log('✅ Task completed');
    return result;
  }

  /**
   * Shutdown system gracefully
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down DevFlow Orchestrator...');

    // Shutdown verification system first
    if (this.continuousVerificationLoop) {
      await this.continuousVerificationLoop.stop();
      console.log('✅ Verification System shutdown');
    }

    if (this.cognitiveMapping) {
      await this.cognitiveMapping.shutdown();
    }

    if (this.vectorDb) {
      await this.vectorDb.close();
    }

    if (this.memoryCache) {
      this.memoryCache.clear();
    }

    this.status.status = 'shutdown';
    console.log('✅ DevFlow Orchestrator shutdown complete');
  }

  // Getters for component access
  getCognitiveMapping(): CognitiveMappingSystem | undefined {
    return this.cognitiveMapping;
  }

  getActivityRegistry(): ActivityRegistrySystem | undefined {
    return this.activityRegistry;
  }

  getRouter(): IntelligentRouter | undefined {
    return this.router;
  }

  getMemoryCache(): MemoryCache | undefined {
    return this.memoryCache;
  }

  getVectorDatabase(): VectorDatabase | undefined {
    return this.vectorDb;
  }

  // Verification component getters
  getCodeRealityCheckAgent(): CodeRealityCheckAgent | undefined {
    return this.codeRealityCheckAgent;
  }

  getContinuousVerificationLoop(): ContinuousVerificationLoop | undefined {
    return this.continuousVerificationLoop;
  }

  /**
   * Get verification system status
   */
  getVerificationStatus(): {
    running: boolean;
    lastActivity: number;
    currentTaskName: string | null;
    activeAgents: number;
  } | null {
    return this.continuousVerificationLoop?.getStatus() || null;
  }
}

export default DevFlowOrchestrator;
export type { DevFlowConfig, SystemStatus };