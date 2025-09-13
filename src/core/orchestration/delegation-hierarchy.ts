// File: src/orchestration/delegation-system.ts

import { AgentType, TaskRequest, TaskResponse, TaskContext, TaskComplexity } from '../types/task-types';
import { UsageMonitor } from '../monitoring/usage-monitor';
import { RoutingEngine } from '../routing/routing-engine';
import { Logger } from '../utils/logger';
import { AgentPool } from '../agents/agent-pool';

/**
 * DelegationSystem manages the automatic delegation hierarchy between agents
 * Sonnet → Codex → Gemini → Synthetic with intelligent handoff protocols
 */
export class DelegationSystem {
  private usageMonitor: UsageMonitor;
  private routingEngine: RoutingEngine;
  private agentPool: AgentPool;
  private logger: Logger;

  // Delegation hierarchy from highest to lowest priority
  private readonly DELEGATION_CHAIN: AgentType[] = [
    AgentType.SONNET,
    AgentType.CODEX,
    AgentType.GEMINI,
    AgentType.SYNTHETIC
  ];

  constructor(
    usageMonitor: UsageMonitor,
    routingEngine: RoutingEngine,
    agentPool: AgentPool,
    logger: Logger
  ) {
    this.usageMonitor = usageMonitor;
    this.routingEngine = routingEngine;
    this.agentPool = agentPool;
    this.logger = logger;
  }

  /**
   * Process a task through the delegation hierarchy with intelligent handoff
   * @param task The task request to process
   * @returns Task response from the appropriate agent
   */
  async processTask(task: TaskRequest): Promise<TaskResponse> {
    try {
      // Assess task complexity to inform delegation decisions
      const complexity = await this.assessTaskComplexity(task);
      
      // Determine the starting agent based on current usage and task requirements
      const startingAgent = await this.determineStartingAgent(task, complexity);
      
      // Process the task through the delegation chain
      return await this.delegateTask(task, startingAgent, complexity);
    } catch (error) {
      this.logger.error('Error processing task in delegation system', { error, taskId: task.id });
      throw error;
    }
  }

  /**
   * Assess the complexity of a task to inform delegation decisions
   * @param task The task to assess
   * @returns Task complexity level
   */
  private async assessTaskComplexity(task: TaskRequest): Promise<TaskComplexity> {
    try {
      // Get complexity assessment from routing engine
      const complexity = await this.routingEngine.assessComplexity(task);
      
      this.logger.debug('Task complexity assessed', {
        taskId: task.id,
        complexity,
        contentLength: task.content?.length || 0
      });
      
      return complexity;
    } catch (error) {
      this.logger.warn('Failed to assess task complexity, defaulting to MEDIUM', { 
        error, 
        taskId: task.id 
      });
      return TaskComplexity.MEDIUM;
    }
  }

  /**
   * Determine the appropriate starting agent based on usage and task requirements
   * @param task The task request
   * @param complexity The assessed complexity
   * @returns The agent type to start with
   */
  private async determineStartingAgent(task: TaskRequest, complexity: TaskComplexity): Promise<AgentType> {
    // Check if we should bypass Sonnet due to usage limits
    const sonnetUsage = this.usageMonitor.getUsage(AgentType.SONNET);
    const sonnetThreshold = this.usageMonitor.getThreshold(AgentType.SONNET);
    
    // If Sonnet is over threshold, start with Codex
    if (sonnetUsage >= sonnetThreshold) {
      this.logger.info('Sonnet usage threshold exceeded, starting with Codex', {
        taskId: task.id,
        sonnetUsage,
        threshold: sonnetThreshold
      });
      return AgentType.CODEX;
    }
    
    // For very complex tasks, consider starting with a more capable agent
    if (complexity === TaskComplexity.HIGH) {
      const sonnetCapability = await this.agentPool.getCapabilityScore(AgentType.SONNET);
      // If Sonnet isn't sufficiently capable, start with Codex
      if (sonnetCapability < 0.8) {
        this.logger.info('High complexity task, starting with Codex for better capability', {
          taskId: task.id,
          sonnetCapability
        });
        return AgentType.CODEX;
      }
    }
    
    // Default to starting with Sonnet
    return AgentType.SONNET;
  }

