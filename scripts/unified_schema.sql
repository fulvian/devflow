-- ===============================
-- DEVFLOW UNIFIED DATABASE SCHEMA
-- ===============================

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- ===============================
-- SEZIONE GERARCHIA PROGETTI
-- ===============================

CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on-hold', 'cancelled')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    phase TEXT DEFAULT 'planning' CHECK (phase IN ('planning', 'design', 'development', 'testing', 'deployment', 'completed')),
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE roadmaps (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    priority INTEGER DEFAULT 0,
    project_id INTEGER,
    created_at TEXT,
    updated_at TEXT,
    metadata TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE TABLE task_contexts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    tags TEXT,
    created_at TEXT,
    updated_at TEXT,
    completed_at TEXT,
    metadata TEXT,
    parent_id TEXT,
    roadmap_id TEXT,
    project_id INTEGER,
    plan_id INTEGER,
    file_path TEXT,
    content_hash TEXT,
    FOREIGN KEY (parent_id) REFERENCES task_contexts(id),
    FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (plan_id) REFERENCES plans(id)
);

CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    plan_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    task_context_id TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
    FOREIGN KEY (task_context_id) REFERENCES task_contexts(id) ON DELETE SET NULL
);

-- ===============================
-- SEZIONE KNOWLEDGE MANAGEMENT
-- ===============================

CREATE TABLE knowledge_entities (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    metadata TEXT,
    project_id INTEGER,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- ===============================
-- SEZIONE MEMORIA E SESSIONI
-- ===============================

CREATE TABLE memories (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'general' CHECK (type IN ('general', 'task', 'session', 'project')),
    project_id INTEGER,
    task_context_id TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (task_context_id) REFERENCES task_contexts(id) ON DELETE SET NULL
);

CREATE TABLE memory_blocks (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'general',
    created_at TEXT,
    updated_at TEXT,
    project_id INTEGER,
    task_context_id TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (task_context_id) REFERENCES task_contexts(id) ON DELETE SET NULL
);

CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    context TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    project_id INTEGER,
    created_at TEXT,
    updated_at TEXT,
    metadata TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- ===============================
-- SEZIONE VETTORIALE UNIFICATA
-- ===============================

CREATE TABLE vector_memories (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    embedding BLOB NOT NULL,
    metadata TEXT,
    project_id INTEGER,
    task_context_id TEXT,
    memory_id TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (task_context_id) REFERENCES task_contexts(id) ON DELETE SET NULL,
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

CREATE TABLE memory_block_embeddings (
    block_id TEXT PRIMARY KEY,
    embedding BLOB NOT NULL,
    model TEXT NOT NULL DEFAULT 'synthetic-embeddings-v1',
    dimensions INTEGER NOT NULL DEFAULT 1024,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (block_id) REFERENCES task_contexts(id) ON DELETE CASCADE
);

-- ===============================
-- SEZIONE AUDIT E TRACKING
-- ===============================

CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values TEXT,
    new_values TEXT,
    user_context TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_id TEXT
);

-- ===============================
-- TABELLE AGGIUNTIVE PER COMPATIBILITÀ
-- ===============================

-- Tabelle per mantenere compatibilità con servizi esistenti
CREATE TABLE macrotasks (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    status TEXT,
    project_id INTEGER,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE TABLE microtasks (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    status TEXT,
    macrotask_id TEXT,
    project_id INTEGER,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (macrotask_id) REFERENCES macrotasks(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE TABLE coordination_sessions (
    id TEXT PRIMARY KEY,
    session_type TEXT,
    participants TEXT,
    status TEXT,
    created_at TEXT,
    updated_at TEXT,
    metadata TEXT
);

-- ===============================
-- INDICI PER PERFORMANCE
-- ===============================

-- Indici per ricerche frequenti
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_name ON projects(name);
CREATE INDEX idx_tasks_project_status ON tasks(project_id, status);
CREATE INDEX idx_task_contexts_status ON task_contexts(status);
CREATE INDEX idx_task_contexts_project ON task_contexts(project_id);
CREATE INDEX idx_memories_project ON memories(project_id);
CREATE INDEX idx_sessions_project ON sessions(project_id);
CREATE INDEX idx_vector_memories_project ON vector_memories(project_id);

-- Indici per relazioni FK
CREATE INDEX idx_plans_project ON plans(project_id);
CREATE INDEX idx_roadmaps_project ON roadmaps(project_id);
CREATE INDEX idx_tasks_plan ON tasks(plan_id);
CREATE INDEX idx_knowledge_entities_project ON knowledge_entities(project_id);

-- Indici per ricerche temporali
CREATE INDEX idx_projects_created ON projects(created_at);
CREATE INDEX idx_tasks_created ON tasks(created_at);
CREATE INDEX idx_memories_created ON memories(created_at);

-- Indici per embedding
CREATE INDEX idx_memory_block_embeddings_model ON memory_block_embeddings(model);
CREATE INDEX idx_vector_memories_metadata ON vector_memories(metadata);

-- ===============================
-- TRIGGER PER AUDIT LOG
-- ===============================

CREATE TRIGGER audit_projects_insert AFTER INSERT ON projects
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, new_values)
    VALUES ('projects', NEW.id, 'INSERT', json_object(
        'name', NEW.name,
        'status', NEW.status,
        'progress', NEW.progress
    ));
END;

CREATE TRIGGER audit_projects_update AFTER UPDATE ON projects
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_values, new_values)
    VALUES ('projects', NEW.id, 'UPDATE',
        json_object('name', OLD.name, 'status', OLD.status, 'progress', OLD.progress),
        json_object('name', NEW.name, 'status', NEW.status, 'progress', NEW.progress)
    );
END;

CREATE TRIGGER audit_tasks_insert AFTER INSERT ON tasks
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, new_values)
    VALUES ('tasks', NEW.id, 'INSERT', json_object(
        'name', NEW.name,
        'status', NEW.status,
        'project_id', NEW.project_id
    ));
END;

CREATE TRIGGER audit_tasks_update AFTER UPDATE ON tasks
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_values, new_values)
    VALUES ('tasks', NEW.id, 'UPDATE',
        json_object('name', OLD.name, 'status', OLD.status, 'project_id', OLD.project_id),
        json_object('name', NEW.name, 'status', NEW.status, 'project_id', NEW.project_id)
    );
END;

-- ===============================
-- TRIGGER PER AUTO-UPDATE
-- ===============================

CREATE TRIGGER update_project_timestamp AFTER UPDATE ON projects
BEGIN
    UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_task_timestamp AFTER UPDATE ON tasks
BEGIN
    UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_plan_timestamp AFTER UPDATE ON plans
BEGIN
    UPDATE plans SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;