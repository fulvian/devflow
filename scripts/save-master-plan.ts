/**
 * DevFlow Hub Master Plan Dual Persistence Script
 *
 * This script saves the master plan to both Cometa SQLite database and cc-sessions system
 * simultaneously during the migration phase to ensure data consistency.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Database } from 'sqlite3';

// Interfaces for type safety
interface Task {
  id: string;
  title: string;
  description: string;
  phase: number;
  priority: number;
  status: 'pending' | 'in-progress' | 'completed';
  parentId?: string;
  estimatedHours: number;
  createdAt: Date;
  updatedAt: Date;
}

interface MasterPlan {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  tasks: Task[];
}

interface ProgressTracker {
  taskId: string;
  progress: number; // 0-100
  lastUpdated: Date;
  notes: string[];
}

// Configuration
const SQLITE_DB_PATH = 'data/devflow.sqlite';
const CC_SESSIONS_PATH = '.claude/state/';
const MASTER_PLAN_ID = 'devflow-hub-master-plan-001';

/**
 * Validates the master plan structure
 */
function validateMasterPlan(plan: MasterPlan): boolean {
  if (!plan.id || !plan.title || !plan.tasks || plan.tasks.length === 0) {
    throw new Error('Invalid master plan structure: missing required fields');
  }

  // Validate tasks
  for (const task of plan.tasks) {
    if (!task.id || !task.title || task.phase === undefined || task.priority === undefined) {
      throw new Error(`Invalid task structure in task ${task.id || 'unknown'}`);
    }

    if (task.phase < 1 || task.phase > 2) {
      throw new Error(`Invalid phase for task ${task.id}: must be 1 or 2`);
    }
  }

  // Ensure we have the expected number of tasks
  if (plan.tasks.length !== 31) {
    console.warn(`Warning: Expected 31 tasks, found ${plan.tasks.length}`);
  }

  return true;
}

/**
 * Creates the master plan structure with 31 micro-tasks across 2 macro-phases
 */
function createMasterPlan(): MasterPlan {
  const tasks: Task[] = [];
  const baseDate = new Date();

  // Phase 1: Foundation (15 tasks)
  for (let i = 1; i <= 15; i++) {
    tasks.push({
      id: `task-p1-${i.toString().padStart(2, '0')}`,
      title: `Phase 1 Task ${i}`,
      description: `Micro-task ${i} in macro-phase 1`,
      phase: 1,
      priority: Math.floor(Math.random() * 3) + 1, // 1-3
      status: 'pending',
      estimatedHours: Math.floor(Math.random() * 8) + 2, // 2-10 hours
      createdAt: new Date(baseDate.getTime() + i * 1000),
      updatedAt: new Date(baseDate.getTime() + i * 1000)
    });
  }

  // Phase 2: Implementation (16 tasks)
  for (let i = 1; i <= 16; i++) {
    tasks.push({
      id: `task-p2-${i.toString().padStart(2, '0')}`,
      title: `Phase 2 Task ${i}`,
      description: `Micro-task ${i} in macro-phase 2`,
      phase: 2,
      priority: Math.floor(Math.random() * 3) + 1, // 1-3
      status: 'pending',
      estimatedHours: Math.floor(Math.random() * 8) + 2, // 2-10 hours
      createdAt: new Date(baseDate.getTime() + (15 + i) * 1000),
      updatedAt: new Date(baseDate.getTime() + (15 + i) * 1000)
    });
  }

  return {
    id: MASTER_PLAN_ID,
    title: 'DevFlow Hub Master Plan',
    description: 'Complete migration plan with 31 micro-tasks across 2 macro-phases',
    createdAt: baseDate,
    updatedAt: baseDate,
    tasks
  };
}

/**
 * Saves master plan to Cometa SQLite database
 */