  /**
   * Delegate task through the hierarchy with intelligent handoff
   * @param task The task to delegate
   * @param startingAgent The agent to start with
   * @param complexity The task complexity
   * @returns Task response
   */
  private async delegateTask(
    task: TaskRequest, 
    startingAgent: AgentType, 
    complexity: TaskComplexity
  ): Promise<TaskResponse> {
    // Create execution context to preserve state across handoffs
    const context: TaskContext = {
      originalTask: task,
      executionHistory: [],
      handoffCount: 0,
      preservedState: new Map()
    };

    let currentAgent = startingAgent;
    let agentIndex = this.DELEGATION_CHAIN.indexOf(currentAgent);
    
    // Ensure we start within bounds
    if (agentIndex === -1) {
      agentIndex = 0;
      currentAgent = this.DELEGATION_CHAIN[0];
    }

    while (agentIndex < this.DELEGATION_CHAIN.length) {
      currentAgent = this.DELEGATION_CHAIN[agentIndex];
      
      try {
        this.logger.info('Attempting task delegation', {
          taskId: task.id,
          agent: currentAgent,
          handoffCount: context.handoffCount
        });

        // Check agent availability
        if (!await this.agentPool.isAvailable(currentAgent)) {
          this.logger.warn('Agent not available, moving to next in chain', {
            taskId: task.id,
            agent: currentAgent
          });
          agentIndex++;
          continue;
        }

        // Execute task with the current agent
        const response = await this.executeWithAgent(task, currentAgent, context);
        
        // Check if we need to handoff based on response quality
        if (await this.shouldHandoff(response, complexity, context)) {
          this.logger.info('Handoff triggered based on response quality', {
            taskId: task.id,
            fromAgent: currentAgent,
            handoffReason: 'quality_insufficient'
          });
          
          // Preserve context for handoff
          this.preserveContext(context, response, currentAgent);
          agentIndex++;
          context.handoffCount++;
          
          // Check for emergency fallback conditions
          if (this.shouldEmergencyFallback(context)) {
            this.logger.warn('Emergency fallback triggered', {
              taskId: task.id,
              handoffCount: context.handoffCount
            });
            return await this.emergencyFallback(task, context);
          }
          
          continue;
        }
        
        // Task completed successfully
        this.logger.info('Task completed successfully', {
          taskId: task.id,
          agent: currentAgent,
          handoffCount: context.handoffCount
        });
        
        return response;
      } catch (error) {
        this.logger.error('Agent execution failed', {
          taskId: task.id,
          agent: currentAgent,
          error
        });
        
        // Move to next agent in chain
        agentIndex++;
        
        // If we've exhausted all agents, throw the error
        if (agentIndex >= this.DELEGATION_CHAIN.length) {
          throw new Error(`All agents failed to process task ${task.id}: ${error.message}`);
        }
      }
    }
    
    // This should never be reached due to the while condition, but included for type safety
    throw new Error(`Failed to process task ${task.id} - delegation chain exhausted`);
  }

  /**
   * Execute a task with a specific agent
   * @param task The task to execute
   * @param agent The agent to use
   * @param context The execution context
   * @returns Task response
   */
  private async executeWithAgent(
    task: TaskRequest, 
    agent: AgentType, 
    context: TaskContext
  ): Promise<TaskResponse> {
    // Apply any preserved context from previous handoffs
    const contextualizedTask = this.applyContext(task, context);
    
    // Record execution attempt
    context.executionHistory.push({
      agent,
      timestamp: Date.now(),
      task: contextualizedTask
    });
    
    this.logger.debug('Executing task with agent', {
      taskId: task.id,
      agent,
      contextApplied: context.preservedState.size > 0
    });
    
    // Execute the task with the agent
    return await this.agentPool.executeTask(agent, contextualizedTask);
  }

  /**
   * Determine if a handoff is needed based on response quality
   * @param response The agent response
   * @param complexity The task complexity
   * @param context The execution context
   * @returns Whether a handoff should occur
   */
  private async shouldHandoff(
    response: TaskResponse, 
    complexity: TaskComplexity, 
    context: TaskContext
  ): Promise<boolean> {
    // Check response confidence
    if (response.confidence < 0.7) {
      this.logger.debug('Low confidence response, triggering handoff', {
        confidence: response.confidence,
        threshold: 0.7
      });
      return true;
    }
    
    // For high complexity tasks, require higher confidence
    if (complexity === TaskComplexity.HIGH && response.confidence < 0.85) {
      this.logger.debug('High complexity task with insufficient confidence, triggering handoff', {
        confidence: response.confidence,
        complexity,
        threshold: 0.85
      });
      return true;
    }
    
    // Check if response meets quality standards
    const qualityScore = await this.routingEngine.assessQuality(response);
    const requiredQuality = this.getRequiredQuality(complexity, context.handoffCount);
    
    if (qualityScore < requiredQuality) {
      this.logger.debug('Response quality below threshold, triggering handoff', {
        qualityScore,
        requiredQuality,
        handoffCount: context.handoffCount
      });
      return true;
    }
    
    // No handoff needed
    return false;
  }

