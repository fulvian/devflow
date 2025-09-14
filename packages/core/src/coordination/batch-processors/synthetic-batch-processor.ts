/**
 * Batch Delegation Processor for Synthetic Agents
 * Task ID: CCR-007-BATCH-DELEGATION
 * 
 * This module provides a specialized batch processor that handles task distribution
 * among synthetic agents with MCP integration, intelligent batching based on
 * agent capabilities, and robust error recovery mechanisms.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// Type definitions
export interface AgentCapability {
  id: string;
  name: string;
  maxConcurrentTasks: number;
  processingPower: number; // 1-10 scale
  supportedTaskTypes: string[];
  currentLoad: number;
}

export interface Task {
  id: string;
  type: string;
  priority: number; // 1-10 scale, 10 is highest
  payload: any;
  createdAt: Date;
  assignedAgentId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface Batch {
  id: string;
  tasks: Task[];
  agentId: string;
  status: 'created' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  performanceMetrics?: BatchPerformanceMetrics;
}

export interface BatchPerformanceMetrics {
  processingTime: number; // in milliseconds
  resourceUtilization: number; // 0-1 scale
  successRate: number; // 0-1 scale
}

export interface BatchProcessorConfig {
  maxBatchSize: number;
  minBatchSize: number;
  batchSizeOptimizationInterval: number; // in milliseconds
  retryAttempts: number;
  retryDelay: number; // in milliseconds
  monitoringInterval: number; // in milliseconds
}

export interface PerformanceReport {
  totalTasksProcessed: number;
  totalBatchesProcessed: number;
  averageBatchProcessingTime: number;
  resourceUtilization: number;
  errorRate: number;
}

// MCP (Multi-Agent Control Protocol) Integration Interface
interface MCPIntegration {
  registerAgent(agent: AgentCapability): Promise<void>;
  unregisterAgent(agentId: string): Promise<void>;
  getAvailableAgents(): Promise<AgentCapability[]>;
  assignTask(agentId: string, task: Task): Promise<boolean>;
  getAgentStatus(agentId: string): Promise<{ load: number; status: 'active' | 'inactive' }>;
}

// Mock MCP implementation for demonstration
class MockMCPIntegration implements MCPIntegration {
  private agents: Map<string, AgentCapability> = new Map();

  async registerAgent(agent: AgentCapability): Promise<void> {
    this.agents.set(agent.id, agent);
  }

  async unregisterAgent(agentId: string): Promise<void> {
    this.agents.delete(agentId);
  }

  async getAvailableAgents(): Promise<AgentCapability[]> {
    return Array.from(this.agents.values()).filter(agent => agent.currentLoad < agent.maxConcurrentTasks);
  }

  async assignTask(agentId: string, task: Task): Promise<boolean> {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    
    if (agent.currentLoad < agent.maxConcurrentTasks) {
      agent.currentLoad++;
      return true;
    }
    return false;
  }

  async getAgentStatus(agentId: string): Promise<{ load: number; status: 'active' | 'inactive' }> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return { load: 0, status: 'inactive' };
    }
    return { load: agent.currentLoad, status: 'active' };
  }
}

// Main Batch Processor Class
export class BatchDelegationProcessor extends EventEmitter {
  private tasks: Task[] = [];
  private batches: Batch[] = [];
  private agents: AgentCapability[] = [];
  private isProcessing: boolean = false;
  private config: BatchProcessorConfig;
  private mcp: MCPIntegration;
  private performanceMetrics: PerformanceReport = {
    totalTasksProcessed: 0,
    totalBatchesProcessed: 0,
    averageBatchProcessingTime: 0,
    resourceUtilization: 0,
    errorRate: 0
  };
  private batchSizeHistory: number[] = [];
  private processingStartTime: number = 0;

  constructor(config: Partial<BatchProcessorConfig> = {}, mcp?: MCPIntegration) {
    super();
    this.config = {
      maxBatchSize: config.maxBatchSize || 50,
      minBatchSize: config.minBatchSize || 5,
      batchSizeOptimizationInterval: config.batchSizeOptimizationInterval || 30000, // 30 seconds
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000, // 1 second
      monitoringInterval: config.monitoringInterval || 5000 // 5 seconds
    };
    this.mcp = mcp || new MockMCPIntegration();
    
    // Start monitoring
    setInterval(() => this.monitorPerformance(), this.config.monitoringInterval);
    
    // Start batch size optimization
    setInterval(() => this.optimizeBatchSize(), this.config.batchSizeOptimizationInterval);
  }

  /**
   * Add a task to the processing queue
   */
  async addTask(task: Omit<Task, 'id' | 'createdAt' | 'status'>): Promise<string> {
    const newTask: Task = {
      id: uuidv4(),
      ...task,
      createdAt: new Date(),
      status: 'pending'
    };
    
    this.tasks.push(newTask);
    this.emit('taskAdded', newTask);
    
    if (!this.isProcessing) {
      this.processTasks();
    }
    
    return newTask.id;
  }

  /**
   * Register a synthetic agent with its capabilities
   */
  async registerAgent(agent: Omit<AgentCapability, 'currentLoad'>): Promise<void> {
    const agentWithLoad: AgentCapability = {
      ...agent,
      currentLoad: 0
    };
    
    this.agents.push(agentWithLoad);
    await this.mcp.registerAgent(agentWithLoad);
    this.emit('agentRegistered', agentWithLoad);
  }

  /**
   * Unregister an agent
   */
  async unregisterAgent(agentId: string): Promise<void> {
    this.agents = this.agents.filter(agent => agent.id !== agentId);
    await this.mcp.unregisterAgent(agentId);
    this.emit('agentUnregistered', agentId);
  }

  /**
   * Main processing loop
   */
  private async processTasks(): Promise<void> {
    if (this.isProcessing || this.tasks.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.processingStartTime = Date.now();
    
    try {
      // Refresh agent information
      this.agents = await this.mcp.getAvailableAgents();
      
      // Sort tasks by priority
      this.tasks.sort((a, b) => b.priority - a.priority);
      
      // Create batches based on agent capabilities
      const batches = this.createBatches();
      
      // Process batches concurrently
      await this.processBatches(batches);
      
    } catch (error) {
      this.emit('error', error);
    } finally {
      this.isProcessing = false;
      
      // Continue processing if there are more tasks
      if (this.tasks.length > 0) {
        setImmediate(() => this.processTasks());
      }
    }
  }

  /**
   * Create optimized batches based on agent capabilities
   */
  private createBatches(): Batch[] {
    const batches: Batch[] = [];
    const unassignedTasks = [...this.tasks];
    const availableAgents = [...this.agents];
    
    // Sort agents by processing power (descending)
    availableAgents.sort((a, b) => b.processingPower - a.processingPower);
    
    for (const agent of availableAgents) {
      if (unassignedTasks.length === 0) break;
      
      // Find tasks that match agent capabilities
      const compatibleTasks = unassignedTasks.filter(task => 
        agent.supportedTaskTypes.includes(task.type)
      );
      
      if (compatibleTasks.length === 0) continue;
      
      // Determine optimal batch size for this agent
      const batchSize = this.calculateBatchSize(agent);
      const tasksForBatch = compatibleTasks.slice(0, batchSize);
      
      // Remove assigned tasks from unassigned list
      tasksForBatch.forEach(task => {
        const index = unassignedTasks.findIndex(t => t.id === task.id);
        if (index !== -1) {
          unassignedTasks.splice(index, 1);
        }
      });
      
      // Create batch
      const batch: Batch = {
        id: uuidv4(),
        tasks: tasksForBatch.map(task => ({
          ...task,
          assignedAgentId: agent.id,
          status: 'processing'
        })),
        agentId: agent.id,
        status: 'created',
        createdAt: new Date()
      };
      
      batches.push(batch);
      
      // Update agent load
      agent.currentLoad += tasksForBatch.length;
    }
    
    // Handle remaining tasks (tasks that couldn't be assigned)
    if (unassignedTasks.length > 0) {
      this.emit('unassignedTasks', unassignedTasks);
    }
    
    // Remove assigned tasks from main task queue
    this.tasks = this.tasks.filter(task => 
      !batches.some(batch => 
        batch.tasks.some(t => t.id === task.id)
      )
    );
    
    return batches;
  }

  /**
   * Calculate optimal batch size for an agent
   */
  private calculateBatchSize(agent: AgentCapability): number {
    // Base batch size on agent's processing power
    const baseSize = Math.floor(
      this.config.minBatchSize + 
      (this.config.maxBatchSize - this.config.minBatchSize) * 
      (agent.processingPower / 10)
    );
    
    // Adjust based on current load
    const loadFactor = 1 - (agent.currentLoad / agent.maxConcurrentTasks);
    const adjustedSize = Math.floor(baseSize * loadFactor);
    
    // Ensure within bounds
    return Math.max(
      this.config.minBatchSize,
      Math.min(this.config.maxBatchSize, adjustedSize)
    );
  }

  /**
   * Process batches concurrently
   */
  private async processBatches(batches: Batch[]): Promise<void> {
    if (batches.length === 0) return;
    
    this.batches.push(...batches);
    
    // Process batches concurrently with limited concurrency
    const concurrencyLimit = Math.min(batches.length, 5); // Max 5 concurrent batch processes
    const batchPromises = batches.map(batch => this.processBatch(batch));
    
    // Process in chunks to respect concurrency limit
    for (let i = 0; i < batchPromises.length; i += concurrencyLimit) {
      const chunk = batchPromises.slice(i, i + concurrencyLimit);
      await Promise.all(chunk);
    }
  }

  /**
   * Process a single batch
   */
  private async processBatch(batch: Batch): Promise<void> {
    batch.status = 'processing';
    batch.startedAt = new Date();
    
    this.emit('batchStarted', batch);
    
    try {
      // Simulate batch processing with MCP integration
      await this.executeBatchWithMCP(batch);
      
      batch.status = 'completed';
      batch.completedAt = new Date();
      
      // Calculate performance metrics
      const processingTime = batch.completedAt.getTime() - batch.startedAt.getTime();
      const resourceUtilization = batch.tasks.length / this.config.maxBatchSize;
      const successRate = batch.tasks.filter(t => t.status === 'completed').length / batch.tasks.length;
      
      batch.performanceMetrics = {
        processingTime,
        resourceUtilization,
        successRate
      };
      
      this.performanceMetrics.totalBatchesProcessed++;
      this.performanceMetrics.totalTasksProcessed += batch.tasks.length;
      
      this.emit('batchCompleted', batch);
    } catch (error) {
      batch.status = 'failed';
      batch.completedAt = new Date();
      
      this.emit('batchFailed', { batch, error });
      
      // Attempt recovery
      await this.handleBatchFailure(batch, error);
    }
  }

  /**
   * Execute batch tasks through MCP
   */
  private async executeBatchWithMCP(batch: Batch): Promise<void> {
    // Assign tasks to agent via MCP
    const assignmentResults = await Promise.all(
      batch.tasks.map(task => this.mcp.assignTask(batch.agentId, task))
    );
    
    // Check if all tasks were successfully assigned
    if (!assignmentResults.every(result => result)) {
      throw new Error('Failed to assign all tasks to agent');
    }
    
    // Simulate task processing
    const processingPromises = batch.tasks.map(task => 
      this.processTaskWithRetry(task)
    );
    
    await Promise.all(processingPromises);
  }

  /**
   * Process individual task with retry logic
   */
  private async processTaskWithRetry(task: Task): Promise<void> {
    let attempts = 0;
    
    while (attempts <= this.config.retryAttempts) {
      try {
        // Simulate task processing
        await this.simulateTaskProcessing(task);
        task.status = 'completed';
        return;
      } catch (error) {
        attempts++;
        if (attempts > this.config.retryAttempts) {
          task.status = 'failed';
          task.error = error instanceof Error ? error.message : String(error);
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempts));
      }
    }
  }

  /**
   * Simulate task processing
   */
  private async simulateTaskProcessing(task: Task): Promise<void> {
    // Simulate processing time based on task priority and complexity
    const processingTime = Math.random() * 1000 * (11 - task.priority);
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // Simulate occasional failures for testing
    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error(`Processing failed for task ${task.id}`);
    }
    
    task.result = { processedAt: new Date(), output: `Processed: ${task.payload}` };
  }

  /**
   * Handle batch failure with recovery mechanisms
   */
  private async handleBatchFailure(batch: Batch, error: any): Promise<void> {
    this.emit('batchRecoveryStarted', batch);
    
    try {
      // Attempt to redistribute tasks to other agents
      const redistributionSuccess = await this.redistributeBatchTasks(batch);
      
      if (redistributionSuccess) {
        this.emit('batchRecoverySuccess', batch);
      } else {
        // If redistribution fails, mark all tasks as failed
        batch.tasks.forEach(task => {
          task.status = 'failed';
          task.error = `Batch failed: ${error.message}`;
        });
        this.emit('batchRecoveryFailed', { batch, error });
      }
    } catch (recoveryError) {
      this.emit('recoveryError', { batch, error: recoveryError });
    }
  }

  /**
   * Redistribute failed batch tasks to other agents
   */
  private async redistributeBatchTasks(batch: Batch): Promise<boolean> {
    const availableAgents = await this.mcp.getAvailableAgents();
    const failedTasks = batch.tasks.filter(task => task.status === 'failed');
    
    if (failedTasks.length === 0) return true;
    
    let redistributionSuccess = true;
    
    for (const task of failedTasks) {
      // Find another agent that can handle this task
      const compatibleAgent = availableAgents.find(agent => 
        agent.id !== batch.agentId && 
        agent.supportedTaskTypes.includes(task.type) &&
        agent.currentLoad < agent.maxConcurrentTasks
      );
      
      if (compatibleAgent) {
        try {
          const assigned = await this.mcp.assignTask(compatibleAgent.id, task);
          if (assigned) {
            task.assignedAgentId = compatibleAgent.id;
            task.status = 'processing';
            // Re-process the task
            await this.processTaskWithRetry(task);
          } else {
            redistributionSuccess = false;
          }
        } catch {
          redistributionSuccess = false;
        }
      } else {
        redistributionSuccess = false;
      }
    }
    
    return redistributionSuccess;
  }

  /**
   * Optimize batch size based on performance history
   */
  private optimizeBatchSize(): void {
    if (this.batchSizeHistory.length === 0) return;
    
    const averageBatchSize = this.batchSizeHistory.reduce((sum, size) => sum + size, 0) / this.batchSizeHistory.length;
    
    // Adjust config based on performance
    if (averageBatchSize > this.config.maxBatchSize * 0.8) {
      // Increase max batch size if we're consistently using high percentages
      this.config.maxBatchSize = Math.min(100, this.config.maxBatchSize + 5);
    } else if (averageBatchSize < this.config.minBatchSize * 1.2) {
      // Decrease min batch size if we're consistently using low percentages
      this.config.minBatchSize = Math.max(1, this.config.minBatchSize - 1);
    }
    
    // Clear history for next optimization cycle
    this.batchSizeHistory = [];
  }

  /**
   * Monitor system performance
   */
  private monitorPerformance(): void {
    const currentTime = Date.now();
    const uptime = currentTime - this.processingStartTime;
    
    if (uptime > 0) {
      // Calculate current resource utilization
      const totalAgentCapacity = this.agents.reduce((sum, agent) => sum + agent.maxConcurrentTasks, 0);
      const currentLoad = this.agents.reduce((sum, agent) => sum + agent.currentLoad, 0);
      
      this.performanceMetrics.resourceUtilization = totalAgentCapacity > 0 ? currentLoad / totalAgentCapacity : 0;
      
      this.emit('performanceUpdate', this.performanceMetrics);
    }
  }

  /**
   * Get current performance report
   */
  getPerformanceReport(): PerformanceReport {
    return { ...this.performanceMetrics };
  }

  /**
   * Get current system status
   */
  getStatus(): {
    pendingTasks: number;
    activeBatches: number;
    registeredAgents: number;
    isProcessing: boolean;
  } {
    return {
      pendingTasks: this.tasks.length,
      activeBatches: this.batches.filter(b => b.status === 'processing').length,
      registeredAgents: this.agents.length,
      isProcessing: this.isProcessing
    };
  }
}

// Export types for external use
export default BatchDelegationProcessor;