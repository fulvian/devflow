/**
 * DevFlow Intelligent Orchestration System
 * Task ID: DEVFLOW-ORCHESTRATION-004
 * 
 * This module implements the main orchestrator with intelligent agent routing,
 * integrating all orchestration components including agent classification,
 * usage monitoring, delegation hierarchy, and real-time routing decisions.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// Core interfaces
interface Agent {
  id: string;
  name: string;
  capabilities: string[];
  currentLoad: number;
  maxCapacity: number;
  performanceMetrics: {
    responseTime: number;
    accuracy: number;
    availability: number;
  };
}

interface Task {
  id: string;
  type: string;
  priority: number;
  complexity: number;
  requiredCapabilities: string[];
  metadata?: Record<string, any>;
}

interface ClassificationResult {
  agentType: string;
  confidence: number;
  suggestedAgents: string[];
}

interface DelegationRule {
  condition: (task: Task) => boolean;
  targetAgent: string;
  priority: number;
}

interface OrchestrationAnalytics {
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  avgResponseTime: number;
  agentUtilization: Record<string, number>;
  routingDecisions: number;
}

// Core components
class AgentClassificationEngine {
  private agentProfiles: Map<string, any> = new Map();

  async classifyTask(task: Task): Promise<ClassificationResult> {
    // Simulate classification logic based on task characteristics
    const agentType = this.determineAgentType(task);
    const confidence = Math.random();
    const suggestedAgents = this.getSuggestedAgents(agentType, task.requiredCapabilities);
    
    return {
      agentType,
      confidence,
      suggestedAgents
    };
  }

  private determineAgentType(task: Task): string {
    // Classification logic based on task type and complexity
    if (task.complexity > 8) return 'expert';
    if (task.type.includes('data')) return 'analyst';
    if (task.type.includes('creative')) return 'creative';
    return 'general';
  }

  private getSuggestedAgents(agentType: string, requiredCapabilities: string[]): string[] {
    // Return agent IDs based on type and capabilities
    return [`agent-${agentType}-1`, `agent-${agentType}-2`];
  }

  registerAgentProfile(agentId: string, profile: any): void {
    this.agentProfiles.set(agentId, profile);
  }
}

class SonnetUsageMonitor {
  private usageData: Map<string, number[]> = new Map();
  private thresholds: Map<string, number> = new Map();

  trackUsage(agentId: string, usage: number): void {
    if (!this.usageData.has(agentId)) {
      this.usageData.set(agentId, []);
    }
    
    const data = this.usageData.get(agentId)!;
    data.push(usage);
    
    // Keep only last 100 data points
    if (data.length > 100) {
      data.shift();
    }
  }

  getUsagePattern(agentId: string): number {
    const data = this.usageData.get(agentId) || [];
    if (data.length === 0) return 0;
    
    // Calculate average usage
    const sum = data.reduce((acc, val) => acc + val, 0);
    return sum / data.length;
  }

  isOverloaded(agentId: string): boolean {
    const currentUsage = this.getUsagePattern(agentId);
    const threshold = this.thresholds.get(agentId) || 0.8;
    return currentUsage > threshold;
  }

  setThreshold(agentId: string, threshold: number): void {
    this.thresholds.set(agentId, threshold);
  }
}

class DelegationHierarchy {
  private rules: DelegationRule[] = [];

  addRule(rule: DelegationRule): void {
    this.rules.push(rule);
    // Sort by priority (higher priority first)
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  getDelegationTarget(task: Task): string | null {
    for (const rule of this.rules) {
      if (rule.condition(task)) {
        return rule.targetAgent;
      }
    }
    return null;
  }

  removeRule(condition: (task: Task) => boolean): void {
    this.rules = this.rules.filter(rule => !rule.condition.toString().includes(condition.toString()));
  }
}

// Main orchestrator implementation
export class DevFlowOrchestrator extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private classificationEngine: AgentClassificationEngine;
  private usageMonitor: SonnetUsageMonitor;
  private delegationHierarchy: DelegationHierarchy;
  private cognitiveMemory: Map<string, any>;
  private analytics: OrchestrationAnalytics;
  private isRunning: boolean = false;

  constructor() {
    super();
    this.classificationEngine = new AgentClassificationEngine();
    this.usageMonitor = new SonnetUsageMonitor();
    this.delegationHierarchy = new DelegationHierarchy();
    this.cognitiveMemory = new Map();
    this.analytics = {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      avgResponseTime: 0,
      agentUtilization: {},
      routingDecisions: 0
    };

    // Initialize delegation rules
    this.initializeDelegationRules();
  }

  /**
   * Initialize default delegation rules
   */
  private initializeDelegationRules(): void {
    // High priority tasks go to expert agents
    this.delegationHierarchy.addRule({
      condition: (task: Task) => task.priority > 8,
      targetAgent: 'expert-agent-1',
      priority: 10
    });

    // Data processing tasks go to analyst agents
    this.delegationHierarchy.addRule({
      condition: (task: Task) => task.type === 'data-processing',
      targetAgent: 'analyst-agent-1',
      priority: 5
    });
  }

  /**
   * Register a new agent with the orchestrator
   */
  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
    this.usageMonitor.setThreshold(agent.id, 0.8);
    this.analytics.agentUtilization[agent.id] = 0;
    this.emit('agentRegistered', agent);
  }

  /**
   * Unregister an agent from the orchestrator
   */
  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
    delete this.analytics.agentUtilization[agentId];
    this.emit('agentUnregistered', agentId);
  }

  /**
   * Main orchestration method - routes tasks to appropriate agents
   */
  async orchestrateTask(task: Task): Promise<any> {
    this.analytics.totalTasks++;
    const startTime = Date.now();

    try {
      // 1. Check delegation hierarchy first
      const delegatedAgent = this.delegationHierarchy.getDelegationTarget(task);
      if (delegatedAgent && this.agents.has(delegatedAgent)) {
        const agent = this.agents.get(delegatedAgent)!;
        if (!this.usageMonitor.isOverloaded(agent.id)) {
          return await this.executeTaskWithAgent(task, agent);
        }
      }

      // 2. Use classification engine for intelligent routing
      const classification = await this.classificationEngine.classifyTask(task);
      this.analytics.routingDecisions++;

      // 3. Find best available agent
      let selectedAgent: Agent | null = null;
      
      // Try suggested agents first
      for (const agentId of classification.suggestedAgents) {
        if (this.agents.has(agentId)) {
          const agent = this.agents.get(agentId)!;
          if (!this.usageMonitor.isOverloaded(agent.id)) {
            selectedAgent = agent;
            break;
          }
        }
      }

      // If no suggested agent available, find any capable agent
      if (!selectedAgent) {
        selectedAgent = this.findBestAvailableAgent(task);
      }

      if (!selectedAgent) {
        throw new Error('No available agents capable of handling this task');
      }

      // 4. Execute task with selected agent
      const result = await this.executeTaskWithAgent(task, selectedAgent);
      
      // 5. Update analytics
      const executionTime = Date.now() - startTime;
      this.updateAnalytics(true, executionTime, selectedAgent.id);
      
      return result;
    } catch (error) {
      this.updateAnalytics(false, Date.now() - startTime, null);
      this.emit('taskFailed', { task, error });
      throw error;
    }
  }

  /**
   * Execute a task with a specific agent
   */
  private async executeTaskWithAgent(task: Task, agent: Agent): Promise<any> {
    // Update agent load
    agent.currentLoad = Math.min(agent.currentLoad + 1, agent.maxCapacity);
    
    // Simulate task execution
    const executionTime = 100 + Math.random() * 900; // 100-1000ms
    await new Promise(resolve => setTimeout(resolve, executionTime));
    
    // Update usage monitoring
    this.usageMonitor.trackUsage(agent.id, agent.currentLoad / agent.maxCapacity);
    
    // Update agent performance metrics
    agent.performanceMetrics.responseTime = 
      (agent.performanceMetrics.responseTime * 0.9) + (executionTime * 0.1);
    
    // Decrease load after execution
    agent.currentLoad = Math.max(0, agent.currentLoad - 1);
    
    // Store in cognitive memory
    this.storeInCognitiveMemory(task.id, {
      agentId: agent.id,
      executionTime,
      timestamp: Date.now()
    });

    this.emit('taskCompleted', { task, agent, executionTime });
    return { 
      taskId: task.id, 
      agentId: agent.id, 
      result: `Task completed by ${agent.name}` 
    };
  }

  /**
   * Find the best available agent for a task based on capabilities and load
   */
  private findBestAvailableAgent(task: Task): Agent | null {
    const capableAgents = Array.from(this.agents.values()).filter(agent => 
      task.requiredCapabilities.every(cap => agent.capabilities.includes(cap)) &&
      !this.usageMonitor.isOverloaded(agent.id)
    );

    if (capableAgents.length === 0) return null;

    // Sort by performance (lowest response time first) and availability
    capableAgents.sort((a, b) => {
      const loadDiff = a.currentLoad - b.currentLoad;
      if (loadDiff !== 0) return loadDiff;
      return a.performanceMetrics.responseTime - b.performanceMetrics.responseTime;
    });

    return capableAgents[0];
  }

  /**
   * Update orchestration analytics
   */
  private updateAnalytics(success: boolean, responseTime: number, agentId: string | null): void {
    if (success) {
      this.analytics.successfulTasks++;
    } else {
      this.analytics.failedTasks++;
    }

    // Update average response time
    const totalResponseTime = (this.analytics.avgResponseTime * (this.analytics.totalTasks - 1)) + responseTime;
    this.analytics.avgResponseTime = totalResponseTime / this.analytics.totalTasks;

    // Update agent utilization
    if (agentId) {
      this.analytics.agentUtilization[agentId] = 
        (this.analytics.agentUtilization[agentId] || 0) + 1;
    }
  }

  /**
   * Store data in cognitive memory
   */
  private storeInCognitiveMemory(key: string, data: any): void {
    this.cognitiveMemory.set(key, {
      ...data,
      storedAt: Date.now()
    });
  }

  /**
   * Retrieve data from cognitive memory
   */
  getCognitiveMemory(key: string): any {
    return this.cognitiveMemory.get(key);
  }

  /**
   * Get current orchestration analytics
   */
  getAnalytics(): OrchestrationAnalytics {
    return { ...this.analytics };
  }

  /**
   * Get agent status information
   */
  getAgentStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    for (const [id, agent] of this.agents) {
      status[id] = {
        name: agent.name,
        currentLoad: agent.currentLoad,
        maxCapacity: agent.maxCapacity,
        utilization: agent.currentLoad / agent.maxCapacity,
        isOverloaded: this.usageMonitor.isOverloaded(id),
        performanceMetrics: { ...agent.performanceMetrics }
      };
    }
    return status;
  }

  /**
   * Start the orchestrator
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.emit('started');
  }

  /**
   * Stop the orchestrator
   */
  stop(): void {
    this.isRunning = false;
    this.emit('stopped');
  }

  /**
   * Check if orchestrator is running
   */
  isOrchestratorRunning(): boolean {
    return this.isRunning;
  }
}

// Export types for external use
export type {
  Agent,
  Task,
  ClassificationResult,
  DelegationRule,
  OrchestrationAnalytics
};

// Export singleton instance
export const devFlowOrchestrator = new DevFlowOrchestrator();