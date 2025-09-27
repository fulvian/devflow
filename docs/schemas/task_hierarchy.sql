-- docs/schemas/task_hierarchy.sql

-- Create progetti table for strategic initiatives
CREATE TABLE IF NOT EXISTS progetti (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATETIME NOT NULL,
  end_date DATETIME NOT NULL,
  status TEXT CHECK(status IN ('pending', 'in_progress', 'completed', 'blocked')) NOT NULL,
  priority TEXT CHECK(priority IN ('critical', 'high', 'medium', 'low')) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  progress_percentage REAL DEFAULT 0.0
);

-- Create roadmaps table linked to progetti
CREATE TABLE IF NOT EXISTS roadmaps (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATETIME NOT NULL,
  end_date DATETIME NOT NULL,
  status TEXT CHECK(status IN ('pending', 'in_progress', 'completed', 'blocked')) NOT NULL,
  priority TEXT CHECK(priority IN ('critical', 'high', 'medium', 'low')) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  progress_percentage REAL DEFAULT 0.0,
  FOREIGN KEY (project_id) REFERENCES progetti(id) ON DELETE CASCADE
);

-- Create macro_tasks table with branch correlation
CREATE TABLE IF NOT EXISTS macro_tasks (
  id TEXT PRIMARY KEY,
  roadmap_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  branch_name TEXT,
  estimated_hours REAL,
  actual_hours REAL,
  status TEXT CHECK(status IN ('pending', 'in_progress', 'completed', 'blocked')) NOT NULL,
  priority TEXT CHECK(priority IN ('critical', 'high', 'medium', 'low')) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  progress_percentage REAL DEFAULT 0.0,
  FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE
);

-- Create micro_tasks table with granular atomic operations
CREATE TABLE IF NOT EXISTS micro_tasks (
  id TEXT PRIMARY KEY,
  macro_task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  estimated_minutes REAL,
  actual_minutes REAL,
  status TEXT CHECK(status IN ('pending', 'in_progress', 'completed', 'blocked')) NOT NULL,
  priority TEXT CHECK(priority IN ('critical', 'high', 'medium', 'low')) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (macro_task_id) REFERENCES macro_tasks(id) ON DELETE CASCADE
);

-- Create indexes for temporal performance optimization
CREATE INDEX IF NOT EXISTS idx_progetti_dates ON progetti(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_roadmaps_dates ON roadmaps(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_macro_tasks_dates ON macro_tasks(created_at, updated_at);
CREATE INDEX IF NOT EXISTS idx_micro_tasks_dates ON micro_tasks(created_at, updated_at);

-- Create indexes for status tracking
CREATE INDEX IF NOT EXISTS idx_progetti_status ON progetti(status);
CREATE INDEX IF NOT EXISTS idx_roadmaps_status ON roadmaps(status);
CREATE INDEX IF NOT EXISTS idx_macro_tasks_status ON macro_tasks(status);
CREATE INDEX IF NOT EXISTS idx_micro_tasks_status ON micro_tasks(status);

-- Create indexes for relationships
CREATE INDEX IF NOT EXISTS idx_roadmaps_project_id ON roadmaps(project_id);
CREATE INDEX IF NOT EXISTS idx_macro_tasks_roadmap_id ON macro_tasks(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_micro_tasks_macro_task_id ON micro_tasks(macro_task_id);
