/**
 * Core Unified Orchestrator for coordinating Gemini, Codex, and Qwen platforms
 *
 * This module provides the central coordination point for multi-platform orchestration
 * with dynamic platform management, health monitoring, and task coordination.
 */

// Core interfaces and types
export interface PlatformConfig {
  id: string;
  name: string;
  endpoint: string;
  apiKey?: string;
  enabled: boolean;
  weight: number; // For load balancing
  capabilities: string[];
}

export interface PlatformHealth {
  id: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  responseTime: number;
  error?: string;
  metrics: {
    cpu: number;
    memory: number;
    requestsPerSecond: number;
  };
}

export interface Task {
  id: string;
  type: string;
  payload: any;
  priority: 'low' | 'medium' | 'high';
  deadline?: Date;
  platformPreferences?: string[];
}

export interface TaskResult {
  taskId: string;
  platformId: string;
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
}

export interface PerformanceMetrics {
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  averageResponseTime: number;
  platformDistribution: Record<string, number>;
}

// Event types
export type OrchestratorEvent =
  | { type: 'platform_registered'; platformId: string }
  | { type: 'platform_removed'; platformId: string }
  | { type: 'platform_health_changed'; platformId: string; status: PlatformHealth['status'] }
  | { type: 'task_submitted'; taskId: string }
  | { type: 'task_completed'; taskId: string; platformId: string }
  | { type: 'task_failed'; taskId: string; error: string }
  | { type: 'error'; error: Error };

// Event listener callback
export type EventListener = (event: OrchestratorEvent) => void;

/**
 * Platform Registry for dynamic platform management
 */
export class PlatformRegistry {
  private platforms: Map<string, PlatformConfig> = new Map();
  private healthStatus: Map<string, PlatformHealth> = new Map();

  /**
   * Register a new platform
   */
  registerPlatform(config: PlatformConfig): void {
    this.platforms.set(config.id, config);
    this.healthStatus.set(config.id, {
      id: config.id,
      status: 'unknown',
      lastCheck: new Date(0),
      responseTime: 0,
      metrics: {
        cpu: 0,
        memory: 0,
        requestsPerSecond: 0
      }
    });
  }

  /**
   * Remove a platform from registry
   */
  removePlatform(platformId: string): boolean {
    const removed = this.platforms.delete(platformId);
    this.healthStatus.delete(platformId);
    return removed;
  }

  /**
   * Get platform configuration
   */
  getPlatform(platformId: string): PlatformConfig | undefined {
    return this.platforms.get(platformId);
  }

  /**
   * List all registered platforms
   */
  listPlatforms(): PlatformConfig[] {
    return Array.from(this.platforms.values());
  }

  /**
   * Update platform health status
   */
  updateHealth(platformId: string, health: PlatformHealth): void {
    if (this.platforms.has(platformId)) {
      this.healthStatus.set(platformId, health);
    }
  }

  /**
   * Get platform health status
   */
  getHealth(platformId: string): PlatformHealth | undefined {
    return this.healthStatus.get(platformId);
  }

  /**
   * Get all health statuses
   */
  getAllHealth(): PlatformHealth[] {
    return Array.from(this.healthStatus.values());
  }

  /**
   * Get healthy platforms based on capabilities
   */
  getHealthyPlatforms(capabilities?: string[]): PlatformConfig[] {
    const now = new Date();
    const healthyPlatforms: PlatformConfig[] = [];

    for (const [id, config] of this.platforms.entries()) {
      if (!config.enabled) continue;

      const health = this.healthStatus.get(id);
      if (!health) continue;

      // Check if health check is recent (within 5 minutes)
      const isRecent = now.getTime() - health.lastCheck.getTime() < 5 * 60 * 1000;
      const isHealthy = health.status === 'healthy' ||
                       (health.status === 'degraded' && isRecent);

      if (isHealthy) {
        // Check capabilities if specified
        if (!capabilities || capabilities.every(cap => config.capabilities.includes(cap))) {
          healthyPlatforms.push(config);
        }
      }
    }

    return healthyPlatforms;
  }
}

/**
 * Health Aggregator for unified monitoring
 */
export class HealthAggregator {
  private registry: PlatformRegistry;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(registry: PlatformRegistry) {
    this.registry = registry;
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(intervalMs: number = 30000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.performHealthChecks();
    }, intervalMs);
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Perform health checks on all platforms
   */
  async performHealthChecks(): Promise<void> {
    const platforms = this.registry.listPlatforms();

    await Promise.all(platforms.map(async (platform) => {
      try {
        const health = await this.checkPlatformHealth(platform);
        this.registry.updateHealth(platform.id, health);
      } catch (error) {
        this.registry.updateHealth(platform.id, {
          id: platform.id,
          status: 'unhealthy',
          lastCheck: new Date(),
          responseTime: 0,
          error: error instanceof Error ? error.message : String(error),
          metrics: {
            cpu: 0,
            memory: 0,
            requestsPerSecond: 0
          }
        });
      }
    }));
  }

