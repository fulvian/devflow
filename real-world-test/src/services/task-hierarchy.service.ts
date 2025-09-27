import { Task, TaskHierarchy } from '../types/project-structure';

export class TaskHierarchyService {
  private tasks: Map<string, Task> = new Map();
  private hierarchy: TaskHierarchy = { rootTasks: [], subtasks: {} };

  constructor() {
    this.initializeSampleTasks();
  }

  private initializeSampleTasks(): void {
    // Root tasks
    const setupProject: Task = {
      id: 'TASK-001',
      title: 'Project Setup',
      description: 'Initialize project structure and dependencies',
      status: 'done',
      tags: ['setup', 'infrastructure']
    };

    const implementAuth: Task = {
      id: 'TASK-002',
      title: 'Authentication System',
      description: 'Implement user authentication and authorization',
      status: 'in-progress',
      assignee: 'dev-001',
      tags: ['security', 'backend']
    };

    const implementUI: Task = {
      id: 'TASK-003',
      title: 'User Interface',
      description: 'Create responsive UI components',
      status: 'todo',
      tags: ['frontend', 'ui']
    };

    // Subtasks for authentication
    const authModels: Task = {
      id: 'TASK-002-01',
      title: 'Auth Models',
      description: 'Create user and session models',
      status: 'done',
      dependencies: ['TASK-001'],
      tags: ['backend', 'database']
    };

    const authAPI: Task = {
      id: 'TASK-002-02',
      title: 'Authentication API',
      description: 'Implement REST endpoints for authentication',
      status: 'in-progress',
      assignee: 'dev-001',
      dependencies: ['TASK-002-01'],
      tags: ['backend', 'api']
    };

    const authTests: Task = {
      id: 'TASK-002-03',
      title: 'Auth Tests',
      description: 'Write unit and integration tests for auth system',
      status: 'todo',
      dependencies: ['TASK-002-02'],
      tags: ['testing', 'backend']
    };

    // Add all tasks to map
    [setupProject, implementAuth, implementUI, authModels, authAPI, authTests].forEach(task => {
      this.tasks.set(task.id, task);
    });

    // Build hierarchy
    this.hierarchy.rootTasks = [setupProject.id, implementAuth.id, implementUI.id];
    this.hierarchy.subtasks[implementAuth.id] = [authModels.id, authAPI.id, authTests.id];
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  getTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  getTaskHierarchy(): TaskHierarchy {
    return this.hierarchy;
  }

  getSubtasks(parentId: string): Task[] {
    const subtaskIds = this.hierarchy.subtasks[parentId] || [];
    return subtaskIds.map(id => this.tasks.get(id)!).filter(Boolean);
  }

  updateTaskStatus(taskId: string, status: Task['status']): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
    }
  }
}