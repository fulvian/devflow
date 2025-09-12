// src/core/task-hierarchy/crud-operations.ts

import { Database } from 'better-sqlite3';
import { taskHierarchyDb } from './database';
import { 
  ProjectDefinition, 
  RoadmapPlan, 
  MacroTaskWithBranch, 
  MicroTaskGranular, 
  TaskStatus, 
  TaskPriority 
} from './types';

export class TaskHierarchyCRUD {
  private db: Database.Database;

  constructor() {
    this.db = taskHierarchyDb.getDatabase();
  }

  // Project CRUD Operations
  public createProject(project: Omit<ProjectDefinition, 'id' | 'createdAt' | 'updatedAt'>): ProjectDefinition {
    const id = this.generateId();
    const createdAt = new Date();
    const updatedAt = new Date();
    
    const stmt = this.db.prepare(`
      INSERT INTO progetti (id, title, description, start_date, end_date, status, priority, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      project.title,
      project.description,
      project.startDate.toISOString(),
      project.endDate.toISOString(),
      project.status,
      project.priority,
      createdAt.toISOString(),
      updatedAt.toISOString()
    );
    
    return { ...project, id, createdAt, updatedAt };
  }

  public getProjectById(id: string): ProjectDefinition | null {
    const stmt = this.db.prepare('SELECT * FROM progetti WHERE id = ?');
    const result = stmt.get(id);
    
    if (!result) return null;
    
    return this.mapToProject(result);
  }

  public updateProject(id: string, updates: Partial<ProjectDefinition>): ProjectDefinition | null {
    const project = this.getProjectById(id);
    if (!project) return null;
    
    const updatedProject = { ...project, ...updates, updatedAt: new Date() };
    
    const stmt = this.db.prepare(`
      UPDATE progetti 
      SET title = ?, description = ?, start_date = ?, end_date = ?, status = ?, priority = ?, updated_at = ?
      WHERE id = ?
    `);
    
    stmt.run(
      updatedProject.title,
      updatedProject.description,
      updatedProject.startDate.toISOString(),
      updatedProject.endDate.toISOString(),
      updatedProject.status,
      updatedProject.priority,
      updatedProject.updatedAt.toISOString(),
      id
    );
    
    return updatedProject;
  }

  public deleteProject(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM progetti WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Roadmap CRUD Operations
  public createRoadmap(roadmap: Omit<RoadmapPlan, 'id' | 'createdAt' | 'updatedAt'>): RoadmapPlan {
    const id = this.generateId();
    const createdAt = new Date();
    const updatedAt = new Date();
    
    const stmt = this.db.prepare(`
      INSERT INTO roadmaps (id, project_id, title, description, start_date, end_date, status, priority, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      roadmap.projectId,
      roadmap.title,
      roadmap.description,
      roadmap.startDate.toISOString(),
      roadmap.endDate.toISOString(),
      roadmap.status,
      roadmap.priority,
      createdAt.toISOString(),
      updatedAt.toISOString()
    );
    
    return { ...roadmap, id, createdAt, updatedAt };
  }

  public getRoadmapById(id: string): RoadmapPlan | null {
    const stmt = this.db.prepare('SELECT * FROM roadmaps WHERE id = ?');
    const result = stmt.get(id);
    
    if (!result) return null;
    
    return this.mapToRoadmap(result);
  }

  // Macro Task CRUD Operations
  public createMacroTask(macroTask: Omit<MacroTaskWithBranch, 'id' | 'createdAt' | 'updatedAt'>): MacroTaskWithBranch {
    const id = this.generateId();
    const createdAt = new Date();
    const updatedAt = new Date();
    
    const stmt = this.db.prepare(`
      INSERT INTO macro_tasks (id, roadmap_id, title, description, branch_name, estimated_hours, status, priority, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      macroTask.roadmapId,
      macroTask.title,
      macroTask.description,
      macroTask.branchName,
      macroTask.estimatedHours,
      macroTask.status,
      macroTask.priority,
      createdAt.toISOString(),
      updatedAt.toISOString()
    );
    
    return { ...macroTask, id, createdAt, updatedAt };
  }

  public getMacroTaskById(id: string): MacroTaskWithBranch | null {
    const stmt = this.db.prepare('SELECT * FROM macro_tasks WHERE id = ?');
    const result = stmt.get(id);
    
    if (!result) return null;
    
    return this.mapToMacroTask(result);
  }

  // Micro Task CRUD Operations
  public createMicroTask(microTask: Omit<MicroTaskGranular, 'id' | 'createdAt' | 'updatedAt'>): MicroTaskGranular {
    const id = this.generateId();
    const createdAt = new Date();
    const updatedAt = new Date();
    
    const stmt = this.db.prepare(`
      INSERT INTO micro_tasks (id, macro_task_id, title, description, estimated_minutes, status, priority, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      microTask.macroTaskId,
      microTask.title,
      microTask.description,
      microTask.estimatedMinutes,
      microTask.status,
      microTask.priority,
      createdAt.toISOString(),
      updatedAt.toISOString()
    );
    
    return { ...microTask, id, createdAt, updatedAt };
  }

  public getMicroTaskById(id: string): MicroTaskGranular | null {
    const stmt = this.db.prepare('SELECT * FROM micro_tasks WHERE id = ?');
    const result = stmt.get(id);
    
    if (!result) return null;
    
    return this.mapToMicroTask(result);
  }

  // Batch Operations
  public batchCreateProjects(projects: Array<Omit<ProjectDefinition, 'id' | 'createdAt' | 'updatedAt'>>): ProjectDefinition[] {
    const transaction = this.db.transaction(() => {
      return projects.map(project => this.createProject(project));
    });
    
    return transaction();
  }

  // Utility Methods
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private mapToProject(row: any): ProjectDefinition {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      startDate: new Date(row.start_date),
      endDate: new Date(row.end_date),
      status: row.status as TaskStatus,
      priority: row.priority as TaskPriority,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapToRoadmap(row: any): RoadmapPlan {
    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      startDate: new Date(row.start_date),
      endDate: new Date(row.end_date),
      status: row.status as TaskStatus,
      priority: row.priority as TaskPriority,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapToMacroTask(row: any): MacroTaskWithBranch {
    return {
      id: row.id,
      roadmapId: row.roadmap_id,
      title: row.title,
      description: row.description,
      branchName: row.branch_name,
      estimatedHours: row.estimated_hours,
      actualHours: row.actual_hours,
      status: row.status as TaskStatus,
      priority: row.priority as TaskPriority,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapToMicroTask(row: any): MicroTaskGranular {
    return {
      id: row.id,
      macroTaskId: row.macro_task_id,
      title: row.title,
      description: row.description,
      estimatedMinutes: row.estimated_minutes,
      actualMinutes: row.actual_minutes,
      status: row.status as TaskStatus,
      priority: row.priority as TaskPriority,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

export const taskHierarchyCRUD = new TaskHierarchyCRUD();
