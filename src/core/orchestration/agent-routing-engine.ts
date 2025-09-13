/**
 * Agent Classification Engine for DevFlow Cognitive System
 * 
 * This module implements intelligent agent routing with automatic delegation hierarchy:
 * Sonnet (90% usage) → Codex → Gemini → Synthetic
 * 
 * Key Features:
 * - Task classification for optimal agent assignment
 * - Usage monitoring and session limit prevention
 * - Automatic delegation based on task type and complexity
 * - Integration with existing DevFlow cognitive system
 */

// Import required modules
import { Agent, Task, TaskType, AgentCapability, ClassificationResult } from './devflow-types';
import { DevFlowCognitiveSystem } from './devflow-core';

/**
 * Configuration for the Agent Classification Engine
 */
interface AgentClassificationConfig {
  /** Sonnet usage threshold (percentage) */
  sonnetUsageThreshold: number;
  /** Maximum session duration in milliseconds (5 hours = 18000000 ms) */
  maxSessionDuration: number;
  /** Token limit for Sonnet to prevent session blocks */
  sonnetTokenLimit: number;
}

/**
 * Agent usage statistics
 */
interface AgentUsageStats {
  totalRequests: number;
  sonnetRequests: number;
  currentSessionStart: number | null;
  totalTokensUsed: number;
}

/**
 * Task classification metadata
 */
interface TaskClassification {
  primaryAgent: Agent;
  confidence: number;
  reasoning: string;
  alternativeAgents: Agent[];
}

/**
 * Agent Classification Engine
 * 
 * Manages intelligent routing of tasks to appropriate agents based on:
 * - Task type and complexity
 * - Agent capabilities
 * - Usage patterns and limits
 */
export class AgentClassificationEngine {
  private config: AgentClassificationConfig;
  private usageStats: AgentUsageStats;
  private cognitiveSystem: DevFlowCognitiveSystem;
  private agents: Map<Agent, AgentCapability[]>;

  constructor(cognitiveSystem: DevFlowCognitiveSystem) {
    this.cognitiveSystem = cognitiveSystem;
    this.config = {
      sonnetUsageThreshold: 90,
      maxSessionDuration: 18000000, // 5 hours in milliseconds
      sonnetTokenLimit: 100000 // Token limit to prevent session blocks
    };

    this.usageStats = {
      totalRequests: 0,
      sonnetRequests: 0,
      currentSessionStart: null,
      totalTokensUsed: 0
    };

    // Initialize agent capabilities
    this.agents = new Map([
      [Agent.Sonnet, [
        AgentCapability.ARCHITECTURE_DESIGN,
        AgentCapability.TECH_LEAD_DECISIONS,
        AgentCapability.SYSTEM_OPTIMIZATION,
        AgentCapability.COMPLEX_PROBLEM_SOLVING
      ]],
      [Agent.Codex, [
        AgentCapability.CODE_GENERATION,
        AgentCapability.CODE_REVIEW,
        AgentCapability.BUG_FIXING,
        AgentCapability.TEST_IMPLEMENTATION
      ]],
      [Agent.Gemini, [
        AgentCapability.CODE_GENERATION,
        AgentCapability.DOCUMENTATION,
        AgentCapability.DEBUGGING,
        AgentCapability.SIMPLE_TASKS
      ]],
      [Agent.Synthetic, [
        AgentCapability.BASIC_CODING,
        AgentCapability.TEMPLATE_FILLING,
        AgentCapability.ROUTINE_TASKS,
        AgentCapability.SHELL_COMMANDS
      ]]
    ]);
  }

  /**
   * Classify a task and determine the optimal agent assignment
   * 
   * @param task The task to classify
   * @returns Classification result with recommended agent and confidence
   */
  public async classifyTask(task: Task): Promise<ClassificationResult> {
    // Update usage statistics
    this.updateUsageStats();

    // Check for session limits
    if (this.isSessionLimitExceeded()) {
      return this.handleSessionLimitExceeded(task);
    }

    // Classify the task
    const classification = await this.performTaskClassification(task);
    
    // Apply delegation rules
    const finalAgent = this.applyDelegationHierarchy(
      classification.primaryAgent,
      task,
      classification.confidence
    );

    return {
      agent: finalAgent,
      confidence: classification.confidence,
      reasoning: classification.reasoning,
      alternativeAgents: classification.alternativeAgents
    };
  }

