-- DevFlow Cognitive Task+Memory System Database Schema
-- Version: 1.0.0
-- Task ID: DEVFLOW-DB-SCHEMA-001

-- Enable WAL mode for better concurrency and performance
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = MEMORY;

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
    version TEXT PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO schema_version (version) VALUES ('1.0.0');

-- Task Contexts Table
-- Stores hierarchical task information with platform routing capabilities
CREATE TABLE task_contexts (
    id TEXT PRIMARY KEY,
    parent_id TEXT,
    task_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 0,
    platform TEXT NOT NULL,
    routing_key TEXT,
    payload JSON NOT NULL,
    result JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (parent_id) REFERENCES task_contexts(id) ON DELETE CASCADE
);

-- Indexes for task_contexts performance
CREATE INDEX idx_task_contexts_parent_id ON task_contexts(parent_id);
CREATE INDEX idx_task_contexts_status ON task_contexts(status);
CREATE INDEX idx_task_contexts_platform ON task_contexts(platform);
CREATE INDEX idx_task_contexts_priority ON task_contexts(priority);
CREATE INDEX idx_task_contexts_created_at ON task_contexts(created_at);
CREATE INDEX idx_task_contexts_routing_key ON task_contexts(routing_key);

-- Memory Block Embeddings Table
-- Stores vector embeddings as BLOBs for semantic memory operations
CREATE TABLE memory_block_embeddings (
    id TEXT PRIMARY KEY,
    memory_block_id TEXT NOT NULL,
    embedding BLOB NOT NULL, -- Vector stored as binary data
    dimension INTEGER NOT NULL,
    model_version TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (memory_block_id) REFERENCES memory_blocks(id) ON DELETE CASCADE
);

-- Indexes for memory_block_embeddings performance
CREATE INDEX idx_memory_embeddings_block_id ON memory_block_embeddings(memory_block_id);
CREATE INDEX idx_memory_embeddings_model_version ON memory_block_embeddings(model_version);
CREATE INDEX idx_memory_embeddings_created_at ON memory_block_embeddings(created_at);

