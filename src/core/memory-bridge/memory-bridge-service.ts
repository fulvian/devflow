/**
 * Memory Bridge Protocol Service
 * 
 * Bridges Synthetic agents with the DevFlow Cognitive Task+Memory System.
 * Manages context injection/harvesting with 2000 token budget constraints.
 * 
 * Integrates with validated TaskHierarchy and SemanticMemory foundations.
 */

import { TaskHierarchyService, TaskContext } from '../task-hierarchy/task-hierarchy-service';
import { SemanticMemoryService, SimilarityResult } from '../semantic-memory/semantic-memory-service';

// Types
export interface AgentContext {
  agentId: string;
  taskId: string;
  task: TaskContext;
  similarTasks: SimilarityResult[];
  tokenUsage: TokenUsage;
  timestamp: number;
  compressedContext?: string;
}

export interface TokenUsage {
  taskTokens: number;
  memoryTokens: number;
  totalTokens: number;
}

export interface MemoryHarvestResult {
  memoryId: string;
  agentId: string;
  taskId: string;
  harvestedContent: any;
  tokensSaved: number;
  timestamp: number;
}

export interface ContextInjectionResult {
  success: boolean;
  context: AgentContext;
  budgetRemaining: number;
  compressionApplied: boolean;
}

// Errors
export class BridgeError extends Error {
  constructor(message: string) {
    super(`Memory Bridge error: ${message}`);
    this.name = 'BridgeError';
  }
}

export class TokenBudgetExceededError extends Error {
  constructor(requested: number, available: number) {
    super(`Token budget exceeded: requested ${requested}, available ${available}`);
    this.name = 'TokenBudgetExceededError';
  }
}

/**
 * Memory Bridge Service - Main class
 */
export class MemoryBridgeService {
  private taskHierarchy: TaskHierarchyService;
  private semanticMemory: SemanticMemoryService;
  private maxTokenBudget: number = 2000;
  private currentBudget: number = 2000;
  private activeContexts: Map<string, AgentContext> = new Map();
  private compressionThreshold: number = 1800; // Apply compression when approaching limit

  constructor(
    taskHierarchy: TaskHierarchyService,
    semanticMemory: SemanticMemoryService,
    maxTokenBudget: number = 2000
  ) {
    this.taskHierarchy = taskHierarchy;
    this.semanticMemory = semanticMemory;
    this.maxTokenBudget = maxTokenBudget;
    this.currentBudget = maxTokenBudget;
  }