  /**
   * Update usage statistics for monitoring
   */
  private updateUsageStats(): void {
    this.usageStats.totalRequests++;
    
    // Reset session if it's the first request
    if (this.usageStats.currentSessionStart === null) {
      this.usageStats.currentSessionStart = Date.now();
    }
  }

  /**
   * Check if session limits have been exceeded
   * 
   * @returns true if session limits exceeded, false otherwise
   */
  private isSessionLimitExceeded(): boolean {
    // Check session duration
    if (this.usageStats.currentSessionStart !== null) {
      const sessionDuration = Date.now() - this.usageStats.currentSessionStart;
      if (sessionDuration > this.config.maxSessionDuration) {
        return true;
      }
    }

    // Check Sonnet usage threshold
    if (this.usageStats.totalRequests > 0) {
      const sonnetUsagePercentage = (this.usageStats.sonnetRequests / this.usageStats.totalRequests) * 100;
      return sonnetUsagePercentage > this.config.sonnetUsageThreshold;
    }

    return false;
  }

  /**
   * Handle exceeded session limits by delegating to alternative agents
   * 
   * @param task The task to handle
   * @returns Classification result with alternative agent
   */
  private handleSessionLimitExceeded(task: Task): ClassificationResult {
    // For session limit exceeded, delegate to next available agent
    const alternativeAgent = this.getNextAvailableAgent(Agent.Sonnet, task.type);
    
    return {
      agent: alternativeAgent,
      confidence: 0.8,
      reasoning: "Session limits exceeded, delegating to alternative agent",
      alternativeAgents: [Agent.Codex, Agent.Gemini, Agent.Synthetic].filter(a => a !== alternativeAgent)
    };
  }

  /**
   * Perform detailed task classification using cognitive system
   * 
   * @param task The task to classify
   * @returns Task classification result
   */
  private async performTaskClassification(task: Task): Promise<TaskClassification> {
    // Use cognitive system to analyze task
    const analysis = await this.cognitiveSystem.analyzeTask(task);
    
    // Determine primary agent based on task type
    let primaryAgent: Agent;
    let confidence: number;
    let reasoning: string;

    switch (task.type) {
      case TaskType.ARCHITECTURE:
      case TaskType.TECH_LEAD:
      case TaskType.SYSTEM_DESIGN:
        primaryAgent = Agent.Sonnet;
        confidence = 0.95;
        reasoning = "High-impact architectural task requiring tech lead expertise";
        break;
      
      case TaskType.DEBUG:
      case TaskType.TEST:
      case TaskType.BASH:
        primaryAgent = this.getSecondaryAgentForTask(task.type);
        confidence = 0.9;
        reasoning = "Debug/test/bash task suitable for secondary agents";
        break;
      
      case TaskType.CODE_GENERATION:
      case TaskType.CODE_REVIEW:
        primaryAgent = Agent.Codex;
        confidence = 0.85;
        reasoning = "Coding task best handled by specialized coding agent";
        break;
      
      default:
        // Use cognitive analysis for complex classification
        primaryAgent = analysis.recommendedAgent;
        confidence = analysis.confidence;
        reasoning = analysis.reasoning;
    }

    // Track Sonnet usage
    if (primaryAgent === Agent.Sonnet) {
      this.usageStats.sonnetRequests++;
    }

    return {
      primaryAgent,
      confidence,
      reasoning,
      alternativeAgents: this.getAlternativeAgents(primaryAgent, task.type)
    };
  }

  /**
   * Apply delegation hierarchy rules
   * 
   * @param recommendedAgent The initially recommended agent
   * @param task The task being classified
   * @param confidence Classification confidence
   * @returns Final agent assignment after applying delegation rules
   */
  private applyDelegationHierarchy(
    recommendedAgent: Agent,
    task: Task,
    confidence: number
  ): Agent {
    // If Sonnet is recommended but usage limits would be exceeded, delegate down
    if (recommendedAgent === Agent.Sonnet && this.wouldExceedUsageLimits()) {
      return this.getNextAvailableAgent(Agent.Sonnet, task.type);
    }

    // For debug/test/bash tasks, ensure they go to secondary agents
    if ([TaskType.DEBUG, TaskType.TEST, TaskType.BASH].includes(task.type)) {
      return this.getSecondaryAgentForTask(task.type);
    }

    // If confidence is low, consider alternative agents
    if (confidence < 0.7) {
      return this.getNextAvailableAgent(recommendedAgent, task.type);
    }

    return recommendedAgent;
  }

