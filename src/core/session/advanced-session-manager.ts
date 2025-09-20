import { TaskHierarchyService } from '../tasks/task-hierarchy-service';
import { TaskDiscoveryService } from './task-discovery-service';
import { SessionStartupOrchestrator } from './session-startup-orchestrator';
import { DatabaseService } from '../database/database-service';
import { Session } from '../../types/session-types';
import { Task, TaskType } from '../../types/task-types';

export class AdvancedSessionManager {
  private session: Session | null = null;
  private taskDiscoveryService: TaskDiscoveryService;
  private sessionStartupOrchestrator: SessionStartupOrchestrator;
  
  constructor(
    private taskHierarchyService: TaskHierarchyService,
    private databaseService: DatabaseService
  ) {
    this.taskDiscoveryService = new TaskDiscoveryService(databaseService);
    this.sessionStartupOrchestrator = new SessionStartupOrchestrator(
      taskHierarchyService,
      databaseService,
      this.taskDiscoveryService
    );
  }

  async initializeSession(): Promise<Session> {
    // Create new session
    this.session = await this.createNewSession();
    
    // Save session to database
    await this.databaseService.saveSession(this.session);
    
    console.log(`New session created: ${this.session.id}`);
    
    // Discover open tasks
    const openTasks = await this.taskDiscoveryService.discoverOpenTasks();
    
    // Start session orchestration
    await this.sessionStartupOrchestrator.orchestrate(this.session, openTasks);
    
    return this.session;
  }

  private async createNewSession(): Promise<Session> {
    const sessionId = this.generateSessionId();
    const timestamp = new Date().toISOString();
    
    return {
      id: sessionId,
      createdAt: timestamp,
      updatedAt: timestamp,
      status: 'active',
      tasks: [],
      metadata: {
        claudeCodeVersion: '1.0.0',
        platform: process.platform,
        architecture: process.arch
      }
    };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async resumeTask(taskId: string): Promise<void> {
    if (!this.session) {
      throw new Error('No active session');
    }
    
    const task = await this.databaseService.getTaskById(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    // Add task to session
    this.session.tasks.push(taskId);
    await this.databaseService.updateSession(this.session);
    
    // Resume task execution
    await this.taskHierarchyService.resumeTask(taskId);
  }

  async createNewTask(taskType: TaskType, description: string, parentId?: string): Promise<Task> {
    if (!this.session) {
      throw new Error('No active session');
    }
    
    const task = await this.taskHierarchyService.createTask({
      type: taskType,
      description,
      parentId
    });
    
    // Add task to session
    this.session.tasks.push(task.id);
    await this.databaseService.updateSession(this.session);
    
    return task;
  }

  getSession(): Session | null {
    return this.session;
  }
}
