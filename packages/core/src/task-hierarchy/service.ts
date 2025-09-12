import Database from 'better-sqlite3';
import type { ProjectDefinition, RoadmapPlan, MacroTaskWithBranch, MicroTaskGranular } from './types';

export class TaskHierarchyService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.pragma('foreign_keys = ON');

    // Create projects table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS progetti (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT CHECK(status IN ('active', 'completed', 'archived', 'paused')) DEFAULT 'active',
        priority INTEGER DEFAULT 1,
        metadata TEXT
      );
    `);

    // Create roadmaps table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS roadmaps (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        start_date DATETIME,
        end_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT CHECK(status IN ('planning', 'active', 'completed', 'archived')) DEFAULT 'planning',
        priority INTEGER DEFAULT 1,
        progress INTEGER CHECK(progress >= 0 AND progress <= 100) DEFAULT 0,
        metadata TEXT,
        FOREIGN KEY (project_id) REFERENCES progetti(id) ON DELETE CASCADE
      );
    `);

    // Create macro tasks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS macro_tasks (
        id TEXT PRIMARY KEY,
        roadmap_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        start_date DATETIME,
        end_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT CHECK(status IN ('pending', 'in-progress', 'completed', 'blocked', 'cancelled')) DEFAULT 'pending',
        priority INTEGER DEFAULT 1,
        progress INTEGER CHECK(progress >= 0 AND progress <= 100) DEFAULT 0,
        dependencies TEXT,
        assignee TEXT,
        metadata TEXT,
        FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE
      );
    `);

    // Create micro tasks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS micro_tasks (
        id TEXT PRIMARY KEY,
        macro_task_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        estimated_duration INTEGER,
        actual_duration INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT CHECK(status IN ('todo', 'in-progress', 'review', 'completed', 'blocked', 'cancelled')) DEFAULT 'todo',
        priority INTEGER DEFAULT 1,
        progress INTEGER CHECK(progress >= 0 AND progress <= 100) DEFAULT 0,
        dependencies TEXT,
        assignee TEXT,
        tags TEXT,
        metadata TEXT,
        FOREIGN KEY (macro_task_id) REFERENCES macro_tasks(id) ON DELETE CASCADE
      );
    `);
  }

  // PROJECT CRUD OPERATIONS
  createProject(project: Omit<ProjectDefinition, 'id' | 'createdAt' | 'updatedAt'>): ProjectDefinition {
    const id = this.generateId();
    const createdAt = new Date();
    const updatedAt = new Date();
    
    const stmt = this.db.prepare(`
      INSERT INTO progetti (id, name, description, status, priority, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      project.name,
      project.description || null,
      project.status || 'active',
      project.priority || 1,
      project.metadata ? JSON.stringify(project.metadata) : null,
      createdAt.toISOString(),
      updatedAt.toISOString()
    );
    
    return {
      id,
      name: project.name,
      description: project.description || '',
      createdAt,
      updatedAt,
      status: project.status || 'active',
      priority: project.priority || 1,
      metadata: project.metadata
    };
  }

  getProject(id: string): ProjectDefinition | undefined {
    const stmt = this.db.prepare('SELECT * FROM progetti WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return undefined;
    
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      status: row.status as any,
      priority: row.priority,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  updateProject(id: string, updates: Partial<Omit<ProjectDefinition, 'id' | 'createdAt' | 'updatedAt'>>): ProjectDefinition | undefined {
    const fields: string[] = [];
    const values: any[] = [];
    
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
        fields.push(`${key} = ?`);
        values.push(
          key === 'metadata' && updates.metadata 
            ? JSON.stringify(updates.metadata) 
            : (updates as any)[key]
        );
      }
    });
    
    if (fields.length === 0) return undefined;
    
    values.push(id);
    
    const stmt = this.db.prepare(`
      UPDATE progetti 
      SET ${fields.join(', ')}, updated_at = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(...values, new Date().toISOString(), id);
    
    if (result.changes === 0) return undefined;
    
    return this.getProject(id);
  }

  deleteProject(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM progetti WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // ROADMAP CRUD OPERATIONS
  createRoadmap(roadmap: Omit<RoadmapPlan, 'id' | 'createdAt' | 'updatedAt'>): RoadmapPlan {
    const id = this.generateId();
    const createdAt = new Date();
    const updatedAt = new Date();
    
    const stmt = this.db.prepare(`
      INSERT INTO roadmaps (id, project_id, name, description, start_date, end_date, status, priority, progress, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      roadmap.projectId,
      roadmap.name,
      roadmap.description || null,
      roadmap.startDate ? roadmap.startDate.toISOString() : null,
      roadmap.endDate ? roadmap.endDate.toISOString() : null,
      roadmap.status || 'planning',
      roadmap.priority || 1,
      roadmap.progress || 0,
      roadmap.metadata ? JSON.stringify(roadmap.metadata) : null,
      createdAt.toISOString(),
      updatedAt.toISOString()
    );
    
    return {
      id,
      projectId: roadmap.projectId,
      name: roadmap.name,
      description: roadmap.description || '',
      startDate: roadmap.startDate,
      endDate: roadmap.endDate,
      createdAt,
      updatedAt,
      status: roadmap.status || 'planning',
      priority: roadmap.priority || 1,
      progress: roadmap.progress || 0,
      metadata: roadmap.metadata
    };
  }

  getRoadmap(id: string): RoadmapPlan | undefined {
    const stmt = this.db.prepare('SELECT * FROM roadmaps WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return undefined;
    
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description,
      startDate: row.start_date ? new Date(row.start_date) : undefined,
      endDate: row.end_date ? new Date(row.end_date) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      status: row.status as any,
      priority: row.priority,
      progress: row.progress,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  updateRoadmap(id: string, updates: Partial<Omit<RoadmapPlan, 'id' | 'createdAt' | 'updatedAt'>>): RoadmapPlan | undefined {
    const fields: string[] = [];
    const values: any[] = [];
    
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
        const dbField = key === 'projectId' ? 'project_id' : 
                       key === 'startDate' ? 'start_date' : 
                       key === 'endDate' ? 'end_date' : key;
        fields.push(`${dbField} = ?`);
        const value = (updates as any)[key];
        values.push(
          key === 'startDate' || key === 'endDate' ? 
            (value ? value.toISOString() : null) : 
            (key === 'metadata' && value ? JSON.stringify(value) : value)
        );
      }
    });
    
    if (fields.length === 0) return undefined;
    
    values.push(id);
    
    const stmt = this.db.prepare(`
      UPDATE roadmaps 
      SET ${fields.join(', ')}, updated_at = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(...values, new Date().toISOString(), id);
    
    if (result.changes === 0) return undefined;
    
    return this.getRoadmap(id);
  }

  deleteRoadmap(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM roadmaps WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // MACRO TASK CRUD OPERATIONS
  createMacroTask(macroTask: Omit<MacroTaskWithBranch, 'id' | 'createdAt' | 'updatedAt'>): MacroTaskWithBranch {
    const id = this.generateId();
    const createdAt = new Date();
    const updatedAt = new Date();
    
    const stmt = this.db.prepare(`
      INSERT INTO macro_tasks (id, roadmap_id, name, description, start_date, end_date, status, priority, progress, dependencies, assignee, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      macroTask.roadmapId,
      macroTask.name,
      macroTask.description || null,
      macroTask.startDate ? macroTask.startDate.toISOString() : null,
      macroTask.endDate ? macroTask.endDate.toISOString() : null,
      macroTask.status || 'pending',
      macroTask.priority || 1,
      macroTask.progress || 0,
      macroTask.dependencies ? JSON.stringify(macroTask.dependencies) : null,
      macroTask.assignee || null,
      macroTask.metadata ? JSON.stringify(macroTask.metadata) : null,
      createdAt.toISOString(),
      updatedAt.toISOString()
    );
    
    return {
      id,
      roadmapId: macroTask.roadmapId,
      name: macroTask.name,
      description: macroTask.description || '',
      startDate: macroTask.startDate,
      endDate: macroTask.endDate,
      createdAt,
      updatedAt,
      status: macroTask.status || 'pending',
      priority: macroTask.priority || 1,
      progress: macroTask.progress || 0,
      dependencies: macroTask.dependencies || [],
      assignee: macroTask.assignee,
      metadata: macroTask.metadata
    };
  }

  getMacroTask(id: string): MacroTaskWithBranch | undefined {
    const stmt = this.db.prepare('SELECT * FROM macro_tasks WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return undefined;
    
    return {
      id: row.id,
      roadmapId: row.roadmap_id,
      name: row.name,
      description: row.description,
      startDate: row.start_date ? new Date(row.start_date) : undefined,
      endDate: row.end_date ? new Date(row.end_date) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      status: row.status as any,
      priority: row.priority,
      progress: row.progress,
      dependencies: row.dependencies ? JSON.parse(row.dependencies) : [],
      assignee: row.assignee,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  updateMacroTask(id: string, updates: Partial<Omit<MacroTaskWithBranch, 'id' | 'createdAt' | 'updatedAt'>>): MacroTaskWithBranch | undefined {
    const fields: string[] = [];
    const values: any[] = [];
    
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
        const dbField = key === 'roadmapId' ? 'roadmap_id' : 
                       key === 'startDate' ? 'start_date' : 
                       key === 'endDate' ? 'end_date' : 
                       key === 'dependencies' ? 'dependencies' : key;
        fields.push(`${dbField} = ?`);
        const value = (updates as any)[key];
        values.push(
          key === 'startDate' || key === 'endDate' ? 
            (value ? value.toISOString() : null) : 
            (key === 'dependencies' || key === 'metadata') && value ? 
              JSON.stringify(value) : value
        );
      }
    });
    
    if (fields.length === 0) return undefined;
    
    values.push(id);
    
    const stmt = this.db.prepare(`
      UPDATE macro_tasks 
      SET ${fields.join(', ')}, updated_at = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(...values, new Date().toISOString(), id);
    
    if (result.changes === 0) return undefined;
    
    return this.getMacroTask(id);
  }

  deleteMacroTask(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM macro_tasks WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // MICRO TASK CRUD OPERATIONS
  createMicroTask(microTask: Omit<MicroTaskGranular, 'id' | 'createdAt' | 'updatedAt'>): MicroTaskGranular {
    const id = this.generateId();
    const createdAt = new Date();
    const updatedAt = new Date();
    
    const stmt = this.db.prepare(`
      INSERT INTO micro_tasks (id, macro_task_id, name, description, estimated_duration, actual_duration, status, priority, progress, dependencies, assignee, tags, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      microTask.macroTaskId,
      microTask.name,
      microTask.description || null,
      microTask.estimatedDuration || null,
      microTask.actualDuration || null,
      microTask.status || 'todo',
      microTask.priority || 1,
      microTask.progress || 0,
      microTask.dependencies ? JSON.stringify(microTask.dependencies) : null,
      microTask.assignee || null,
      microTask.tags ? JSON.stringify(microTask.tags) : null,
      microTask.metadata ? JSON.stringify(microTask.metadata) : null,
      createdAt.toISOString(),
      updatedAt.toISOString()
    );
    
    return {
      id,
      macroTaskId: microTask.macroTaskId,
      name: microTask.name,
      description: microTask.description || '',
      estimatedDuration: microTask.estimatedDuration || 0,
      actualDuration: microTask.actualDuration,
      createdAt,
      updatedAt,
      status: microTask.status || 'todo',
      priority: microTask.priority || 1,
      progress: microTask.progress || 0,
      dependencies: microTask.dependencies || [],
      assignee: microTask.assignee,
      tags: microTask.tags || [],
      metadata: microTask.metadata
    };
  }

  getMicroTask(id: string): MicroTaskGranular | undefined {
    const stmt = this.db.prepare('SELECT * FROM micro_tasks WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return undefined;
    
    return {
      id: row.id,
      macroTaskId: row.macro_task_id,
      name: row.name,
      description: row.description,
      estimatedDuration: row.estimated_duration,
      actualDuration: row.actual_duration,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      status: row.status as any,
      priority: row.priority,
      progress: row.progress,
      dependencies: row.dependencies ? JSON.parse(row.dependencies) : [],
      assignee: row.assignee,
      tags: row.tags ? JSON.parse(row.tags) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  updateMicroTask(id: string, updates: Partial<Omit<MicroTaskGranular, 'id' | 'createdAt' | 'updatedAt'>>): MicroTaskGranular | undefined {
    const fields: string[] = [];
    const values: any[] = [];
    
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
        const dbField = key === 'macroTaskId' ? 'macro_task_id' : 
                       key === 'estimatedDuration' ? 'estimated_duration' : 
                       key === 'actualDuration' ? 'actual_duration' : 
                       key === 'dependencies' ? 'dependencies' : 
                       key === 'tags' ? 'tags' : key;
        fields.push(`${dbField} = ?`);
        const value = (updates as any)[key];
        values.push(
          (key === 'dependencies' || key === 'tags' || key === 'metadata') && value ? 
            JSON.stringify(value) : value
        );
      }
    });
    
    if (fields.length === 0) return undefined;
    
    values.push(id);
    
    const stmt = this.db.prepare(`
      UPDATE micro_tasks 
      SET ${fields.join(', ')}, updated_at = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(...values, new Date().toISOString(), id);
    
    if (result.changes === 0) return undefined;
    
    return this.getMicroTask(id);
  }

  deleteMicroTask(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM micro_tasks WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // RELATIONSHIP MANAGEMENT
  getProjectRoadmaps(projectId: string): RoadmapPlan[] {
    const stmt = this.db.prepare('SELECT * FROM roadmaps WHERE project_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(projectId) as any[];
    
    return rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description,
      startDate: row.start_date ? new Date(row.start_date) : undefined,
      endDate: row.end_date ? new Date(row.end_date) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      status: row.status as any,
      priority: row.priority,
      progress: row.progress,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  getRoadmapMacroTasks(roadmapId: string): MacroTaskWithBranch[] {
    const stmt = this.db.prepare('SELECT * FROM macro_tasks WHERE roadmap_id = ? ORDER BY priority DESC, created_at DESC');
    const rows = stmt.all(roadmapId) as any[];
    
    return rows.map(row => ({
      id: row.id,
      roadmapId: row.roadmap_id,
      name: row.name,
      description: row.description,
      startDate: row.start_date ? new Date(row.start_date) : undefined,
      endDate: row.end_date ? new Date(row.end_date) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      status: row.status as any,
      priority: row.priority,
      progress: row.progress,
      dependencies: row.dependencies ? JSON.parse(row.dependencies) : [],
      assignee: row.assignee,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  getMacroTaskMicroTasks(macroTaskId: string): MicroTaskGranular[] {
    const stmt = this.db.prepare('SELECT * FROM micro_tasks WHERE macro_task_id = ? ORDER BY priority DESC, created_at DESC');
    const rows = stmt.all(macroTaskId) as any[];
    
    return rows.map(row => ({
      id: row.id,
      macroTaskId: row.macro_task_id,
      name: row.name,
      description: row.description,
      estimatedDuration: row.estimated_duration,
      actualDuration: row.actual_duration,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      status: row.status as any,
      priority: row.priority,
      progress: row.progress,
      dependencies: row.dependencies ? JSON.parse(row.dependencies) : [],
      assignee: row.assignee,
      tags: row.tags ? JSON.parse(row.tags) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  // TEMPORAL GRANULARITY ENFORCEMENT
  autoDecomposeMacroTask(macroTaskId: string): MicroTaskGranular[] {
    const macroTask = this.getMacroTask(macroTaskId);
    if (!macroTask) return [];
    
    const microTasks: MicroTaskGranular[] = [];
    const estimatedHours = macroTask.estimatedDuration || 8; // Default 8 hours
    
    // Create micro-tasks every 30 minutes
    const numMicroTasks = Math.ceil(estimatedHours * 2); // 2 micro-tasks per hour
    
    for (let i = 0; i < numMicroTasks; i++) {
      const microTask = this.createMicroTask({
        macroTaskId: macroTask.id,
        name: `${macroTask.name} - Part ${i + 1}`,
        description: `Auto-generated micro-task from ${macroTask.name}`,
        estimatedDuration: 30, // 30 minutes each
        status: 'todo',
        priority: macroTask.priority,
        progress: 0,
        dependencies: [],
        tags: ['auto-generated'],
        metadata: {
          autoGenerated: true,
          sourceMacroTask: macroTask.id,
          sequence: i + 1
        }
      });
      
      microTasks.push(microTask);
    }
    
    return microTasks;
  }

  // Utility methods
  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}