  /**
   * Get required quality threshold based on complexity and handoff count
   * @param complexity The task complexity
   * @param handoffCount Number of previous handoffs
   * @returns Required quality score
   */
  private getRequiredQuality(complexity: TaskComplexity, handoffCount: number): number {
    // Base quality requirements by complexity
    let baseQuality: number;
    switch (complexity) {
      case TaskComplexity.LOW:
        baseQuality = 0.7;
        break;
      case TaskComplexity.MEDIUM:
        baseQuality = 0.75;
        break;
      case TaskComplexity.HIGH:
        baseQuality = 0.85;
        break;
      default:
        baseQuality = 0.75;
    }
    
    // Increase quality requirements with each handoff to prevent infinite loops
    const handoffPenalty = handoffCount * 0.05;
    
    return Math.min(0.95, baseQuality + handoffPenalty);
  }

  /**
   * Preserve context during handoff
   * @param context The execution context
   * @param response The response from the current agent
   * @param agent The agent that produced the response
   */
  private preserveContext(context: TaskContext, response: TaskResponse, agent: AgentType): void {
    // Preserve key information for next agent
    context.preservedState.set('previousResponse', response.content);
    context.preservedState.set('previousAgent', agent);
    context.preservedState.set('handoffReason', response.confidence < 0.7 ? 'low_confidence' : 'quality_insufficient');
    
    this.logger.debug('Context preserved for handoff', {
      preservedKeys: Array.from(context.preservedState.keys())
    });
  }

  /**
   * Apply preserved context to a task
   * @param task The task to contextualize
   * @param context The execution context
   * @returns Contextualized task
   */
  private applyContext(task: TaskRequest, context: TaskContext): TaskRequest {
    if (context.preservedState.size === 0) {
      return task;
    }
    
    // Create a new task with context information
    const contextualizedTask: TaskRequest = {
      ...task,
      context: {
        previousAttempts: context.executionHistory,
        preservedState: Object.fromEntries(context.preservedState),
        handoffCount: context.handoffCount
      }
    };
    
    this.logger.debug('Context applied to task', {
      taskId: task.id,
      handoffCount: context.handoffCount
    });
    
    return contextualizedTask;
  }

  /**
   * Determine if emergency fallback to Synthetic agents is needed
   * @param context The execution context
   * @returns Whether emergency fallback should occur
   */
  private shouldEmergencyFallback(context: TaskContext): boolean {
    // Emergency fallback if we've had too many handoffs
    if (context.handoffCount >= 3) {
      this.logger.warn('Handoff count threshold reached, emergency fallback triggered', {
        handoffCount: context.handoffCount
      });
      return true;
    }
    
    // Emergency fallback if we're already at the synthetic agent level
    const lastAttempt = context.executionHistory[context.executionHistory.length - 1];
    if (lastAttempt?.agent === AgentType.SYNTHETIC) {
      this.logger.warn('Synthetic agent already attempted, emergency fallback triggered');
      return true;
    }
    
    return false;
  }

  /**
   * Emergency fallback to Synthetic agents
   * @param task The original task
   * @param context The execution context
   * @returns Task response from Synthetic agent
   */
  private async emergencyFallback(task: TaskRequest, context: TaskContext): Promise<TaskResponse> {
    this.logger.info('Initiating emergency fallback to Synthetic agents', {
      taskId: task.id
    });
    
    // Apply all available context for the best chance of success
    const contextualizedTask = this.applyContext(task, context);
    
    try {
      // Try the Synthetic agent with maximum effort
      const response = await this.agentPool.executeTask(AgentType.SYNTHETIC, {
        ...contextualizedTask,
        priority: 'high', // Increase priority for emergency handling
        timeout: 30000 // Increase timeout for complex fallback processing
      });
      
      this.logger.info('Emergency fallback successful', {
        taskId: task.id
      });
      
      return response;
    } catch (error) {
      this.logger.error('Emergency fallback failed', {
        taskId: task.id,
        error
      });
      
      // If even emergency fallback fails, throw a critical error
      throw new Error(`Critical failure: All agents including emergency fallback failed for task ${task.id}`);
    }
  }
}