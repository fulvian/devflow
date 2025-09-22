/**
 * Task ID: DEVFLOW-MODES-001
 * Operational Modes Integration System
 *
 * This module provides the core integration for 4 operational modes with
 * specialized task routing, dynamic switching, and performance tracking.
 */

// Core interfaces and types
export interface Agent {
  id: string;
  name: string;
  capabilities: string[];
  performanceMetrics: {
    tasksCompleted: number;
    avgResponseTime: number;
    errorRate: number;
  };
  isActive: boolean;
}

export interface Task {
  id: string;
  type: string;
  priority: number;
  requiredCapabilities: string[];
  metadata?: Record<string, any>;
}

export interface ModePerformanceMetrics {
  tasksProcessed: number;
  avgProcessingTime: number;
  successRate: number;
  errors: number;
}

export type OperationalMode = 'claude-only' | 'all-mode' | 'cli-only' | 'synthetic-only';

export interface ModeConfiguration {
  name: OperationalMode;
  allowedAgents: string[];
  routingStrategy: 'capability-match' | 'round-robin' | 'priority-based';
  performanceThreshold?: number;
}

// Main operational modes manager
export class OperationalModesManager {
  private currentMode: OperationalMode = 'all-mode';
  private agents: Map<string, Agent> = new Map();
  private modeConfigurations: Map<OperationalMode, ModeConfiguration> = new Map();
  private performanceMetrics: Map<OperationalMode, ModePerformanceMetrics> = new Map();
  private taskQueue: Task[] = [];
  private routingHistory: { taskId: string; agentId: string; timestamp: Date }[] = [];

  constructor() {
    this.initializeModeConfigurations();
    this.initializePerformanceMetrics();
  }

  /**
   * Initialize default configurations for all operational modes
   */
  private initializeModeConfigurations(): void {
    this.modeConfigurations.set('claude-only', {
      name: 'claude-only',
      allowedAgents: ['claude-agent-1', 'claude-agent-2'],
      routingStrategy: 'capability-match'
    });

    this.modeConfigurations.set('all-mode', {
      name: 'all-mode',
      allowedAgents: ['*'], // All agents allowed
      routingStrategy: 'priority-based'
    });

    this.modeConfigurations.set('cli-only', {
      name: 'cli-only',
      allowedAgents: ['cli-agent-1', 'cli-agent-2', 'cli-agent-3'],
      routingStrategy: 'round-robin'
    });

    this.modeConfigurations.set('synthetic-only', {
      name: 'synthetic-only',
      allowedAgents: ['synthetic-agent-1', 'synthetic-agent-2'],
      routingStrategy: 'capability-match'
    });
  }

  /**
   * Initialize performance metrics for all modes
   */
  private initializePerformanceMetrics(): void {
    const modes: OperationalMode[] = ['claude-only', 'all-mode', 'cli-only', 'synthetic-only'];
    modes.forEach(mode => {
      this.performanceMetrics.set(mode, {
        tasksProcessed: 0,
        avgProcessingTime: 0,
        successRate: 1.0,
        errors: 0
      });
    });
  }