  /**
   * Check if using Sonnet would exceed usage limits
   * 
   * @returns true if usage would exceed limits, false otherwise
   */
  private wouldExceedUsageLimits(): boolean {
    const projectedSonnetRequests = this.usageStats.sonnetRequests + 1;
    const projectedTotalRequests = this.usageStats.totalRequests + 1;
    
    if (projectedTotalRequests > 0) {
      const projectedUsage = (projectedSonnetRequests / projectedTotalRequests) * 100;
      return projectedUsage > this.config.sonnetUsageThreshold;
    }
    
    return false;
  }

  /**
   * Get the next available agent in the delegation hierarchy
   * 
   * @param currentAgent The current agent in the hierarchy
   * @param taskType The type of task
   * @returns The next appropriate agent
   */
  private getNextAvailableAgent(currentAgent: Agent, taskType: TaskType): Agent {
    const hierarchy: Agent[] = [Agent.Sonnet, Agent.Codex, Agent.Gemini, Agent.Synthetic];
    const currentIndex = hierarchy.indexOf(currentAgent);
    
    // Find the next agent that can handle this task type
    for (let i = currentIndex + 1; i < hierarchy.length; i++) {
      const agent = hierarchy[i];
      if (this.canHandleTask(agent, taskType)) {
        return agent;
      }
    }
    
    // If no agent in hierarchy can handle it, go back up the hierarchy
    for (let i = 0; i < currentIndex; i++) {
      const agent = hierarchy[i];
      if (this.canHandleTask(agent, taskType)) {
        return agent;
      }
    }
    
    // Fallback to Synthetic if no other agent is suitable
    return Agent.Synthetic;
  }

  /**
   * Get secondary agent for specific task types
   * 
   * @param taskType The task type
   * @returns Appropriate secondary agent
   */
  private getSecondaryAgentForTask(taskType: TaskType): Agent {
    switch (taskType) {
      case TaskType.DEBUG:
        return Agent.Gemini;
      case TaskType.TEST:
        return Agent.Codex;
      case TaskType.BASH:
        return Agent.Synthetic;
      default:
        return Agent.Gemini;
    }
  }

  /**
   * Get alternative agents for a given primary agent and task type
   * 
   * @param primaryAgent The primary agent
   * @param taskType The task type
   * @returns List of alternative agents
   */
  private getAlternativeAgents(primaryAgent: Agent, taskType: TaskType): Agent[] {
    const allAgents = [Agent.Sonnet, Agent.Codex, Agent.Gemini, Agent.Synthetic];
    return allAgents
      .filter(agent => agent !== primaryAgent)
      .filter(agent => this.canHandleTask(agent, taskType));
  }

  /**
   * Check if an agent can handle a specific task type
   * 
   * @param agent The agent to check
   * @param taskType The task type
   * @returns true if agent can handle the task, false otherwise
   */
  private canHandleTask(agent: Agent, taskType: TaskType): boolean {
    const capabilities = this.agents.get(agent) || [];
    
    switch (taskType) {
      case TaskType.ARCHITECTURE:
      case TaskType.TECH_LEAD:
      case TaskType.SYSTEM_DESIGN:
        return capabilities.includes(AgentCapability.ARCHITECTURE_DESIGN) ||
               capabilities.includes(AgentCapability.TECH_LEAD_DECISIONS);
      
      case TaskType.CODE_GENERATION:
        return capabilities.includes(AgentCapability.CODE_GENERATION);
      
      case TaskType.CODE_REVIEW:
        return capabilities.includes(AgentCapability.CODE_REVIEW);
      
      case TaskType.DEBUG:
        return capabilities.includes(AgentCapability.DEBUGGING);
      
      case TaskType.TEST:
        return capabilities.includes(AgentCapability.TEST_IMPLEMENTATION);
      
      case TaskType.BASH:
        return capabilities.includes(AgentCapability.SHELL_COMMANDS) ||
               capabilities.includes(AgentCapability.ROUTINE_TASKS);
      
      default:
        return true; // Assume general capability for unknown task types
    }
  }

  /**
   * Reset session statistics
   */
  public resetSession(): void {
    this.usageStats = {
      totalRequests: 0,
      sonnetRequests: 0,
      currentSessionStart: Date.now(),
      totalTokensUsed: 0
    };
  }

  /**
   * Get current usage statistics
   * 
   * @returns Current usage statistics
   */
  public getUsageStats(): AgentUsageStats {
    return { ...this.usageStats };
  }

  /**
   * Update configuration
   * 
   * @param newConfig Partial configuration updates
   */
  public updateConfig(newConfig: Partial<AgentClassificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}