-- Memory Blocks Table
-- Core memory storage with metadata
CREATE TABLE memory_blocks (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    content_type TEXT NOT NULL,
    source TEXT,
    tags JSON,
    metadata JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for memory_blocks performance
CREATE INDEX idx_memory_blocks_content_type ON memory_blocks(content_type);
CREATE INDEX idx_memory_blocks_source ON memory_blocks(source);
CREATE INDEX idx_memory_blocks_created_at ON memory_blocks(created_at);

-- Coordination Sessions Table
-- Tracks cross-platform coordination sessions
CREATE TABLE coordination_sessions (
    id TEXT PRIMARY KEY,
    session_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    platforms JSON NOT NULL, -- List of participating platforms
    context JSON,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    metadata JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for coordination_sessions performance
CREATE INDEX idx_coordination_sessions_status ON coordination_sessions(status);
CREATE INDEX idx_coordination_sessions_type ON coordination_sessions(session_type);
CREATE INDEX idx_coordination_sessions_started_at ON coordination_sessions(started_at);

-- Platform Performance Table
-- Tracks performance metrics for different platforms
CREATE TABLE platform_performance (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    value REAL NOT NULL,
    context JSON,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for platform_performance performance
CREATE INDEX idx_platform_performance_platform ON platform_performance(platform);
CREATE INDEX idx_platform_performance_metric_type ON platform_performance(metric_type);
CREATE INDEX idx_platform_performance_recorded_at ON platform_performance(recorded_at);

-- Cost Analytics Table
-- Tracks cost metrics for operations
CREATE TABLE cost_analytics (
    id TEXT PRIMARY KEY,
    operation_type TEXT NOT NULL,
    platform TEXT NOT NULL,
    cost REAL NOT NULL,
    tokens_used INTEGER,
    duration_ms INTEGER,
    context JSON,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for cost_analytics performance
CREATE INDEX idx_cost_analytics_operation_type ON cost_analytics(operation_type);
CREATE INDEX idx_cost_analytics_platform ON cost_analytics(platform);
CREATE INDEX idx_cost_analytics_recorded_at ON cost_analytics(recorded_at);

-- Knowledge Entities Table
-- Stores extracted knowledge entities from processing
CREATE TABLE knowledge_entities (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_value TEXT NOT NULL,
    source_memory_block_id TEXT,
    confidence REAL,
    context JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_memory_block_id) REFERENCES memory_blocks(id) ON DELETE SET NULL
);

-- Indexes for knowledge_entities performance
CREATE INDEX idx_knowledge_entities_type ON knowledge_entities(entity_type);
CREATE INDEX idx_knowledge_entities_value ON knowledge_entities(entity_value);
CREATE INDEX idx_knowledge_entities_source ON knowledge_entities(source_memory_block_id);
CREATE INDEX idx_knowledge_entities_created_at ON knowledge_entities(created_at);

-- FTS5 Virtual Tables for Full-Text Search
-- Task Contexts FTS
CREATE VIRTUAL TABLE task_contexts_fts USING fts5(
    content,
    content_rowid,
    content='task_contexts',
    tokenize='porter'
);

-- Memory Blocks FTS
CREATE VIRTUAL TABLE memory_blocks_fts USING fts5(
    content,
    content_rowid,
    content='memory_blocks',
    tokenize='porter'
);

-- Knowledge Entities FTS
CREATE VIRTUAL TABLE knowledge_entities_fts USING fts5(
    entity_value,
    content_rowid,
    content='knowledge_entities',
    tokenize='porter'
);

-- Triggers for automatic timestamp updates
-- Task Contexts Update Trigger
CREATE TRIGGER task_contexts_update_timestamp 
    AFTER UPDATE ON task_contexts
BEGIN
    UPDATE task_contexts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Memory Blocks Update Trigger
CREATE TRIGGER memory_blocks_update_timestamp 
    AFTER UPDATE ON memory_blocks
BEGIN
    UPDATE memory_blocks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Memory Embeddings Update Trigger
CREATE TRIGGER memory_embeddings_update_timestamp 
    AFTER UPDATE ON memory_block_embeddings
BEGIN
    UPDATE memory_block_embeddings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Coordination Sessions Update Trigger
CREATE TRIGGER coordination_sessions_update_timestamp 
    AFTER UPDATE ON coordination_sessions
BEGIN
    UPDATE coordination_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Knowledge Entities Update Trigger
CREATE TRIGGER knowledge_entities_update_timestamp 
    AFTER UPDATE ON knowledge_entities
BEGIN
    UPDATE knowledge_entities SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Triggers for FTS maintenance
-- Task Contexts FTS Triggers
CREATE TRIGGER task_contexts_ai AFTER INSERT ON task_contexts BEGIN
    INSERT INTO task_contexts_fts(rowid, content) VALUES (NEW.id, json_extract(NEW.payload, '$.content') || ' ' || NEW.id);
END;

CREATE TRIGGER task_contexts_ad AFTER DELETE ON task_contexts BEGIN
    INSERT INTO task_contexts_fts(task_contexts_fts, rowid, content) VALUES('delete', OLD.id, '');
END;

CREATE TRIGGER task_contexts_au AFTER UPDATE ON task_contexts BEGIN
    INSERT INTO task_contexts_fts(task_contexts_fts, rowid, content) VALUES('delete', OLD.id, '');
    INSERT INTO task_contexts_fts(rowid, content) VALUES (NEW.id, json_extract(NEW.payload, '$.content') || ' ' || NEW.id);
END;

-- Memory Blocks FTS Triggers
CREATE TRIGGER memory_blocks_ai AFTER INSERT ON memory_blocks BEGIN
    INSERT INTO memory_blocks_fts(rowid, content) VALUES (NEW.id, NEW.content);
END;

CREATE TRIGGER memory_blocks_ad AFTER DELETE ON memory_blocks BEGIN
    INSERT INTO memory_blocks_fts(memory_blocks_fts, rowid, content) VALUES('delete', OLD.id, '');
END;

CREATE TRIGGER memory_blocks_au AFTER UPDATE ON memory_blocks BEGIN
    INSERT INTO memory_blocks_fts(memory_blocks_fts, rowid, content) VALUES('delete', OLD.id, '');
    INSERT INTO memory_blocks_fts(rowid, content) VALUES (NEW.id, NEW.content);
END;

-- Knowledge Entities FTS Triggers
CREATE TRIGGER knowledge_entities_ai AFTER INSERT ON knowledge_entities BEGIN
    INSERT INTO knowledge_entities_fts(rowid, entity_value) VALUES (NEW.id, NEW.entity_value);
END;

CREATE TRIGGER knowledge_entities_ad AFTER DELETE ON knowledge_entities BEGIN
    INSERT INTO knowledge_entities_fts(knowledge_entities_fts, rowid, entity_value) VALUES('delete', OLD.id, '');
END;

CREATE TRIGGER knowledge_entities_au AFTER UPDATE ON knowledge_entities BEGIN
    INSERT INTO knowledge_entities_fts(knowledge_entities_fts, rowid, entity_value) VALUES('delete', OLD.id, '');
    INSERT INTO knowledge_entities_fts(rowid, entity_value) VALUES (NEW.id, NEW.entity_value);
END;

-- Triggers for task completion tracking
CREATE TRIGGER task_contexts_completion_tracking
    AFTER UPDATE OF status ON task_contexts
    WHEN NEW.status = 'completed' AND OLD.status != 'completed'
BEGIN
    UPDATE task_contexts SET completed_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Triggers for coordination session lifecycle
CREATE TRIGGER coordination_sessions_completion_tracking
    AFTER UPDATE OF status ON coordination_sessions
    WHEN NEW.status = 'completed' AND OLD.status != 'completed'
BEGIN
    UPDATE coordination_sessions SET ended_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Views for common queries
-- Active tasks view
CREATE VIEW active_tasks AS
    SELECT id, task_type, priority, platform, created_at
    FROM task_contexts
    WHERE status = 'pending' OR status = 'running'
    ORDER BY priority DESC, created_at ASC;

-- Recent memory blocks view
CREATE VIEW recent_memory_blocks AS
    SELECT id, content_type, source, created_at
    FROM memory_blocks
    ORDER BY created_at DESC
    LIMIT 100;

-- Platform performance summary view
CREATE VIEW platform_performance_summary AS
    SELECT 
        platform,
        metric_type,
        AVG(value) as avg_value,
        COUNT(*) as sample_count,
        MAX(recorded_at) as last_recorded
    FROM platform_performance
    GROUP BY platform, metric_type;

-- Knowledge entity types summary view
CREATE VIEW knowledge_entity_types_summary AS
    SELECT 
        entity_type,
        COUNT(*) as count,
        AVG(confidence) as avg_confidence
    FROM knowledge_entities
    GROUP BY entity_type;

-- Index for optimizing FTS searches on task contexts
CREATE INDEX idx_task_contexts_fts_search ON task_contexts_fts USING fts5(task_contexts_fts);

-- Index for optimizing FTS searches on memory blocks
CREATE INDEX idx_memory_blocks_fts_search ON memory_blocks_fts USING fts5(memory_blocks_fts);

-- Index for optimizing FTS searches on knowledge entities
CREATE INDEX idx_knowledge_entities_fts_search ON knowledge_entities_fts USING fts5(knowledge_entities_fts);