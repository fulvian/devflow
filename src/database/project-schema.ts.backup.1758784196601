// src/database/project-schema.ts
import { Database } from 'sqlite3';
import { promisify } from 'util';

/**
 * Project Management Database Schema
 * Implements hierarchical structure: Projects → Plans → Roadmaps → Macrotasks → Microtasks → Sessions
 * Integrates with existing DevFlow database
 */

// Schema definitions
const PROJECTS_TABLE = `
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT CHECK(status IN ('planning', 'active', 'paused', 'completed', 'cancelled')) DEFAULT 'planning',
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completion_percentage REAL DEFAULT 0.0 CHECK(completion_percentage >= 0 AND completion_percentage <= 100)
  );
`;

const PLANS_TABLE = `
  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT CHECK(status IN ('draft', 'approved', 'implemented', 'archived')) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completion_percentage REAL DEFAULT 0.0 CHECK(completion_percentage >= 0 AND completion_percentage <= 100),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
`;

const ROADMAPS_TABLE = `
  CREATE TABLE IF NOT EXISTS roadmaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    timeline_start DATE,
    timeline_end DATE,
    status TEXT CHECK(status IN ('planning', 'active', 'completed', 'delayed')) DEFAULT 'planning',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completion_percentage REAL DEFAULT 0.0 CHECK(completion_percentage >= 0 AND completion_percentage <= 100),
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
  );
`;

const MACROTASKS_TABLE = `
  CREATE TABLE IF NOT EXISTS macrotasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roadmap_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    priority INTEGER CHECK(priority >= 1 AND priority <= 5) DEFAULT 3,
    status TEXT CHECK(status IN ('todo', 'in_progress', 'review', 'completed', 'blocked')) DEFAULT 'todo',
    assigned_to TEXT,
    estimated_hours REAL,
    actual_hours REAL,
    start_date DATE,
    due_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completion_percentage REAL DEFAULT 0.0 CHECK(completion_percentage >= 0 AND completion_percentage <= 100),
    FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE
  );
`;

const MICROTASKS_TABLE = `
  CREATE TABLE IF NOT EXISTS microtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    macrotask_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    priority INTEGER CHECK(priority >= 1 AND priority <= 5) DEFAULT 3,
    status TEXT CHECK(status IN ('todo', 'in_progress', 'review', 'completed', 'blocked')) DEFAULT 'todo',
    assigned_to TEXT,
    estimated_hours REAL,
    actual_hours REAL,
    start_date DATE,
    due_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completion_percentage REAL DEFAULT 0.0 CHECK(completion_percentage >= 0 AND completion_percentage <= 100),
    FOREIGN KEY (macrotask_id) REFERENCES macrotasks(id) ON DELETE CASCADE
  );
`;

const SESSIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    microtask_id INTEGER NOT NULL,
    coordination_session_id INTEGER, -- References existing DevFlow coordination_sessions table
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration_minutes INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (microtask_id) REFERENCES microtasks(id) ON DELETE CASCADE,
    FOREIGN KEY (coordination_session_id) REFERENCES coordination_sessions(id) ON DELETE SET NULL
  );
`;

// Indexes for performance
const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);',
  'CREATE INDEX IF NOT EXISTS idx_plans_project_id ON plans(project_id);',
  'CREATE INDEX IF NOT EXISTS idx_roadmaps_plan_id ON roadmaps(plan_id);',
  'CREATE INDEX IF NOT EXISTS idx_macrotasks_roadmap_id ON macrotasks(roadmap_id);',
  'CREATE INDEX IF NOT EXISTS idx_macrotasks_status ON macrotasks(status);',
  'CREATE INDEX IF NOT EXISTS idx_microtasks_macrotask_id ON microtasks(macrotask_id);',
  'CREATE INDEX IF NOT EXISTS idx_microtasks_status ON microtasks(status);',
  'CREATE INDEX IF NOT EXISTS idx_sessions_microtask_id ON sessions(microtask_id);',
  'CREATE INDEX IF NOT EXISTS idx_sessions_coordination_session_id ON sessions(coordination_session_id);'
];

// Triggers for automatic timestamp updates
const TRIGGERS = [
  `CREATE TRIGGER IF NOT EXISTS update_projects_timestamp 
   AFTER UPDATE ON projects
   BEGIN
     UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
   END;`,
  
  `CREATE TRIGGER IF NOT EXISTS update_plans_timestamp 
   AFTER UPDATE ON plans
   BEGIN
     UPDATE plans SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
   END;`,
  
  `CREATE TRIGGER IF NOT EXISTS update_roadmaps_timestamp 
   AFTER UPDATE ON roadmaps
   BEGIN
     UPDATE roadmaps SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
   END;`,
  
  `CREATE TRIGGER IF NOT EXISTS update_macrotasks_timestamp 
   AFTER UPDATE ON macrotasks
   BEGIN
     UPDATE macrotasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
   END;`,
  
  `CREATE TRIGGER IF NOT EXISTS update_microtasks_timestamp 
   AFTER UPDATE ON microtasks
   BEGIN
     UPDATE microtasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
   END;`,
  
  `CREATE TRIGGER IF NOT EXISTS update_sessions_timestamp 
   AFTER UPDATE ON sessions
   BEGIN
     UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
   END;`
];

/**
 * Initializes the project management schema in the DevFlow database
 * @param db SQLite database connection
 */
export async function initializeProjectSchema(db: Database): Promise<void> {
  const run = promisify(db.run.bind(db));
  
  try {
    // Create tables
    await run(PROJECTS_TABLE);
    await run(PLANS_TABLE);
    await run(ROADMAPS_TABLE);
    await run(MACROTASKS_TABLE);
    await run(MICROTASKS_TABLE);
    await run(SESSIONS_TABLE);
    
    // Create indexes
    for (const index of INDEXES) {
      await run(index);
    }
    
    // Create triggers
    for (const trigger of TRIGGERS) {
      await run(trigger);
    }
    
    console.log('Project management schema initialized successfully');
  } catch (error) {
    console.error('Error initializing project schema:', error);
    throw new Error(`Failed to initialize project schema: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Migration script to add project management tables to existing DevFlow database
 * @param db SQLite database connection
 */
export async function runProjectMigration(db: Database): Promise<void> {
  console.log('Running project management schema migration...');

  // Check if migration is needed (check if projects table exists)
  const get = promisify(db.get.bind(db));
  try {
    const result = await get("SELECT name FROM sqlite_master WHERE type='table' AND name='projects';");
    if (result) {
      console.log('Project schema already exists, skipping migration');
      return;
    }
  } catch (error) {
    console.log('Error checking table existence:', error);
  }

  // Table doesn't exist, proceed with migration
  await initializeProjectSchema(db);
  console.log('Project management schema migration completed');
}

// Export schema definitions for documentation/reference
export const ProjectSchema = {
  PROJECTS_TABLE,
  PLANS_TABLE,
  ROADMAPS_TABLE,
  MACROTASKS_TABLE,
  MICROTASKS_TABLE,
  SESSIONS_TABLE,
  INDEXES,
  TRIGGERS
};

export default ProjectSchema;