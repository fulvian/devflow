-- Project Lifecycle Management Schema Extension
-- Task ID: DEVFLOW-PLM-001
-- Purpose: Hierarchical project management with Projects→Plans→Roadmaps→MacroTasks→MicroTasks

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Create Projects table - Top level organizational unit
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned', 'active', 'paused', 'completed', 'cancelled')),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    parent_project_id INTEGER,
    FOREIGN KEY (parent_project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- Create Plans table - Strategic planning units within projects
CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned', 'active', 'paused', 'completed', 'cancelled')),
    priority INTEGER DEFAULT 0,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Create Roadmaps table - Timeline-based strategic views
CREATE TABLE IF NOT EXISTS roadmaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned', 'active', 'paused', 'completed', 'cancelled')),
    timeline TEXT, -- e.g., "Q1 2024", "2024-H1"
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
);

-- Create MacroTasks table - High-level work items
CREATE TABLE IF NOT EXISTS macro_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roadmap_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'blocked', 'completed', 'cancelled')),
    priority INTEGER DEFAULT 0,
    progress_percentage REAL DEFAULT 0.0 CHECK(progress_percentage >= 0 AND progress_percentage <= 100),
    estimated_hours REAL,
    actual_hours REAL,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    parent_task_id INTEGER,
    FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_task_id) REFERENCES macro_tasks(id) ON DELETE SET NULL
);

-- Create junction table for MacroTasks to existing task_contexts
CREATE TABLE IF NOT EXISTS macro_task_contexts (
    macro_task_id INTEGER NOT NULL,
    task_context_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (macro_task_id, task_context_id),
    FOREIGN KEY (macro_task_id) REFERENCES macro_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (task_context_id) REFERENCES task_contexts(id) ON DELETE CASCADE
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_parent ON projects(parent_project_id);
CREATE INDEX IF NOT EXISTS idx_plans_project ON plans(project_id);
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);
CREATE INDEX IF NOT EXISTS idx_roadmaps_plan ON roadmaps(plan_id);
CREATE INDEX IF NOT EXISTS idx_roadmaps_status ON roadmaps(status);
CREATE INDEX IF NOT EXISTS idx_macro_tasks_roadmap ON macro_tasks(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_macro_tasks_status ON macro_tasks(status);
CREATE INDEX IF NOT EXISTS idx_macro_tasks_parent ON macro_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_macro_tasks_priority ON macro_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_macro_task_contexts_macro ON macro_task_contexts(macro_task_id);
CREATE INDEX IF NOT EXISTS idx_macro_task_contexts_context ON macro_task_contexts(task_context_id);

-- Create triggers for automation and data integrity

-- Update timestamp on record modification
CREATE TRIGGER IF NOT EXISTS update_projects_timestamp 
    AFTER UPDATE ON projects
BEGIN
    UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_plans_timestamp 
    AFTER UPDATE ON plans
BEGIN
    UPDATE plans SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
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

-- Cascade status updates from parent to child entities
CREATE TRIGGER IF NOT EXISTS cascade_project_status_to_plans
    AFTER UPDATE OF status ON projects
    WHEN OLD.status != NEW.status AND NEW.status IN ('cancelled', 'completed')
BEGIN
    UPDATE plans SET status = NEW.status WHERE project_id = NEW.id AND status NOT IN ('completed', 'cancelled');
END;

CREATE TRIGGER IF NOT EXISTS cascade_plan_status_to_roadmaps
    AFTER UPDATE OF status ON plans
    WHEN OLD.status != NEW.status AND NEW.status IN ('cancelled', 'completed')
BEGIN
    UPDATE roadmaps SET status = NEW.status WHERE plan_id = NEW.id AND status NOT IN ('completed', 'cancelled');
END;

CREATE TRIGGER IF NOT EXISTS cascade_roadmap_status_to_macro_tasks
    AFTER UPDATE OF status ON roadmaps
    WHEN OLD.status != NEW.status AND NEW.status IN ('cancelled', 'completed')
BEGIN
    UPDATE macro_tasks SET status = NEW.status WHERE roadmap_id = NEW.id AND status NOT IN ('completed', 'cancelled');
END;

-- Automatically calculate progress based on child task completion
CREATE TRIGGER IF NOT EXISTS update_macro_task_progress
    AFTER UPDATE OF status ON macro_tasks
BEGIN
    UPDATE macro_tasks 
    SET progress_percentage = (
        SELECT COALESCE(
            (COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*)), 
            0
        )
        FROM macro_tasks AS children
        WHERE children.parent_task_id = macro_tasks.id
    )
    WHERE id IN (
        SELECT DISTINCT parent_task_id 
        FROM macro_tasks 
        WHERE parent_task_id IS NOT NULL AND id = NEW.id
    );
END;

-- Ensure date consistency
CREATE TRIGGER IF NOT EXISTS validate_project_dates
    BEFORE INSERT ON projects
BEGIN
    SELECT CASE
        WHEN NEW.start_date > NEW.end_date THEN
            RAISE(ABORT, 'Start date must be before or equal to end date')
    END;
END;

CREATE TRIGGER IF NOT EXISTS validate_plan_dates
    BEFORE INSERT ON plans
BEGIN
    SELECT CASE
        WHEN NEW.start_date > NEW.end_date THEN
            RAISE(ABORT, 'Start date must be before or equal to end date')
    END;
END;

CREATE TRIGGER IF NOT EXISTS validate_roadmap_dates
    BEFORE INSERT ON roadmaps
BEGIN
    SELECT CASE
        WHEN NEW.start_date > NEW.end_date THEN
            RAISE(ABORT, 'Start date must be before or equal to end date')
    END;
END;

CREATE TRIGGER IF NOT EXISTS validate_macro_task_dates
    BEFORE INSERT ON macro_tasks
BEGIN
    SELECT CASE
        WHEN NEW.start_date > NEW.end_date THEN
            RAISE(ABORT, 'Start date must be before or equal to end date')
    END;
END;