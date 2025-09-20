import { DatabaseService } from '../database/database-service';
import { Task, TaskStatus } from '../../types/task-types';

export class TaskDiscoveryService {
  constructor(private databaseService: DatabaseService) {}

  async discoverOpenTasks(): Promise<Task[]> {
    try {
      // Query database for open tasks (not completed or cancelled)
      const openTasks = await this.databaseService.queryTasks({
        status: { $in: ['pending', 'in-progress', 'paused'] }
      });
      
      // Sort by priority and last updated
      return openTasks.sort((a, b) => {
        // Higher priority first
        if (a.priority !== b.priority) {
          return (b.priority || 0) - (a.priority || 0);
        }
        // More recently updated first
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    } catch (error) {
      console.error('Error discovering open tasks:', error);
      return [];
    }
  }

  async discoverProjects(): Promise<Task[]> {
    try {
      const projects = await this.databaseService.queryTasks({
        type: 'project',
        status: { $in: ['pending', 'in-progress', 'paused'] }
      });
      
      return projects;
    } catch (error) {
      console.error('Error discovering projects:', error);
      return [];
    }
  }

  async discoverPlans(): Promise<Task[]> {
    try {
      const plans = await this.databaseService.queryTasks({
        type: 'plan',
        status: { $in: ['pending', 'in-progress', 'paused'] }
      });
      
      return plans;
    } catch (error) {
      console.error('Error discovering plans:', error);
      return [];
    }
  }

  async discoverRoadmaps(): Promise<Task[]> {
    try {
      const roadmaps = await this.databaseService.queryTasks({
        type: 'roadmap',
        status: { $in: ['pending', 'in-progress', 'paused'] }
      });
      
      return roadmaps;
    } catch (error) {
      console.error('Error discovering roadmaps:', error);
      return [];
    }
  }

  async discoverMacrotasks(): Promise<Task[]> {
    try {
      const macrotasks = await this.databaseService.queryTasks({
        type: 'macrotask',
        status: { $in: ['pending', 'in-progress', 'paused'] }
      });
      
      return macrotasks;
    } catch (error) {
      console.error('Error discovering macrotasks:', error);
      return [];
    }
  }

  async discoverMicrotasks(): Promise<Task[]> {
    try {
      const microtasks = await this.databaseService.queryTasks({
        type: 'microtask',
        status: { $in: ['pending', 'in-progress', 'paused'] }
      });
      
      return microtasks;
    } catch (error) {
      console.error('Error discovering microtasks:', error);
      return [];
    }
  }

  async getTaskHierarchy(taskId: string): Promise<Task[]> {
    try {
      const task = await this.databaseService.getTaskById(taskId);
      if (!task) return [];
      
      const hierarchy: Task[] = [task];
      
      // Get parent hierarchy
      let currentTask: Task | null = task;
      while (currentTask && currentTask.parentId) {
        currentTask = await this.databaseService.getTaskById(currentTask.parentId);
        if (currentTask) {
          hierarchy.unshift(currentTask);
        }
      }
      
      return hierarchy;
    } catch (error) {
      console.error(`Error getting task hierarchy for ${taskId}:`, error);
      return [];
    }
  }
}
