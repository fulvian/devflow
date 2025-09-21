/**
 * TaskHierarchyService - Production SQLite implementation
 * Replaces in-memory implementation with real CRUD operations
 * 
 * Database Schema:
 * task_contexts table:
 * - id: TEXT (Primary Key)
 * - parent_id: TEXT (Nullable, references another task_contexts.id)
 * - name: TEXT
 * - description: TEXT
 * - status: TEXT
 * - created_at: TEXT (ISO 8601 datetime)
 * - updated_at: TEXT (ISO 8601 datetime)
 * - metadata: TEXT (JSON string)
 */

import { Database } from 'sqlite3';
import { open, Database as SQLiteDatabase } from 'sqlite';

// Interfaces matching actual database schema
export interface TaskContext {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  complexityScore: number | null;
  estimatedDurationMinutes: number | null;
  requiredCapabilities: string[] | null;
  primaryPlatform: Platform | null;
  platformRouting: Record<string, any> | null;
  architecturalContext: Record<string, any>;
  implementationContext: Record<string, any>;
  debuggingContext: Record<string, any>;
  maintenanceContext: Record<string, any>;
  ccSessionId: string | null;
  ccTaskFile: string | null;
  branchName: string | null;
  parentTaskId: string | null;
  dependsOn: string[] | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export enum TaskStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  BLOCKED = 'blocked',
  COMPLETED = 'completed',
  ARCHIVED = 'archived'
}

export enum TaskPriority {
  HIGH = 'h-',
  MEDIUM = 'm-',
  LOW = 'l-',
  UNKNOWN = '?-'
}

export enum Platform {
  CLAUDE_CODE = 'claude_code',
  OPENAI_CODEX = 'openai_codex',
  GEMINI_CLI = 'gemini_cli',
  CURSOR = 'cursor'
}

export interface CreateTaskContextInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  complexityScore?: number;
  estimatedDurationMinutes?: number;
  requiredCapabilities?: string[];
  primaryPlatform?: Platform;
  platformRouting?: Record<string, any>;
  ccSessionId?: string;
  ccTaskFile?: string;
  branchName?: string;
  parentTaskId?: string;
  dependsOn?: string[];
}

export interface UpdateTaskContextInput {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  complexityScore?: number;
  estimatedDurationMinutes?: number;
  requiredCapabilities?: string[];
  primaryPlatform?: Platform;
  platformRouting?: Record<string, any>;
  ccSessionId?: string;
  ccTaskFile?: string;
  branchName?: string;
  parentTaskId?: string;
  dependsOn?: string[];
}

// Custom Errors
export class TaskNotFoundError extends Error {
  constructor(id: string) {
    super(`Task with ID ${id} not found`);
    this.name = 'TaskNotFoundError';
  }
}

export class TaskHierarchyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskHierarchyError';
  }
}

export class DatabaseError extends Error {
  constructor(message: string) {
    super(`Database error: ${message}`);
    this.name = 'DatabaseError';
  }
}

/**
 * TaskHierarchyService - SQLite implementation
 */
export class TaskHierarchyService {
  private db: SQLiteDatabase | null = null;
  private readonly dbPath: string;

  constructor(dbPath: string = './data/devflow_unified.sqlite') {
    this.dbPath = dbPath;
  }

