/**
 * Intelligent Dynamic Timeout System
 *
 * This module provides an intelligent timeout management system that dynamically calculates
 * timeout values based on historical agent performance, task complexity, and system load.
 * It includes learning capabilities for continuous optimization and progressive timeout warnings.
 */

// Interfaces for type safety
interface AgentPerformance {
  agentId: string;
  averageResponseTime: number;
  successRate: number;
  totalTasks: number;
  lastUpdated: Date;
}

interface TaskComplexity {
  type: string;
  baseTimeout: number;
  complexityFactor: number;
}

interface SystemLoad {
  cpuUsage: number;
  memoryUsage: number;
  activeTasks: number;
  loadFactor: number;
}

interface TimeoutConfig {
  baseTimeout: number;
  agentFactor: number;
  complexityFactor: number;
  loadFactor: number;
  warningThreshold: number;
}

interface TimeoutResult {
  timeout: number;
  warningTime: number;
  factors: {
    base: number;
    agentPerformance: number;
    complexity: number;
    systemLoad: number;
  };
}

interface PerformanceHistory {
  taskId: string;
  agentId: string;
  actualTime: number;
  success: boolean;
  timestamp: Date;
}

// Enums for operational modes
enum OperationalMode {
  NORMAL = 'normal',
  HIGH_PERFORMANCE = 'high_performance',
  CONSERVATIVE = 'conservative',
  LEARNING = 'learning'
}

// Main timeout management class
class IntelligentTimeoutManager {
  private agentPerformance: Map<string, AgentPerformance> = new Map();
  private taskComplexities: Map<string, TaskComplexity> = new Map();
  private performanceHistory: PerformanceHistory[] = [];
  private operationalMode: OperationalMode = OperationalMode.NORMAL;
  private maxHistorySize: number = 1000;

  constructor() {
    // Initialize default task complexities
    this.initializeDefaultComplexities();
  }

  /**
   * Initialize default task complexity definitions
   */
  private initializeDefaultComplexities(): void {
    this.taskComplexities.set('simple', {
      type: 'simple',
      baseTimeout: 5000,
      complexityFactor: 1.0
    });

    this.taskComplexities.set('moderate', {
      type: 'moderate',
      baseTimeout: 15000,
      complexityFactor: 2.0
    });

    this.taskComplexities.set('complex', {
      type: 'complex',
      baseTimeout: 30000,
      complexityFactor: 4.0
    });

    this.taskComplexities.set('critical', {
      type: 'critical',
      baseTimeout: 60000,
      complexityFactor: 8.0
    });
  }

  /**
   * Set the current operational mode
   * @param mode The operational mode to set
   */
  public setOperationalMode(mode: OperationalMode): void {
    this.operationalMode = mode;
  }

  /**
   * Update agent performance metrics based on completed task
   * @param agentId The agent identifier
   * @param taskId The task identifier
   * @param actualTime The actual time taken to complete the task
   * @param success Whether the task was successful
   */
  public recordTaskPerformance(
    agentId: string,
    taskId: string,
    actualTime: number,
    success: boolean
  ): void {
    // Record performance history
    this.performanceHistory.push({
      taskId,
      agentId,
      actualTime,
      success,
      timestamp: new Date()
    });

    // Maintain history size
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory = this.performanceHistory.slice(-this.maxHistorySize);
    }

    // Update agent performance metrics
    const existingPerformance = this.agentPerformance.get(agentId);

