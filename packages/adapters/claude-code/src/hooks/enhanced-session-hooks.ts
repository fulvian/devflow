// enhanced-session-hooks.ts
import { AdvancedSessionManager } from './advanced-session-manager';
import { Task, TaskStatus } from './types';
import { DatabaseService } from './database-service';
import { RealTimeMonitor } from './real-time-monitor';
import { UserInterface } from './user-interface';

/**
 * Enhanced Session Hooks for Claude Code
 * 
 * This module provides enhanced session management capabilities that:
 * - Auto-initialize on startup
 * - Discover and manage open tasks
 * - Provide interactive task selection
 * - Handle task creation workflows
 * - Persist session data
 * - Monitor sessions in real-time
 */
export class EnhancedSessionHooks {
  private sessionManager: AdvancedSessionManager;
  private database: DatabaseService;
  private monitor: RealTimeMonitor;
  private ui: UserInterface;
  private initialized: boolean = false;

  constructor() {
    this.sessionManager = new AdvancedSessionManager();
    this.database = new DatabaseService();
    this.monitor = new RealTimeMonitor();
    this.ui = new UserInterface();
  }

  /**
   * Auto-initialize the enhanced session hooks on startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize core services
      await this.sessionManager.initialize();
      await this.database.connect();
      await this.monitor.start();
      
      // Auto-discover open tasks
      const openTasks = await this.discoverOpenTasks();
      
      // Present interactive task selection if tasks exist
      if (openTasks.length > 0) {
        await this.presentTaskSelection(openTasks);
      } else {
        // Handle new task creation workflow
        await this.handleTaskCreation();
      }
      
      this.initialized = true;
      console.log('Enhanced session hooks initialized successfully');
    } catch (error) {
      console.error('Failed to initialize enhanced session hooks:', error);
      throw new Error(`Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Discover all open tasks in the system
   * @returns Array of open tasks
   */
  private async discoverOpenTasks(): Promise<Task[]> {
    try {
      const tasks = await this.database.getTasksByStatus(TaskStatus.OPEN);
      console.log(`Discovered ${tasks.length} open tasks`);
      return tasks;
    } catch (error) {
      console.error('Error discovering open tasks:', error);
      return [];
    }
  }

  /**
   * Present interactive task selection to the user
   * @param tasks Available tasks to select from
   */
  private async presentTaskSelection(tasks: Task[]): Promise<void> {
    try {
      const selectedTask = await this.ui.selectTask(tasks);
      
      if (selectedTask) {
        await this.sessionManager.resumeTaskSession(selectedTask.id);
        console.log(`Resumed session for task: ${selectedTask.id}`);
      } else {
        // User chose to create a new task
        await this.handleTaskCreation();
      }
    } catch (error) {
      console.error('Error during task selection:', error);
      throw error;
    }
  }

  /**
   * Handle the task creation workflow
   */
  private async handleTaskCreation(): Promise<void> {
    try {
      const taskDetails = await this.ui.createTaskWorkflow();
      
      if (taskDetails) {
        const newTask = await this.database.createTask(taskDetails);
        await this.sessionManager.startNewTaskSession(newTask.id);
        console.log(`Created and started session for new task: ${newTask.id}`);
      }
    } catch (error) {
      console.error('Error during task creation:', error);
      throw error;
    }
  }

  /**
   * Get current session status
   * @returns Current session information
   */
  getCurrentSession(): Task | null {
    return this.sessionManager.getCurrentSession();
  }

  /**
   * Terminate current session
   */
  async terminateSession(): Promise<void> {
    try {
      await this.sessionManager.endCurrentSession();
      console.log('Current session terminated');
    } catch (error) {
      console.error('Error terminating session:', error);
      throw error;
    }
  }

  /**
   * Get real-time session metrics
   * @returns Session metrics data
   */
  getSessionMetrics(): any {
    return this.monitor.getMetrics();
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    try {
      await this.sessionManager.cleanup();
      await this.database.disconnect();
      await this.monitor.stop();
      this.initialized = false;
      console.log('Enhanced session hooks destroyed');
    } catch (error) {
      console.error('Error during cleanup:', error);
      throw error;
    }
  }
}

// Export singleton instance for easy access
export const enhancedSessionHooks = new EnhancedSessionHooks();

// Auto-initialize on module import
(async () => {
  try {
    await enhancedSessionHooks.initialize();
  } catch (error) {
    console.error('Failed to auto-initialize enhanced session hooks:', error);
  }
})();