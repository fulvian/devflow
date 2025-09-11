PRAGMA foreign_keys = ON;

-- Projects table
CREATE TABLE IF NOT EXISTS progetti (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT CHECK(status IN ('active', 'completed', 'archived', 'paused')) DEFAULT 'active',
  priority INTEGER DEFAULT 1,
  metadata TEXT -- JSON string
);

-- Roadmaps table
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
  metadata TEXT, -- JSON string
  FOREIGN KEY (project_id) REFERENCES progetti(id) ON DELETE CASCADE,
  INDEX idx_roadmap_project (project_id),
  INDEX idx_roadmap_dates (start_date, end_date),
  INDEX idx_roadmap_status (status)
);

-- Macro tasks table
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
  dependencies TEXT, -- JSON array string of task IDs
  assignee TEXT,
  metadata TEXT, -- JSON string
  FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE,
  INDEX idx_macro_roadmap (roadmap_id),
  INDEX idx_macro_dates (start_date, end_date),
  INDEX idx_macro_status (status),
  INDEX idx_macro_priority (priority)
);

-- Micro tasks table
CREATE TABLE IF NOT EXISTS micro_tasks (
  id TEXT PRIMARY KEY,
  macro_task_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  estimated_duration INTEGER, -- in minutes
  actual_duration INTEGER, -- in minutes
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT CHECK(status IN ('todo', 'in-progress', 'review', 'completed', 'blocked', 'cancelled')) DEFAULT 'todo',
  priority INTEGER DEFAULT 1,
  progress INTEGER CHECK(progress >= 0 AND progress <= 100) DEFAULT 0,
  dependencies TEXT, -- JSON array string of task IDs
  assignee TEXT,
  tags TEXT, -- JSON array string
  metadata TEXT, -- JSON string
  FOREIGN KEY (macro_task_id) REFERENCES macro_tasks(id) ON DELETE CASCADE,
  INDEX idx_micro_macro (macro_task_id),
  INDEX idx_micro_status (status),
  INDEX idx_micro_priority (priority),
  INDEX idx_micro_assignee (assignee)
);

-- Trigger to update timestamps
CREATE TRIGGER IF NOT EXISTS update_progetti_timestamp 
  AFTER UPDATE ON progetti
BEGIN
  UPDATE progetti SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_roadmaps_timestamp 
  AFTER UPDATE ON roadmaps
BEGIN
  UPDATE roadmaps SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_macro_tasks_timestamp 
  AFTER UPDATE ON macro_tasks
BEGIN
  UPDATE macro_tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_micro_tasks_timestamp 
  AFTER UPDATE ON micro_tasks
BEGIN
  UPDATE micro_tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;