async function saveToSQLite(plan: MasterPlan): Promise<void> {
  return new Promise((resolve, reject) => {
    // Ensure data directory exists
    const dataDir = path.dirname(SQLITE_DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const db = new Database(SQLITE_DB_PATH, (err) => {
      if (err) {
        return reject(new Error(`Failed to connect to SQLite database: ${err.message}`));
      }
    });

    db.serialize(() => {
      // Create tables if they don't exist
      db.run(`CREATE TABLE IF NOT EXISTS master_plans (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
      )`);

      // Extend existing tasks table if needed
      db.run(`CREATE TABLE IF NOT EXISTS task_extensions (
        task_id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        phase INTEGER NOT NULL,
        estimated_hours INTEGER,
        FOREIGN KEY (task_id) REFERENCES tasks (id),
        FOREIGN KEY (plan_id) REFERENCES master_plans (id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS progress_trackers (
        task_id TEXT PRIMARY KEY,
        progress INTEGER NOT NULL,
        last_updated DATETIME NOT NULL,
        notes TEXT,
        FOREIGN KEY (task_id) REFERENCES tasks (id)
      )`);

      // Insert or update master plan
      const planStmt = db.prepare(`INSERT OR REPLACE INTO master_plans
        (id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`);

      planStmt.run(
        plan.id,
        plan.title,
        plan.description,
        plan.createdAt.toISOString(),
        plan.updatedAt.toISOString()
      );
      planStmt.finalize();

      // Insert or update tasks (using existing schema)
      const taskStmt = db.prepare(`INSERT OR REPLACE INTO tasks
        (id, title, description, status, priority, parent_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

      const taskExtStmt = db.prepare(`INSERT OR REPLACE INTO task_extensions
        (task_id, plan_id, phase, estimated_hours) VALUES (?, ?, ?, ?)`);

      for (const task of plan.tasks) {
        // Convert numeric priority to string
        const priorityMap = { 1: 'low', 2: 'medium', 3: 'high' };
        const priorityStr = priorityMap[task.priority as keyof typeof priorityMap] || 'medium';

        taskStmt.run(
          task.id,
          task.title,
          task.description,
          task.status,
          priorityStr,
          task.parentId || null,
          task.createdAt.toISOString(),
          task.updatedAt.toISOString()
        );

        taskExtStmt.run(
          task.id,
          plan.id,
          task.phase,
          task.estimatedHours
        );
      }
      taskStmt.finalize();
      taskExtStmt.finalize();

      // Initialize progress trackers
      const progressStmt = db.prepare(`INSERT OR REPLACE INTO progress_trackers
        (task_id, progress, last_updated, notes) VALUES (?, ?, ?, ?)`);

      for (const task of plan.tasks) {
        progressStmt.run(
          task.id,
          0, // Initial progress
          new Date().toISOString(),
          JSON.stringify([]) // Empty notes array
        );
      }
      progressStmt.finalize();

      db.close((err) => {
        if (err) {
          reject(new Error(`Failed to close SQLite database: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  });
}

/**
 * Saves master plan to cc-sessions file system
 */
async function saveToCCSessions(plan: MasterPlan): Promise<void> {
  return new Promise((resolve, reject) => {
    // Ensure cc-sessions directory exists
    if (!fs.existsSync(CC_SESSIONS_PATH)) {
      fs.mkdirSync(CC_SESSIONS_PATH, { recursive: true });
    }

    try {
      // Save master plan
      const planPath = path.join(CC_SESSIONS_PATH, `${plan.id}.json`);
      fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));

      // Save individual tasks
      const tasksDir = path.join(CC_SESSIONS_PATH, 'tasks');
      if (!fs.existsSync(tasksDir)) {
        fs.mkdirSync(tasksDir, { recursive: true });
      }

      for (const task of plan.tasks) {
        const taskPath = path.join(tasksDir, `${task.id}.json`);
        fs.writeFileSync(taskPath, JSON.stringify(task, null, 2));
      }

      // Initialize progress trackers
      const progressDir = path.join(CC_SESSIONS_PATH, 'progress');
      if (!fs.existsSync(progressDir)) {
        fs.mkdirSync(progressDir, { recursive: true });
      }

      for (const task of plan.tasks) {
        const progress: ProgressTracker = {
          taskId: task.id,
          progress: 0,
          lastUpdated: new Date(),
          notes: []
        };
        const progressPath = path.join(progressDir, `${task.id}.json`);
        fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
      }

      resolve();
    } catch (error) {
      reject(new Error(`Failed to save to cc-sessions: ${error instanceof Error ? error.message : String(error)}`));
    }
  });
}

/**
 * Creates task hierarchy based on dependencies
 */
function createTaskHierarchy(plan: MasterPlan): MasterPlan {
  // For this implementation, we'll create a simple linear dependency chain
  // In a real scenario, this would be more complex based on actual dependencies

  const updatedTasks = [...plan.tasks];

  // Set parent-child relationships for demonstration
  // First task in each phase has no parent
  // Subsequent tasks depend on the previous task
  for (let i = 1; i < updatedTasks.length; i++) {
    if (updatedTasks[i].phase === updatedTasks[i-1].phase) {
      updatedTasks[i].parentId = updatedTasks[i-1].id;
    }
  }

  return {
    ...plan,
    tasks: updatedTasks
  };
}

/**
 * Sets up progress tracking for all tasks
 */
async function setupProgressTracking(): Promise<void> {
  console.log('Progress tracking initialized for all tasks');
  // In a real implementation, this would set up monitoring systems
  // For now, we just confirm the trackers were created in save functions
}

/**
 * Main function to execute the dual persistence save
 */
async function saveMasterPlan(): Promise<void> {
  try {
    console.log('Starting DevFlow Hub Master Plan dual persistence save...');

    // Create and validate master plan
    let masterPlan = createMasterPlan();
    masterPlan = createTaskHierarchy(masterPlan);
    validateMasterPlan(masterPlan);

    console.log(`Created master plan with ${masterPlan.tasks.length} tasks`);

    // Save to both systems concurrently
    console.log('Saving to Cometa SQLite database...');
    const sqlitePromise = saveToSQLite(masterPlan);

    console.log('Saving to cc-sessions file system...');
    const ccSessionsPromise = saveToCCSessions(masterPlan);

    // Wait for both operations to complete
    await Promise.all([sqlitePromise, ccSessionsPromise]);

    // Setup progress tracking
    await setupProgressTracking();

    console.log('✅ Master plan successfully saved to both systems:');
    console.log(`   - SQLite: ${SQLITE_DB_PATH}`);
    console.log(`   - CC Sessions: ${CC_SESSIONS_PATH}`);

  } catch (error) {
    console.error('❌ Failed to save master plan:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  saveMasterPlan().catch(console.error);
}

export {
  MasterPlan,
  Task,
  ProgressTracker,
  createMasterPlan,
  saveToSQLite,
  saveToCCSessions,
  saveMasterPlan
};