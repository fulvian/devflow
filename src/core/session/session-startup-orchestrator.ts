import { TaskHierarchyService } from '../tasks/task-hierarchy-service';
import { TaskDiscoveryService } from './task-discovery-service';
import { DatabaseService } from '../database/database-service';
import { Session } from '../../types/session-types';
import { Task, TaskType } from '../../types/task-types';

export class SessionStartupOrchestrator {
  constructor(
    private taskHierarchyService: TaskHierarchyService,
    private databaseService: DatabaseService,
    private taskDiscoveryService: TaskDiscoveryService
  ) {}

  async orchestrate(session: Session, openTasks: Task[]): Promise<void> {
    console.log('Starting session orchestration...');
    
    if (openTasks.length > 0) {
      await this.handleOpenTasks(session, openTasks);
    } else {
      await this.handleNoOpenTasks(session);
    }
  }

  private async handleOpenTasks(session: Session, openTasks: Task[]): Promise<void> {
    console.log(`Found ${openTasks.length} open tasks. Presenting options...`);
    
    // In a real implementation, this would present an interactive interface
    // For now, we'll simulate user selection
    const selectedTask = await this.presentTaskSelection(openTasks);
    
    if (selectedTask) {
      await this.resumeSelectedTask(session, selectedTask);
    }
  }

  private async handleNoOpenTasks(session: Session): Promise<void> {
    console.log('No open tasks found. Asking user what to do...');
    
    // In a real implementation, this would present an interactive interface
    // For now, we'll simulate user decision
    const decision = await this.presentCreationOptions();
    
    switch (decision.type) {
      case 'macrotask':
        await this.createMacrotaskWithMicrotasks(session, decision.description);
        break;
      case 'microtask':
        await this.createSimpleMicrotask(session, decision.description);
        break;
      case 'project':
        await this.createProject(session, decision.description);
        break;
      default:
        console.log('No action selected');
    }
  }

  private async presentTaskSelection(openTasks: Task[]): Promise<Task | null> {
    // Simulate user selection
    // In a real implementation, this would present an interactive CLI or GUI
    console.log('Open tasks:');
    openTasks.forEach((task, index) => {
      console.log(`${index + 1}. [${task.type}] ${task.description} (${task.status})`);
    });
    
    // For simulation, return the first task
    return openTasks[0] || null;
  }

  private async presentCreationOptions(): Promise<{type: TaskType, description: string}> {
    // Simulate user decision
    // In a real implementation, this would present an interactive CLI or GUI
    console.log('What would you like to do?');
    console.log('1. Create a new macrotask with microtasks');
    console.log('2. Create a simple microtask');
    console.log('3. Create a new project');
    
    // For simulation, return a default option
    return {
      type: 'microtask',
      description: 'Quick fix for session startup'
    };
  }

  private async resumeSelectedTask(session: Session, task: Task): Promise<void> {
    console.log(`Resuming task: ${task.description}`);
    
    // Add task to session
    session.tasks.push(task.id);
    await this.databaseService.updateSession(session);
    
    // Get task hierarchy for context
    const hierarchy = await this.taskDiscoveryService.getTaskHierarchy(task.id);
    console.log('Task context:', hierarchy.map(t => t.description).join(' -> '));
    
    // Resume task execution
    await this.taskHierarchyService.resumeTask(task.id);
  }

  private async createMacrotaskWithMicrotasks(session: Session, description: string): Promise<void> {
    console.log(`Creating macrotask: ${description}`);
    
    // Create macrotask
    const macrotask = await this.taskHierarchyService.createTask({
      type: 'macrotask',
      description
    });
    
    // Add to session
    session.tasks.push(macrotask.id);
    await this.databaseService.updateSession(session);
    
    // Create some microtasks
    const microtask1 = await this.taskHierarchyService.createTask({
      type: 'microtask',
      description: `Subtask 1 for ${description}`,
      parentId: macrotask.id
    });
    
    const microtask2 = await this.taskHierarchyService.createTask({
      type: 'microtask',
      description: `Subtask 2 for ${description}`,
      parentId: macrotask.id
    });
    
    console.log(`Created macrotask ${macrotask.id} with microtasks ${microtask1.id}, ${microtask2.id}`);
  }

  private async createSimpleMicrotask(session: Session, description: string): Promise<void> {
    console.log(`Creating microtask: ${description}`);
    
    // Create microtask
    const microtask = await this.taskHierarchyService.createTask({
      type: 'microtask',
      description
    });
    
    // Add to session
    session.tasks.push(microtask.id);
    await this.databaseService.updateSession(session);
    
    console.log(`Created microtask ${microtask.id}`);
  }

  private async createProject(session: Session, description: string): Promise<void> {
    console.log(`Creating project: ${description}`);
    
    // Create project
    const project = await this.taskHierarchyService.createTask({
      type: 'project',
      description
    });
    
    // Add to session
    session.tasks.push(project.id);
    await this.databaseService.updateSession(session);
    
    console.log(`Created project ${project.id}`);
  }
}