  /**
   * Check individual platform health
   */
  private async checkPlatformHealth(platform: PlatformConfig): Promise<PlatformHealth> {
    const startTime = Date.now();

    try {
      // In a real implementation, this would make an actual health check request
      // to the platform's health endpoint
      const response = await fetch(`${platform.endpoint}/health`, {
        method: 'GET',
        headers: platform.apiKey ? {
          'Authorization': `Bearer ${platform.apiKey}`
        } : {},
        signal: AbortSignal.timeout(5000)
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`Health check failed with status ${response.status}`);
      }

      const data = await response.json() as any;

      return {
        id: platform.id,
        status: this.determineHealthStatus(data, responseTime),
        lastCheck: new Date(),
        responseTime,
        metrics: {
          cpu: data.cpu || 0,
          memory: data.memory || 0,
          requestsPerSecond: data.rps || 0
        }
      };
    } catch (error) {
      return {
        id: platform.id,
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          cpu: 0,
          memory: 0,
          requestsPerSecond: 0
        }
      };
    }
  }

  /**
   * Determine health status based on metrics
   */
  private determineHealthStatus(data: any, responseTime: number): PlatformHealth['status'] {
    // Example health determination logic
    if (responseTime > 5000) return 'degraded';
    if (data.status === 'healthy') return 'healthy';
    if (data.status === 'degraded') return 'degraded';
    return 'unhealthy';
  }

  /**
   * Get aggregated system health
   */
  getSystemHealth(): {
    overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    healthyPlatforms: number;
    totalPlatforms: number;
    issues: string[];
  } {
    const platforms = this.registry.listPlatforms();
    const healthStatuses = platforms.map(p => this.registry.getHealth(p.id));

    const healthyCount = healthStatuses.filter(h => h?.status === 'healthy').length;
    const degradedCount = healthStatuses.filter(h => h?.status === 'degraded').length;
    const unhealthyCount = healthStatuses.filter(h => h?.status === 'unhealthy').length;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    }

    const issues: string[] = [];
    healthStatuses.forEach(health => {
      if (health && health.status !== 'healthy' && health.error) {
        issues.push(`Platform ${health.id}: ${health.error}`);
      }
    });

    return {
      overallStatus,
      healthyPlatforms: healthyCount,
      totalPlatforms: platforms.length,
      issues
    };
  }
}

/**
 * Task Coordinator for distributing tasks across platforms
 */
export class TaskCoordinator {
  private registry: PlatformRegistry;
  private taskQueue: Task[] = [];
  private activeTasks: Map<string, { task: Task; startTime: number }> = new Map();
  private taskResults: TaskResult[] = [];

  constructor(registry: PlatformRegistry) {
    this.registry = registry;
  }

  /**
   * Submit a task for execution
   */
  async submitTask(task: Task): Promise<TaskResult> {
    // Validate task
    if (!task.id || !task.type) {
      throw new Error('Task must have an ID and type');
    }

    // Find suitable platform
    const platform = this.selectPlatformForTask(task);
    if (!platform) {
      throw new Error(`No suitable platform found for task ${task.id}`);
    }

    // Track active task
    this.activeTasks.set(task.id, {
      task,
      startTime: Date.now()
    });

    try {
      // Execute task on selected platform
      const result = await this.executeTaskOnPlatform(task, platform);

      // Record successful result
      this.taskResults.push(result);
      this.activeTasks.delete(task.id);

      return result;
    } catch (error) {
      // Record failed result
      const result: TaskResult = {
        taskId: task.id,
        platformId: platform.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - (this.activeTasks.get(task.id)?.startTime || Date.now())
      };

      this.taskResults.push(result);
      this.activeTasks.delete(task.id);

      throw error;
    }
  }

  /**
   * Select the best platform for a task
   */
  private selectPlatformForTask(task: Task): PlatformConfig | null {
    // Get healthy platforms that match required capabilities
    const healthyPlatforms = this.registry.getHealthyPlatforms();

    if (healthyPlatforms.length === 0) {
      return null;
    }

    // If task has platform preferences, try those first
    if (task.platformPreferences && task.platformPreferences.length > 0) {
      const preferredPlatforms = healthyPlatforms.filter(p =>
        task.platformPreferences!.includes(p.id)
      );

      if (preferredPlatforms.length > 0) {
        return this.selectWeightedPlatform(preferredPlatforms);
      }
    }

    // Otherwise select from all healthy platforms
    return this.selectWeightedPlatform(healthyPlatforms);
  }

