import { Task } from '../task/task';
import { GitHubAutomationService } from './github-automation-service';
import { EventEmitter } from 'events';

export class TaskCompletionMonitor extends EventEmitter {
  private githubService: GitHubAutomationService;
  private batchThreshold: number;
  private taskBatch: Task[];
  private batchTimer: NodeJS.Timeout | null;
  private batchTimeout: number;

  constructor(batchThreshold: number = 5, batchTimeout: number = 30000) {
    super();
    this.githubService = new GitHubAutomationService();
    this.batchThreshold = batchThreshold;
    this.taskBatch = [];
    this.batchTimeout = batchTimeout;
    this.batchTimer = null;
    
    // Listen for task completion events
    this.on('taskCompleted', this.handleTaskCompletion.bind(this));
    this.on('macroTaskCompleted', this.handleMacroTaskCompletion.bind(this));
  }

  async handleTaskCompletion(task: Task): Promise<void> {
    try {
      // Add task to batch
      this.taskBatch.push(task);
      
      // Clear existing timer
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }
      
      // If batch threshold is met, process immediately
      if (this.taskBatch.length >= this.batchThreshold) {
        await this.processBatch();
      } else {
        // Set timer to process batch after timeout
        this.batchTimer = setTimeout(() => {
          this.processBatch();
        }, this.batchTimeout);
      }
    } catch (error) {
      console.error('Error handling task completion:', error);
    }
  }

  async handleMacroTaskCompletion(tasks: Task[]): Promise<void> {
    try {
      await this.githubService.handleMacroTaskCompletion(tasks);
    } catch (error) {
      console.error('Error handling macro task completion:', error);
    }
  }

  private async processBatch(): Promise<void> {
    if (this.taskBatch.length === 0) return;
    
    const batch = [...this.taskBatch];
    this.taskBatch = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    try {
      // Process single task if batch has only one item
      if (batch.length === 1) {
        await this.githubService.handleTaskCompletion(batch[0]);
      } else {
        // Process as batch
        for (const task of batch) {
          await this.githubService.handleTaskCompletion(task, true);
        }
      }
    } catch (error) {
      console.error('Error processing task batch:', error);
      // Re-add tasks to batch for retry
      this.taskBatch.unshift(...batch);
    }
  }

  async configure(triggerConditions: any): Promise<void> {
    // Configure monitor based on trigger conditions
    if (triggerConditions.batchThreshold) {
      this.batchThreshold = triggerConditions.batchThreshold;
    }
    
    if (triggerConditions.batchTimeout) {
      this.batchTimeout = triggerConditions.batchTimeout;
    }
    
    await this.githubService.configure(triggerConditions);
  }
}