  /**
   * Initialize the Memory Bridge Service
   */
  async initialize(): Promise<void> {
    try {
      console.log('🌉 Initializing Memory Bridge Service...');
      this.resetBudget();
      console.log('✅ Memory Bridge Service initialized');
    } catch (error) {
      throw new BridgeError(`Failed to initialize: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Inject context into a Synthetic agent
   */
  async injectContext(agentId: string, taskId: string, modelId: string = 'test-embedding-model'): Promise<ContextInjectionResult> {
    try {
      console.log(`🔄 Injecting context for agent ${agentId}, task ${taskId}`);

      // Get the task
      const task = await this.taskHierarchy.getTaskById(taskId);
      if (!task) {
        throw new BridgeError(`Task ${taskId} not found`);
      }

      // Get similar tasks from semantic memory
      let similarTasks: SimilarityResult[] = [];
      try {
        similarTasks = await this.semanticMemory.findSimilarTasks(taskId, modelId, 5, 0.3);
      } catch (error) {
        console.warn(`⚠️ Could not find similar tasks: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Calculate token usage
      const tokenUsage = this.calculateTokenUsage(task, similarTasks);

      let compressionApplied = false;
      let finalSimilarTasks = similarTasks;

      // Check if we need compression
      if (tokenUsage.totalTokens > this.compressionThreshold) {
        console.log(`📦 Applying compression: ${tokenUsage.totalTokens} tokens > ${this.compressionThreshold} threshold`);
        
        finalSimilarTasks = await this.compressContext(similarTasks, tokenUsage.totalTokens - this.compressionThreshold);
        compressionApplied = true;
      }

      // Recalculate after compression
      const finalTokenUsage = this.calculateTokenUsage(task, finalSimilarTasks);

      // Check budget
      if (finalTokenUsage.totalTokens > this.currentBudget) {
        throw new TokenBudgetExceededError(finalTokenUsage.totalTokens, this.currentBudget);
      }

      // Create context
      const context: AgentContext = {
        agentId,
        taskId,
        task,
        similarTasks: finalSimilarTasks,
        tokenUsage: finalTokenUsage,
        timestamp: Date.now(),
        compressedContext: compressionApplied ? this.createCompressedContext(task, finalSimilarTasks) : undefined
      };

      // Update budget and store context
      this.currentBudget -= finalTokenUsage.totalTokens;
      this.activeContexts.set(`${agentId}-${taskId}`, context);

      console.log(`✅ Context injected: ${finalTokenUsage.totalTokens} tokens used, ${this.currentBudget} remaining`);

      return {
        success: true,
        context,
        budgetRemaining: this.currentBudget,
        compressionApplied
      };

    } catch (error) {
      if (error instanceof TokenBudgetExceededError) {
        throw error;
      }
      throw new BridgeError(`Context injection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Harvest memory from a Synthetic agent after task execution
   */
  async harvestMemory(
    agentId: string, 
    taskId: string, 
    executionResults: any,
    modelId: string = 'test-embedding-model'
  ): Promise<MemoryHarvestResult> {
    try {
      console.log(`🔄 Harvesting memory from agent ${agentId}, task ${taskId}`);

      const contextKey = `${agentId}-${taskId}`;
      const originalContext = this.activeContexts.get(contextKey);

      if (!originalContext) {
        throw new BridgeError(`No active context found for agent ${agentId}, task ${taskId}`);
      }

      // Create memory ID
      const memoryId = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Process and store results (in a real implementation, this would create embeddings)
      const harvestedContent = {
        agentId,
        taskId,
        results: executionResults,
        originalContext: originalContext.compressedContext || 'full-context',
        harvestTime: Date.now()
      };

      // Return tokens to budget
      this.currentBudget = Math.min(this.maxTokenBudget, this.currentBudget + originalContext.tokenUsage.totalTokens);

      // Clean up context
      this.activeContexts.delete(contextKey);

      console.log(`✅ Memory harvested: ${originalContext.tokenUsage.totalTokens} tokens returned, ${this.currentBudget} budget available`);

      return {
        memoryId,
        agentId,
        taskId,
        harvestedContent,
        tokensSaved: originalContext.tokenUsage.totalTokens,
        timestamp: Date.now()
      };

    } catch (error) {
      throw new BridgeError(`Memory harvesting failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get current budget status
   */
  getBudgetStatus(): { current: number; max: number; percentage: number; activeContexts: number } {
    return {
      current: this.currentBudget,
      max: this.maxTokenBudget,
      percentage: (this.currentBudget / this.maxTokenBudget) * 100,
      activeContexts: this.activeContexts.size
    };
  }

  /**
   * Reset token budget to maximum
   */
  resetBudget(): void {
    this.currentBudget = this.maxTokenBudget;
    this.activeContexts.clear();
    console.log(`🔄 Token budget reset to ${this.maxTokenBudget}`);
  }

  /**
   * Get active contexts
   */
  getActiveContexts(): AgentContext[] {
    return Array.from(this.activeContexts.values());
  }

  /**
   * Calculate token usage for task and similar tasks
   */
  private calculateTokenUsage(task: TaskContext, similarTasks: SimilarityResult[]): TokenUsage {
    // Simple token estimation (4 chars ≈ 1 token)
    const taskContent = JSON.stringify({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority
    });
    
    const taskTokens = Math.ceil(taskContent.length / 4);
    
    const memoryContent = JSON.stringify(similarTasks.map(st => ({
      taskId: st.taskId,
      similarity: st.similarity,
      title: st.task?.title,
      description: st.task?.description
    })));
    
    const memoryTokens = Math.ceil(memoryContent.length / 4);
    
    return {
      taskTokens,
      memoryTokens,
      totalTokens: taskTokens + memoryTokens
    };
  }

  /**
   * Compress context to reduce token usage
   */
  private async compressContext(
    similarTasks: SimilarityResult[], 
    excessTokens: number
  ): Promise<SimilarityResult[]> {
    // Simple compression: reduce number of similar tasks
    const maxTasks = Math.max(1, similarTasks.length - Math.ceil(excessTokens / 100));
    
    // Keep the most similar tasks
    return similarTasks.slice(0, maxTasks);
  }

  /**
   * Create compressed context string
   */
  private createCompressedContext(task: TaskContext, similarTasks: SimilarityResult[]): string {
    const compressed = {
      task: {
        id: task.id,
        title: task.title.substring(0, 50) + (task.title.length > 50 ? '...' : ''),
        status: task.status,
        priority: task.priority
      },
      similar: similarTasks.map(st => ({
        id: st.taskId,
        sim: Math.round(st.similarity * 100) / 100,
        title: st.task?.title?.substring(0, 30) + (st.task && st.task.title.length > 30 ? '...' : '')
      }))
    };
    
    return JSON.stringify(compressed);
  }
}

export default MemoryBridgeService;