  /**
   * Select platform based on weights (for load balancing)
   */
  private selectWeightedPlatform(platforms: PlatformConfig[]): PlatformConfig {
    // Simple weighted random selection
    const totalWeight = platforms.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;

    for (const platform of platforms) {
      random -= platform.weight;
      if (random <= 0) {
        return platform;
      }
    }

    // Fallback to first platform
    return platforms[0];
  }

  /**
   * Execute task on a specific platform
   */
  private async executeTaskOnPlatform(task: Task, platform: PlatformConfig): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${platform.endpoint}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(platform.apiKey ? {
            'Authorization': `Bearer ${platform.apiKey}`
          } : {})
        },
        body: JSON.stringify(task),
        signal: AbortSignal.timeout(30000)
      });

      const executionTime = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`Task execution failed with status ${response.status}`);
      }

      const resultData = await response.json();

      return {
        taskId: task.id,
        platformId: platform.id,
        success: true,
        result: resultData,
        executionTime
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get task execution statistics
   */
  getTaskStats(): {
    queued: number;
    active: number;
    completed: number;
    failed: number;
  } {
    const completedTasks = this.taskResults.filter(r => r.success).length;
    const failedTasks = this.taskResults.filter(r => !r.success).length;

    return {
      queued: this.taskQueue.length,
      active: this.activeTasks.size,
      completed: completedTasks,
      failed: failedTasks
    };
  }

  /**
   * Get task results for access by metrics aggregator
   */
  getTaskResults(): TaskResult[] {
    return [...this.taskResults];
  }
}

/**
 * Performance Metrics Aggregator
 */
export class MetricsAggregator {
  private taskCoordinator: TaskCoordinator;
  private registry: PlatformRegistry;

  constructor(taskCoordinator: TaskCoordinator, registry: PlatformRegistry) {
    this.taskCoordinator = taskCoordinator;
    this.registry = registry;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const results = this.taskCoordinator.getTaskResults();

    const totalTasks = results.length;
    const successfulTasks = results.filter(r => r.success).length;
    const failedTasks = totalTasks - successfulTasks;

    const totalResponseTime = results.reduce((sum, r) => sum + r.executionTime, 0);
    const averageResponseTime = totalTasks > 0 ? totalResponseTime / totalTasks : 0;

    // Calculate platform distribution
    const platformDistribution: Record<string, number> = {};
    results.forEach(result => {
      if (result.success) {
        platformDistribution[result.platformId] =
          (platformDistribution[result.platformId] || 0) + 1;
      }
    });

    return {
      totalTasks,
      successfulTasks,
      failedTasks,
      averageResponseTime,
      platformDistribution
    };
  }

  /**
   * Get platform-specific metrics
   */
  getPlatformMetrics(platformId: string): {
    taskCount: number;
    successRate: number;
    averageResponseTime: number;
  } {
    const results = this.taskCoordinator.getTaskResults();
    const platformResults = results.filter(r => r.platformId === platformId);

    const taskCount = platformResults.length;
    const successfulTasks = platformResults.filter(r => r.success).length;
    const successRate = taskCount > 0 ? successfulTasks / taskCount : 0;

    const totalResponseTime = platformResults.reduce((sum, r) => sum + r.executionTime, 0);
    const averageResponseTime = taskCount > 0 ? totalResponseTime / taskCount : 0;

    return {
      taskCount,
      successRate,
      averageResponseTime
    };
  }
}

/**
 * Main Unified Orchestrator
 */
export class UnifiedOrchestrator {
  private registry: PlatformRegistry;
  private healthAggregator: HealthAggregator;
  private taskCoordinator: TaskCoordinator;
  private metricsAggregator: MetricsAggregator;
  private eventListeners: EventListener[] = [];
  private isRunning: boolean = false;

  constructor() {
    this.registry = new PlatformRegistry();
    this.healthAggregator = new HealthAggregator(this.registry);
    this.taskCoordinator = new TaskCoordinator(this.registry);
    this.metricsAggregator = new MetricsAggregator(this.taskCoordinator, this.registry);
  }