  /**
   * Initialize database connection
   */
  async initialize(): Promise<void> {
    try {
      this.db = await open({
        filename: this.dbPath,
        driver: require('sqlite3').Database
      });

      // Enable foreign key constraints
      await this.db.run('PRAGMA foreign_keys = ON');
    } catch (error) {
      throw new DatabaseError(`Failed to initialize database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  /**
   * Create a new task context
   */
  async createTask(input: CreateTaskContextInput): Promise<TaskContext> {
    if (!this.db) {
      throw new DatabaseError('Database not initialized');
    }

    const db = this.db;
    const priority = input.priority || TaskPriority.MEDIUM;
    const status = input.status || TaskStatus.PLANNING;

    try {
      // Validate parent exists if specified
      if (input.parentTaskId) {
        const parentExists = await db.get(
          'SELECT 1 FROM task_contexts WHERE id = ?',
          input.parentTaskId
        );
        if (!parentExists) {
          throw new TaskHierarchyError(`Parent task ${input.parentTaskId} does not exist`);
        }
      }

      // Insert new task - let SQLite generate ID
      const result = await db.run(
        `INSERT INTO task_contexts 
         (title, description, priority, status, complexity_score, estimated_duration_minutes, 
          required_capabilities, primary_platform, platform_routing, architectural_context,
          implementation_context, debugging_context, maintenance_context, cc_session_id,
          cc_task_file, branch_name, parent_task_id, depends_on)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        input.title,
        input.description || null,
        priority,
        status,
        input.complexityScore || null,
        input.estimatedDurationMinutes || null,
        input.requiredCapabilities ? JSON.stringify(input.requiredCapabilities) : null,
        input.primaryPlatform || null,
        input.platformRouting ? JSON.stringify(input.platformRouting) : null,
        JSON.stringify({}), // architectural_context
        JSON.stringify({}), // implementation_context
        JSON.stringify({}), // debugging_context
        JSON.stringify({}), // maintenance_context
        input.ccSessionId || null,
        input.ccTaskFile || null,
        input.branchName || null,
        input.parentTaskId || null,
        input.dependsOn ? JSON.stringify(input.dependsOn) : null
      );

      // Get the inserted task using rowid
      const task = await db.get(
        `SELECT * FROM task_contexts WHERE rowid = ?`,
        result.lastID
      );

      if (!task) {
        throw new DatabaseError('Failed to retrieve created task');
      }

      return this.mapRowToTaskContext(task);
    } catch (error) {
      if (error instanceof TaskHierarchyError || error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Failed to create task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get task by ID
   */
  async getTaskById(id: string): Promise<TaskContext | null> {
    if (!this.db) {
      throw new DatabaseError('Database not initialized');
    }

    try {
      const row = await this.db.get(
        `SELECT * FROM task_contexts WHERE id = ?`,
        id
      );

      if (!row) {
        return null;
      }

      return this.mapRowToTaskContext(row);
    } catch (error) {
      throw new DatabaseError(`Failed to get task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update task context
   */
  async updateTask(id: string, input: UpdateTaskContextInput): Promise<TaskContext> {
    if (!this.db) {
      throw new DatabaseError('Database not initialized');
    }

    const db = this.db;
    const now = new Date().toISOString();

    try {
      // Check if task exists
      const existingTask = await this.getTaskById(id);
      if (!existingTask) {
        throw new TaskNotFoundError(id);
      }

      // Build update query dynamically
      const updates: string[] = [];
      const values: any[] = [];

      if (input.title !== undefined) {
        updates.push('title = ?');
        values.push(input.title);
      }

      if (input.description !== undefined) {
        updates.push('description = ?');
        values.push(input.description);
      }

      if (input.priority !== undefined) {
        updates.push('priority = ?');
        values.push(input.priority);
      }

      if (input.status !== undefined) {
        updates.push('status = ?');
        values.push(input.status);
      }

      if (input.complexityScore !== undefined) {
        updates.push('complexity_score = ?');
        values.push(input.complexityScore);
      }

      if (input.estimatedDurationMinutes !== undefined) {
        updates.push('estimated_duration_minutes = ?');
        values.push(input.estimatedDurationMinutes);
      }

      if (input.primaryPlatform !== undefined) {
        updates.push('primary_platform = ?');
        values.push(input.primaryPlatform);
      }

      if (input.ccSessionId !== undefined) {
        updates.push('cc_session_id = ?');
        values.push(input.ccSessionId);
      }

      if (input.parentTaskId !== undefined) {
        updates.push('parent_task_id = ?');
        values.push(input.parentTaskId);
      }

      // Always update the updated_at timestamp
      updates.push('updated_at = ?');
      values.push(now);

      // If no updates, return existing task
      if (updates.length === 1) { // Only updated_at would be updated
        return existingTask;
      }

      values.push(id); // For WHERE clause

      // Execute update
      await db.run(
        `UPDATE task_contexts SET ${updates.join(', ')} WHERE id = ?`,
        ...values
      );

      // Return updated task
      const updatedTask = await this.getTaskById(id);
      if (!updatedTask) {
        throw new DatabaseError('Failed to retrieve updated task');
      }

      return updatedTask;
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        throw error;
      }
      throw new DatabaseError(`Failed to update task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete task context
   */
  async deleteTask(id: string): Promise<void> {
    if (!this.db) {
      throw new DatabaseError('Database not initialized');
    }

    const db = this.db;

    try {
      // Check if task exists
      const existingTask = await this.getTaskById(id);
      if (!existingTask) {
        throw new TaskNotFoundError(id);
      }

      // Check for child tasks
      const childTasks = await db.get(
        'SELECT 1 FROM task_contexts WHERE parent_task_id = ? LIMIT 1',
        id
      );

      if (childTasks) {
        throw new TaskHierarchyError(`Cannot delete task ${id} because it has child tasks`);
      }

      // Delete the task
      await db.run('DELETE FROM task_contexts WHERE id = ?', id);
    } catch (error) {
      if (error instanceof TaskNotFoundError || error instanceof TaskHierarchyError) {
        throw error;
      }
      throw new DatabaseError(`Failed to delete task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all child tasks of a parent task
   */
  async getChildTasks(parentId: string): Promise<TaskContext[]> {
    if (!this.db) {
      throw new DatabaseError('Database not initialized');
    }

    try {
      // Verify parent exists
      const parentExists = await this.getTaskById(parentId);
      if (!parentExists) {
        throw new TaskNotFoundError(parentId);
      }

      const rows = await this.db.all(
        `SELECT * FROM task_contexts WHERE parent_task_id = ? ORDER BY created_at ASC`,
        parentId
      );

      return rows.map(row => this.mapRowToTaskContext(row));
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        throw error;
      }
      throw new DatabaseError(`Failed to get child tasks: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get root tasks (tasks with no parent)
   */
  async getRootTasks(): Promise<TaskContext[]> {
    if (!this.db) {
      throw new DatabaseError('Database not initialized');
    }

    try {
      const rows = await this.db.all(
        `SELECT * FROM task_contexts WHERE parent_task_id IS NULL ORDER BY created_at ASC`
      );

      return rows.map(row => this.mapRowToTaskContext(row));
    } catch (error) {
      throw new DatabaseError(`Failed to get root tasks: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get full task hierarchy starting from a root task
   */
  async getTaskHierarchy(rootId?: string): Promise<TaskContext[]> {
    if (!this.db) {
      throw new DatabaseError('Database not initialized');
    }

    try {
      if (rootId) {
        // Verify root task exists
        const rootTask = await this.getTaskById(rootId);
        if (!rootTask) {
          throw new TaskNotFoundError(rootId);
        }

        return await this.getTaskTree(rootId);
      } else {
        // Get all root tasks and their hierarchies
        const rootTasks = await this.getRootTasks();
        const result: TaskContext[] = [];

        for (const rootTask of rootTasks) {
          result.push(rootTask);
          const children = await this.getTaskTree(rootTask.id);
          result.push(...children);
        }

        return result;
      }
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        throw error;
      }
      throw new DatabaseError(`Failed to get task hierarchy: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get task tree recursively
   */
  private async getTaskTree(parentId: string): Promise<TaskContext[]> {
    if (!this.db) {
      throw new DatabaseError('Database not initialized');
    }

    const children = await this.getChildTasks(parentId);
    let result: TaskContext[] = [...children];

    for (const child of children) {
      const grandchildren = await this.getTaskTree(child.id);
      result = [...result, ...grandchildren];
    }

    return result;
  }

  /**
   * Validate temporal consistency of task hierarchy
   */
  async validateTemporalConsistency(taskId: string): Promise<boolean> {
    if (!this.db) {
      throw new DatabaseError('Database not initialized');
    }

    try {
      const task = await this.getTaskById(taskId);
      if (!task) {
        throw new TaskNotFoundError(taskId);
      }

      // If no parent, temporal consistency is automatically valid
      if (!task.parentTaskId) {
        return true;
      }

      const parentTask = await this.getTaskById(task.parentTaskId);
      if (!parentTask) {
        // This should not happen in a consistent database with foreign keys
        throw new TaskHierarchyError(`Parent task ${task.parentTaskId} not found for task ${taskId}`);
      }

      // Child task should not be created before parent
      return task.createdAt >= parentTask.createdAt;
    } catch (error) {
      if (error instanceof TaskNotFoundError || error instanceof TaskHierarchyError) {
        throw error;
      }
      throw new DatabaseError(`Failed to validate temporal consistency: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute operations in a transaction
   */
  async executeInTransaction<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.db) {
      throw new DatabaseError('Database not initialized');
    }

    const db = this.db;

    try {
      await db.run('BEGIN TRANSACTION');
      const result = await operation();
      await db.run('COMMIT');
      return result;
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  }

  /**
   * Map database row to TaskContext object
   */
  private mapRowToTaskContext(row: any): TaskContext {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      priority: row.priority as TaskPriority,
      status: row.status as TaskStatus,
      complexityScore: row.complexity_score,
      estimatedDurationMinutes: row.estimated_duration_minutes,
      requiredCapabilities: row.required_capabilities ? JSON.parse(row.required_capabilities) : null,
      primaryPlatform: row.primary_platform as Platform,
      platformRouting: row.platform_routing ? JSON.parse(row.platform_routing) : null,
      architecturalContext: row.architectural_context ? JSON.parse(row.architectural_context) : {},
      implementationContext: row.implementation_context ? JSON.parse(row.implementation_context) : {},
      debuggingContext: row.debugging_context ? JSON.parse(row.debugging_context) : {},
      maintenanceContext: row.maintenance_context ? JSON.parse(row.maintenance_context) : {},
      ccSessionId: row.cc_session_id,
      ccTaskFile: row.cc_task_file,
      branchName: row.branch_name,
      parentTaskId: row.parent_task_id,
      dependsOn: row.depends_on ? JSON.parse(row.depends_on) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : null
    };
  }

  /**
   * Generate unique ID for tasks
   */
  private generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}