  /**
   * Register a new agent in the system
   */
  public registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }

  /**
   * Get current operational mode
   */
  public getCurrentMode(): OperationalMode {
    return this.currentMode;
  }

  /**
   * Switch to a new operational mode
   */
  public switchMode(newMode: OperationalMode): boolean {
    if (!this.modeConfigurations.has(newMode)) {
      throw new Error(`Invalid operational mode: ${newMode}`);
    }

    const previousMode = this.currentMode;
    this.currentMode = newMode;

    // Log mode change for auditing
    console.log(`Mode switched from ${previousMode} to ${newMode} at ${new Date().toISOString()}`);

    return true;
  }

  /**
   * Get configuration for current mode
   */
  public getCurrentModeConfiguration(): ModeConfiguration {
    const config = this.modeConfigurations.get(this.currentMode);
    if (!config) {
      throw new Error(`Configuration not found for mode: ${this.currentMode}`);
    }
    return config;
  }

  /**
   * Route a task to an appropriate agent based on current mode and capabilities
   */
  public routeTask(task: Task): Agent | null {
    const modeConfig = this.getCurrentModeConfiguration();
    const availableAgents = this.getAvailableAgentsForMode(modeConfig);

    if (availableAgents.length === 0) {
      console.warn(`No available agents for mode: ${this.currentMode}`);
      return null;
    }

    let selectedAgent: Agent | null = null;

    switch (modeConfig.routingStrategy) {
      case 'capability-match':
        selectedAgent = this.routeByCapabilityMatch(task, availableAgents);
        break;
      case 'round-robin':
        selectedAgent = this.routeRoundRobin(task, availableAgents);
        break;
      case 'priority-based':
        selectedAgent = this.routeByPriority(task, availableAgents);
        break;
      default:
        throw new Error(`Unknown routing strategy: ${modeConfig.routingStrategy}`);
    }

    if (selectedAgent) {
      // Record routing decision
      this.routingHistory.push({
        taskId: task.id,
        agentId: selectedAgent.id,
        timestamp: new Date()
      });

      // Update performance metrics
      this.updatePerformanceMetrics(1, 0); // Assuming success, actual timing would be measured elsewhere
    }

    return selectedAgent;
  }

  /**
   * Get available agents based on mode configuration
   */
  private getAvailableAgentsForMode(modeConfig: ModeConfiguration): Agent[] {
    const allAgents = Array.from(this.agents.values()).filter(agent => agent.isActive);

    if (modeConfig.allowedAgents.includes('*')) {
      return allAgents;
    }

    return allAgents.filter(agent =>
      modeConfig.allowedAgents.includes(agent.id) ||
      modeConfig.allowedAgents.some(cap => agent.capabilities.includes(cap))
    );
  }

  /**
   * Route task based on capability matching
   */
  private routeByCapabilityMatch(task: Task, agents: Agent[]): Agent | null {
    // Find agents that match all required capabilities
    const matchingAgents = agents.filter(agent =>
      task.requiredCapabilities.every(cap => agent.capabilities.includes(cap))
    );

    if (matchingAgents.length === 0) {
      return null;
    }

    // Select agent with best performance metrics
    return matchingAgents.reduce((best, current) =>
      current.performanceMetrics.avgResponseTime < best.performanceMetrics.avgResponseTime
        ? current
        : best
    );
  }

  /**
   * Route task using round-robin strategy
   */
  private routeRoundRobin(task: Task, agents: Agent[]): Agent | null {
    if (agents.length === 0) return null;

    // Simple round-robin implementation
    const lastIndex = this.routingHistory.length > 0
      ? agents.findIndex(a => a.id === this.routingHistory[this.routingHistory.length - 1].agentId)
      : -1;

    const nextIndex = (lastIndex + 1) % agents.length;
    return agents[nextIndex];
  }

  /**
   * Route task based on priority and agent capability
   */
  private routeByPriority(task: Task, agents: Agent[]): Agent | null {
    // Sort agents by performance (lower error rate, faster response time)
    const sortedAgents = [...agents].sort((a, b) => {
      if (a.performanceMetrics.errorRate !== b.performanceMetrics.errorRate) {
        return a.performanceMetrics.errorRate - b.performanceMetrics.errorRate;
      }
      return a.performanceMetrics.avgResponseTime - b.performanceMetrics.avgResponseTime;
    });

    // Find agents that can handle the task
    const capableAgents = sortedAgents.filter(agent =>
      task.requiredCapabilities.every(cap => agent.capabilities.includes(cap))
    );

    return capableAgents.length > 0 ? capableAgents[0] : null;
  }

  /**
   * Update performance metrics for current mode
   */
  public updatePerformanceMetrics(tasksProcessed: number, errors: number, processingTime?: number): void {
    const currentMetrics = this.performanceMetrics.get(this.currentMode);
    if (!currentMetrics) return;

    const totalTasks = currentMetrics.tasksProcessed + tasksProcessed;
    const newAvgTime = processingTime
      ? ((currentMetrics.avgProcessingTime * currentMetrics.tasksProcessed) + processingTime) / totalTasks
      : currentMetrics.avgProcessingTime;

    const newSuccessRate = totalTasks > 0
      ? (currentMetrics.tasksProcessed + tasksProcessed - currentMetrics.errors - errors) / totalTasks
      : 1.0;

    this.performanceMetrics.set(this.currentMode, {
      tasksProcessed: totalTasks,
      avgProcessingTime: newAvgTime,
      successRate: newSuccessRate,
      errors: currentMetrics.errors + errors
    });
  }

  /**
   * Get performance metrics for a specific mode
   */
  public getModePerformance(mode: OperationalMode): ModePerformanceMetrics | undefined {
    return this.performanceMetrics.get(mode);
  }

  /**
   * Get performance metrics for current mode
   */
  public getCurrentModePerformance(): ModePerformanceMetrics | undefined {
    return this.performanceMetrics.get(this.currentMode);
  }

  /**
   * Get routing history
   */
  public getRoutingHistory(limit?: number): typeof this.routingHistory {
    if (!limit) return this.routingHistory;
    return this.routingHistory.slice(-limit);
  }

  /**
   * Reset performance metrics for a mode
   */
  public resetPerformanceMetrics(mode: OperationalMode): void {
    if (this.performanceMetrics.has(mode)) {
      this.performanceMetrics.set(mode, {
        tasksProcessed: 0,
        avgProcessingTime: 0,
        successRate: 1.0,
        errors: 0
      });
    }
  }

  /**
   * Get system status including current mode and agent availability
   */
  public getSystemStatus(): {
    currentMode: OperationalMode;
    activeAgents: number;
    queuedTasks: number;
    performance: ModePerformanceMetrics | undefined;
  } {
    return {
      currentMode: this.currentMode,
      activeAgents: Array.from(this.agents.values()).filter(a => a.isActive).length,
      queuedTasks: this.taskQueue.length,
      performance: this.getCurrentModePerformance()
    };
  }
}

// Command interface for mode changes
export class ModeCommandInterface {
  constructor(private modesManager: OperationalModesManager) {}

  /**
   * Change operational mode
   */
  public changeMode(mode: OperationalMode): { success: boolean; message: string } {
    try {
      const result = this.modesManager.switchMode(mode);
      return {
        success: result,
        message: `Successfully switched to ${mode} mode`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to switch mode: ${(error as Error).message}`
      };
    }
  }

  /**
   * Get available modes
   */
  public getAvailableModes(): OperationalMode[] {
    return ['claude-only', 'all-mode', 'cli-only', 'synthetic-only'];
  }

  /**
   * Get current mode
   */
  public getCurrentMode(): OperationalMode {
    return this.modesManager.getCurrentMode();
  }

  /**
   * Get system status
   */
  public getStatus(): ReturnType<OperationalModesManager['getSystemStatus']> {
    return this.modesManager.getSystemStatus();
  }
}

// Export main classes and interfaces
export default OperationalModesManager;