  /**
   * Start the orchestrator
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Orchestrator is already running');
    }

    this.isRunning = true;
    this.healthAggregator.startHealthChecks();
    this.emitEvent({ type: 'platform_health_changed', platformId: 'system', status: 'healthy' });
  }

  /**
   * Stop the orchestrator
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Orchestrator is not running');
    }

    this.isRunning = false;
    this.healthAggregator.stopHealthChecks();
    this.emitEvent({ type: 'platform_health_changed', platformId: 'system', status: 'unhealthy' });
  }

  /**
   * Register a new platform
   */
  registerPlatform(config: PlatformConfig): void {
    this.registry.registerPlatform(config);
    this.emitEvent({ type: 'platform_registered', platformId: config.id });
  }

  /**
   * Remove a platform
   */
  removePlatform(platformId: string): boolean {
    const result = this.registry.removePlatform(platformId);
    if (result) {
      this.emitEvent({ type: 'platform_removed', platformId });
    }
    return result;
  }

  /**
   * Submit a task for execution
   */
  async submitTask(task: Task): Promise<TaskResult> {
    this.emitEvent({ type: 'task_submitted', taskId: task.id });

    try {
      const result = await this.taskCoordinator.submitTask(task);
      this.emitEvent({
        type: 'task_completed',
        taskId: task.id,
        platformId: result.platformId
      });
      return result;
    } catch (error) {
      this.emitEvent({
        type: 'task_failed',
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetrics {
    return this.metricsAggregator.getMetrics();
  }

  /**
   * Get system health
   */
  getSystemHealth() {
    return this.healthAggregator.getSystemHealth();
  }

  /**
   * Get platform health
   */
  getPlatformHealth(platformId: string): PlatformHealth | undefined {
    return this.registry.getHealth(platformId);
  }

  /**
   * List all platforms
   */
  listPlatforms(): PlatformConfig[] {
    return this.registry.listPlatforms();
  }

  /**
   * Add event listener
   */
  addEventListener(listener: EventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: EventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Emit event to all listeners
   */
  private emitEvent(event: OrchestratorEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    });
  }

  /**
   * Get task statistics
   */
  getTaskStats() {
    return this.taskCoordinator.getTaskStats();
  }

  /**
   * Check if orchestrator is running
   */
  isOrchestratorRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Assess task complexity using intelligent algorithm (migrated from orchestration-hook.js)
   */
  assessTaskComplexity(taskDescription: string): number {
    const complexKeywords = ['architecture', 'design', 'strategy', 'complex', 'algorithm', 'optimization', 'system'];
    const simpleKeywords = ['fix', 'update', 'change', 'simple', 'quick', 'bash', 'list'];

    let complexity = 0.5; // base

    complexKeywords.forEach(keyword => {
      if (taskDescription.toLowerCase().includes(keyword)) complexity += 0.15;
    });

    simpleKeywords.forEach(keyword => {
      if (taskDescription.toLowerCase().includes(keyword)) complexity -= 0.15;
    });

    return Math.max(0.1, Math.min(1.0, complexity));
  }

  /**
   * Get enhanced orchestrator statistics (migrated from orchestration-hook.js)
   */
  getEnhancedStats() {
    const metrics = this.getMetrics();
    const systemHealth = this.getSystemHealth();
    const taskStats = this.getTaskStats();

    return {
      orchestratorActive: this.isRunning,
      totalTasks: metrics.totalTasks,
      successfulTasks: metrics.successfulTasks,
      failedTasks: metrics.failedTasks,
      avgResponseTime: metrics.averageResponseTime,
      systemHealth: systemHealth.overallStatus,
      platformsHealthy: systemHealth.healthyPlatforms,
      platformsTotal: systemHealth.totalPlatforms,
      taskStats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check Claude usage via ccusage integration (migrated from orchestration-hook.js)
   */
  async checkClaudeUsage(): Promise<{
    available: boolean;
    usage: { used: number; limit: number };
    utilization: number;
    source: string;
    error?: string;
  }> {
    try {
      // Try to use ccusage for accurate monitoring
      const { execSync } = require('child_process');
      const stdout = execSync('npx ccusage@latest blocks --json 2>/dev/null || echo "{}"', { encoding: 'utf8' });
      const data = JSON.parse(stdout || '{}');

      const used = data.requests_used || 0;
      const limit = 40; // Pro plan limit
      const utilization = used / limit;

      return {
        available: utilization < 0.9, // 90% threshold
        usage: { used, limit },
        utilization,
        source: 'ccusage'
      };
    } catch (error) {
      // Fallback to estimation
      const used = this.getMetrics().totalTasks || 0;
      const limit = 40;
      const utilization = used / limit;

      return {
        available: utilization < 0.9,
        usage: { used, limit },
        utilization,
        source: 'estimation_fallback',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export default UnifiedOrchestrator;