    if (existingPerformance) {
      const totalTasks = existingPerformance.totalTasks + 1;
      const successCount = existingPerformance.successRate * existingPerformance.totalTasks + (success ? 1 : 0);
      const newSuccessRate = successCount / totalTasks;

      // Calculate new average response time using incremental average
      const newAverageResponseTime =
        (existingPerformance.averageResponseTime * existingPerformance.totalTasks + actualTime) / totalTasks;

      this.agentPerformance.set(agentId, {
        agentId,
        averageResponseTime: newAverageResponseTime,
        successRate: newSuccessRate,
        totalTasks,
        lastUpdated: new Date()
      });
    } else {
      this.agentPerformance.set(agentId, {
        agentId,
        averageResponseTime: actualTime,
        successRate: success ? 1 : 0,
        totalTasks: 1,
        lastUpdated: new Date()
      });
    }
  }

  /**
   * Calculate dynamic timeout based on various factors
   * @param agentId The agent identifier
   * @param taskType The type of task
   * @param systemLoad Current system load metrics
   * @returns Calculated timeout configuration
   */
  public calculateTimeout(
    agentId: string,
    taskType: string,
    systemLoad: SystemLoad
  ): TimeoutResult {
    // Get base timeout for task type
    const taskComplexity = this.taskComplexities.get(taskType) ||
                          this.taskComplexities.get('moderate')!;

    const baseTimeout = taskComplexity.baseTimeout;

    // Calculate agent performance factor
    const agentPerformance = this.agentPerformance.get(agentId);
    let agentFactor = 1.0;

    if (agentPerformance) {
      // Factor based on success rate (0.5 to 2.0)
      agentFactor = Math.max(0.5, Math.min(2.0, 1.5 - agentPerformance.successRate));

      // Additional factor based on response time compared to base
      if (agentPerformance.averageResponseTime > 0) {
        const responseRatio = agentPerformance.averageResponseTime / baseTimeout;
        agentFactor *= Math.max(0.8, Math.min(2.0, responseRatio));
      }
    }

    // Calculate complexity factor
    const complexityFactor = taskComplexity.complexityFactor;

    // Calculate system load factor (1.0 to 3.0)
    const loadFactor = 1.0 + (systemLoad.loadFactor * 2.0);

    // Apply operational mode adjustments
    let modeMultiplier = 1.0;
    switch (this.operationalMode) {
      case OperationalMode.HIGH_PERFORMANCE:
        modeMultiplier = 0.8;
        break;
      case OperationalMode.CONSERVATIVE:
        modeMultiplier = 1.5;
        break;
      case OperationalMode.LEARNING:
        modeMultiplier = 1.2;
        break;
    }

    // Calculate final timeout
    const calculatedTimeout = Math.round(
      baseTimeout *
      agentFactor *
      complexityFactor *
      loadFactor *
      modeMultiplier
    );

    // Ensure minimum timeout of 1 second
    const finalTimeout = Math.max(1000, calculatedTimeout);

    // Calculate warning time (70% of timeout)
    const warningTime = Math.round(finalTimeout * 0.7);

    return {
      timeout: finalTimeout,
      warningTime,
      factors: {
        base: baseTimeout,
        agentPerformance: agentFactor,
        complexity: complexityFactor,
        systemLoad: loadFactor
      }
    };
  }

  /**
   * Get progressive timeout configuration with warnings
   * @param agentId The agent identifier
   * @param taskType The type of task
   * @param systemLoad Current system load metrics
   * @returns Timeout configuration with progressive warnings
   */
  public getProgressiveTimeout(
    agentId: string,
    taskType: string,
    systemLoad: SystemLoad
  ): {
    initialTimeout: number;
    warningTimeout: number;
    finalTimeout: number;
    escalationTimeout: number;
  } {
    const timeoutResult = this.calculateTimeout(agentId, taskType, systemLoad);

    return {
      initialTimeout: Math.round(timeoutResult.timeout * 0.3),
      warningTimeout: Math.round(timeoutResult.timeout * 0.7),
      finalTimeout: timeoutResult.timeout,
      escalationTimeout: Math.round(timeoutResult.timeout * 1.5)
    };
  }

  /**
   * Update task complexity configuration
   * @param taskType The task type
   * @param complexity The complexity configuration
   */
  public updateTaskComplexity(taskType: string, complexity: TaskComplexity): void {
    this.taskComplexities.set(taskType, complexity);
  }

  /**
   * Get agent performance metrics
   * @param agentId The agent identifier
   * @returns Agent performance data or null if not found
   */
  public getAgentPerformance(agentId: string): AgentPerformance | null {
    return this.agentPerformance.get(agentId) || null;
  }

  /**
   * Get all agent performance metrics
   * @returns Map of all agent performance data
   */
  public getAllAgentPerformances(): Map<string, AgentPerformance> {
    return new Map(this.agentPerformance);
  }

  /**
   * Get recent performance history
   * @param limit Number of recent entries to return
   * @returns Array of recent performance history entries
   */
  public getRecentPerformanceHistory(limit: number = 50): PerformanceHistory[] {
    return this.performanceHistory.slice(-limit);
  }

  /**
   * Reset agent performance data
   * @param agentId The agent identifier
   */
  public resetAgentPerformance(agentId: string): void {
    this.agentPerformance.delete(agentId);
  }

  /**
   * Reset all performance data
   */
  public resetAllPerformanceData(): void {
    this.agentPerformance.clear();
    this.performanceHistory = [];
  }
}

// Export types and class
export {
  AgentPerformance,
  TaskComplexity,
  SystemLoad,
  TimeoutConfig,
  TimeoutResult,
  PerformanceHistory,
  OperationalMode,
  IntelligentTimeoutManager
};

// Export default instance
export default new IntelligentTimeoutManager();