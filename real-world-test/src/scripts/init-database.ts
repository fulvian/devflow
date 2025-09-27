#!/usr/bin/env node

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { join } from 'path';

// Initialize database with DevFlow Foundation schema
async function initializeDatabase(dbPath: string) {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign keys like in the original schema
  await db.exec(`PRAGMA foreign_keys = ON`);
  await db.exec(`PRAGMA journal_mode = WAL`);
  await db.exec(`PRAGMA synchronous = NORMAL`);
  await db.exec(`PRAGMA cache_size = -64000`);
  await db.exec(`PRAGMA temp_store = memory`);

  // Create all tables and schema elements from the foundation schema
  const schemaSQL = `
-- Task contexts - Central registry for all development tasks
CREATE TABLE IF NOT EXISTS task_contexts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'm-' CHECK(priority IN ('h-', 'm-', 'l-', '?-')),
    status TEXT DEFAULT 'planning' CHECK(status IN ('planning', 'active', 'blocked', 'completed', 'archived')),
    
    -- AI-powered task analysis
    complexity_score REAL CHECK(complexity_score BETWEEN 0.0 AND 1.0),
    estimated_duration_minutes INTEGER,
    required_capabilities TEXT, -- JSON array of capability domains
    
    -- Platform routing intelligence
    primary_platform TEXT CHECK(primary_platform IN ('claude_code', 'openai_codex', 'gemini_cli', 'cursor')),
    platform_routing TEXT, -- JSON object with platform scores and preferences
    
    -- Specialized memory contexts (JSON objects optimized per platform)
    architectural_context TEXT DEFAULT '{}', -- For Claude Code architectural decisions
    implementation_context TEXT DEFAULT '{}', -- For OpenAI Codex implementation patterns  
    debugging_context TEXT DEFAULT '{}', -- For Gemini CLI debugging workflows
    maintenance_context TEXT DEFAULT '{}', -- For Cursor maintenance tasks
    
    -- cc-sessions integration
    cc_session_id TEXT,
    cc_task_file TEXT, -- Path to sessions/tasks/ file
    branch_name TEXT,
    
    -- Task relationships
    parent_task_id TEXT REFERENCES task_contexts(id),
    depends_on TEXT, -- JSON array of task IDs this depends on
    
    -- Metadata and lifecycle
    created_at TEXT DEFAULT (datetime('now', 'utc')),
    updated_at TEXT DEFAULT (datetime('now', 'utc')),
    completed_at TEXT
);

-- Memory blocks - Structured persistent memory with semantic capabilities
CREATE TABLE IF NOT EXISTS memory_blocks (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    task_id TEXT NOT NULL REFERENCES task_contexts(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    
    -- Block classification
    block_type TEXT NOT NULL CHECK(block_type IN ('architectural', 'implementation', 'debugging', 'maintenance', 'context', 'decision', 'emergency_context', 'context_snapshot')),
    label TEXT NOT NULL, -- Human-readable identifier
    content TEXT NOT NULL,
    
    -- Metadata and relationships
    metadata TEXT DEFAULT '{}', -- JSON with platform, tools_used, file_paths, etc.
    importance_score REAL DEFAULT 0.5 CHECK(importance_score BETWEEN 0.0 AND 1.0),
    relationships TEXT DEFAULT '[]', -- JSON array of related block IDs
    
    -- Semantic search capability
    embedding BLOB, -- Vector embeddings for semantic similarity search
    embedding_model TEXT DEFAULT 'text-embedding-3-small',
    
    -- Lifecycle tracking
    created_at TEXT DEFAULT (datetime('now', 'utc')),
    last_accessed TEXT DEFAULT (datetime('now', 'utc')),
    access_count INTEGER DEFAULT 1
);

-- Coordination sessions - Track cross-platform AI interactions
CREATE TABLE IF NOT EXISTS coordination_sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    task_id TEXT NOT NULL REFERENCES task_contexts(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK(platform IN ('claude_code', 'openai_codex', 'gemini_cli', 'cursor', 'openrouter')),
    session_type TEXT DEFAULT 'development' CHECK(session_type IN ('development', 'review', 'debugging', 'handoff', 'planning')),
    
    -- Session lifecycle
    start_time TEXT DEFAULT (datetime('now', 'utc')),
    end_time TEXT,
    duration_seconds INTEGER GENERATED ALWAYS AS (
        CASE 
            WHEN end_time IS NOT NULL 
            THEN (julianday(end_time) - julianday(start_time)) * 86400
            ELSE NULL 
        END
    ) STORED,
    
    -- Resource tracking and optimization
    tokens_used INTEGER DEFAULT 0,
    api_calls INTEGER DEFAULT 0,
    estimated_cost_usd REAL DEFAULT 0.0,
    model_used TEXT, -- Which specific model was used
    
    -- Context management metrics
    context_size_start INTEGER, -- Context size at session start (chars/tokens)
    context_size_end INTEGER, -- Context size at session end
    compaction_events INTEGER DEFAULT 0, -- How many times context was compacted
    
    -- Cross-platform handoff tracking
    handoff_from_session TEXT REFERENCES coordination_sessions(id),
    handoff_to_session TEXT REFERENCES coordination_sessions(id),
    handoff_context TEXT, -- JSON object with handoff data
    handoff_success BOOLEAN,
    
    -- Performance and satisfaction metrics
    user_satisfaction INTEGER CHECK(user_satisfaction BETWEEN 1 AND 5),
    task_progress_delta REAL DEFAULT 0.0 CHECK(task_progress_delta BETWEEN -1.0 AND 1.0),
    errors_encountered INTEGER DEFAULT 0,
    
    -- Session metadata
    metadata TEXT DEFAULT '{}' -- JSON for session-specific data
);

-- Platform performance tracking - Learn from usage patterns
CREATE TABLE IF NOT EXISTS platform_performance (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    platform TEXT NOT NULL,
    capability_domain TEXT NOT NULL, -- 'architecture', 'implementation', etc.
    task_type TEXT NOT NULL,
    
    -- Performance metrics (updated periodically)
    success_rate REAL DEFAULT 0.0 CHECK(success_rate BETWEEN 0.0 AND 1.0),
    average_duration_seconds REAL,
    average_token_usage INTEGER,
    average_cost_usd REAL,
    user_satisfaction_avg REAL CHECK(user_satisfaction_avg BETWEEN 1.0 AND 5.0),
    
    -- Statistical confidence
    total_tasks INTEGER DEFAULT 0,
    measurement_period_start TEXT,
    measurement_period_end TEXT,
    confidence_score REAL DEFAULT 0.0 CHECK(confidence_score BETWEEN 0.0 AND 1.0),
    
    -- Metadata
    last_updated TEXT DEFAULT (datetime('now', 'utc')),
    
    UNIQUE(platform, capability_domain, task_type, measurement_period_start)
);

-- Cost tracking and optimization
CREATE TABLE IF NOT EXISTS cost_analytics (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    date TEXT NOT NULL, -- YYYY-MM-DD format
    platform TEXT NOT NULL,
    model TEXT NOT NULL,
    
    -- Daily aggregated costs
    total_requests INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost_usd REAL DEFAULT 0.0,
    
    -- Token breakdown
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    
    -- Efficiency metrics
    average_tokens_per_request REAL,
    cost_per_token REAL,
    tasks_completed INTEGER DEFAULT 0,
    cost_per_task REAL,
    
    created_at TEXT DEFAULT (datetime('now', 'utc')),
    
    UNIQUE(date, platform, model)
);

-- Knowledge entities - Long-term learning from development patterns
CREATE TABLE IF NOT EXISTS knowledge_entities (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    entity_type TEXT NOT NULL CHECK(entity_type IN ('person', 'technology', 'pattern', 'antipattern', 'rule', 'preference')),
    name TEXT NOT NULL,
    description TEXT,
    confidence_score REAL DEFAULT 0.5 CHECK(confidence_score BETWEEN 0.0 AND 1.0),
    
    -- Source attribution
    extraction_source TEXT NOT NULL, -- JSON with source session, task, etc.
    learned_from_task_id TEXT REFERENCES task_contexts(id),
    
    -- Lifecycle and validation
    first_seen TEXT DEFAULT (datetime('now', 'utc')),
    last_confirmed TEXT DEFAULT (datetime('now', 'utc')),
    usage_count INTEGER DEFAULT 1,
    validation_status TEXT DEFAULT 'pending' CHECK(validation_status IN ('pending', 'confirmed', 'rejected')),
    
    -- Search optimization  
    embedding BLOB, -- Vector embeddings for semantic search
    tags TEXT DEFAULT '[]', -- JSON array of searchable tags
    
    UNIQUE(entity_type, name)
);

-- Entity relationships - Capture knowledge graph connections
CREATE TABLE IF NOT EXISTS entity_relationships (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    source_entity_id TEXT NOT NULL REFERENCES knowledge_entities(id) ON DELETE CASCADE,
    target_entity_id TEXT NOT NULL REFERENCES knowledge_entities(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL, -- 'depends_on', 'conflicts_with', 'enhances', etc.
    relationship_strength REAL DEFAULT 0.5 CHECK(relationship_strength BETWEEN 0.0 AND 1.0),
    context_description TEXT,
    
    -- Lifecycle tracking
    discovered_at TEXT DEFAULT (datetime('now', 'utc')),
    confirmed_count INTEGER DEFAULT 1,
    last_confirmed TEXT DEFAULT (datetime('now', 'utc')),
    
    UNIQUE(source_entity_id, target_entity_id, relationship_type)
);

-- Full-text search for memory blocks
CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
    content,
    label, 
    block_type,
    content='memory_blocks',
    content_rowid='rowid',
    tokenize='porter ascii'
);

-- Full-text search for task contexts
CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
    title,
    description,
    content='task_contexts', 
    content_rowid='rowid',
    tokenize='porter ascii'
);

-- Update task contexts timestamp on modification
CREATE TRIGGER IF NOT EXISTS update_task_contexts_timestamp 
    AFTER UPDATE ON task_contexts
BEGIN
    UPDATE task_contexts SET updated_at = datetime('now', 'utc') WHERE id = NEW.id;
END;

-- Update memory block access tracking
CREATE TRIGGER IF NOT EXISTS update_memory_access 
    AFTER UPDATE ON memory_blocks
    WHEN OLD.content = NEW.content -- Only update access time, not modification
BEGIN
    UPDATE memory_blocks SET 
        last_accessed = datetime('now', 'utc'),
        access_count = access_count + 1 
    WHERE id = NEW.id;
END;

-- Maintain FTS indexes automatically
CREATE TRIGGER IF NOT EXISTS memory_fts_insert AFTER INSERT ON memory_blocks BEGIN
    INSERT INTO memory_fts(rowid, content, label, block_type) 
    VALUES (NEW.rowid, NEW.content, NEW.label, NEW.block_type);
END;

CREATE TRIGGER IF NOT EXISTS memory_fts_delete AFTER DELETE ON memory_blocks BEGIN
    INSERT INTO memory_fts(memory_fts, rowid, content, label, block_type) 
    VALUES ('delete', OLD.rowid, OLD.content, OLD.label, OLD.block_type);
END;

CREATE TRIGGER IF NOT EXISTS memory_fts_update AFTER UPDATE ON memory_blocks BEGIN
    INSERT INTO memory_fts(memory_fts, rowid, content, label, block_type) 
    VALUES ('delete', OLD.rowid, OLD.content, OLD.label, OLD.block_type);
    INSERT INTO memory_fts(rowid, content, label, block_type) 
    VALUES (NEW.rowid, NEW.content, NEW.label, NEW.block_type);
END;

-- Similar triggers for tasks FTS
CREATE TRIGGER IF NOT EXISTS tasks_fts_insert AFTER INSERT ON task_contexts BEGIN
    INSERT INTO tasks_fts(rowid, title, description) 
    VALUES (NEW.rowid, NEW.title, COALESCE(NEW.description, ''));
END;

CREATE TRIGGER IF NOT EXISTS tasks_fts_delete AFTER DELETE ON task_contexts BEGIN
    INSERT INTO tasks_fts(tasks_fts, rowid, title, description) 
    VALUES ('delete', OLD.rowid, OLD.title, COALESCE(OLD.description, ''));
END;

CREATE TRIGGER IF NOT EXISTS tasks_fts_update AFTER UPDATE ON task_contexts BEGIN
    INSERT INTO tasks_fts(tasks_fts, rowid, title, description) 
    VALUES ('delete', OLD.rowid, OLD.title, COALESCE(OLD.description, ''));
    INSERT INTO tasks_fts(rowid, title, description) 
    VALUES (NEW.rowid, NEW.title, COALESCE(NEW.description, ''));
END;

-- Views for common queries
CREATE VIEW IF NOT EXISTS active_tasks_with_sessions AS
SELECT 
    tc.id,
    tc.title,
    tc.priority,
    tc.status,
    tc.primary_platform,
    tc.complexity_score,
    cs.id as latest_session_id,
    cs.platform as current_platform,
    cs.start_time as session_start,
    cs.tokens_used,
    cs.estimated_cost_usd,
    COUNT(mb.id) as memory_blocks_count
FROM task_contexts tc
LEFT JOIN coordination_sessions cs ON tc.id = cs.task_id 
    AND cs.start_time = (
        SELECT MAX(start_time) 
        FROM coordination_sessions 
        WHERE task_id = tc.id
    )
LEFT JOIN memory_blocks mb ON tc.id = mb.task_id
WHERE tc.status IN ('active', 'planning')
GROUP BY tc.id, cs.id
ORDER BY tc.priority DESC, tc.updated_at DESC;

CREATE VIEW IF NOT EXISTS platform_efficiency_summary AS
SELECT 
    platform,
    COUNT(*) as total_sessions,
    AVG(duration_seconds) as avg_duration,
    AVG(tokens_used) as avg_tokens,
    AVG(estimated_cost_usd) as avg_cost,
    AVG(CASE WHEN user_satisfaction IS NOT NULL THEN user_satisfaction END) as avg_satisfaction,
    SUM(estimated_cost_usd) as total_cost,
    COUNT(CASE WHEN handoff_success = 1 THEN 1 END) as successful_handoffs,
    COUNT(CASE WHEN handoff_from_session IS NOT NULL THEN 1 END) as total_handoffs
FROM coordination_sessions
WHERE end_time IS NOT NULL
GROUP BY platform
ORDER BY avg_satisfaction DESC, avg_cost ASC;

-- Insert default platform capabilities if not exists
INSERT OR IGNORE INTO platform_performance (platform, capability_domain, task_type, confidence_score, total_tasks, measurement_period_start) VALUES
-- Claude Code specializations
('claude_code', 'architecture', 'system_design', 0.9, 0, datetime('now', 'utc')),
('claude_code', 'architecture', 'code_review', 0.85, 0, datetime('now', 'utc')),
('claude_code', 'architecture', 'documentation', 0.8, 0, datetime('now', 'utc')),

-- OpenAI Codex specializations  
('openai_codex', 'implementation', 'bulk_coding', 0.9, 0, datetime('now', 'utc')),
('openai_codex', 'implementation', 'pattern_following', 0.85, 0, datetime('now', 'utc')),
('openai_codex', 'implementation', 'api_integration', 0.8, 0, datetime('now', 'utc')),

-- Gemini CLI specializations
('gemini_cli', 'debugging', 'error_analysis', 0.9, 0, datetime('now', 'utc')),
('gemini_cli', 'debugging', 'systematic_testing', 0.85, 0, datetime('now', 'utc')),
('gemini_cli', 'debugging', 'performance_optimization', 0.8, 0, datetime('now', 'utc')),

-- Cursor specializations
('cursor', 'maintenance', 'codebase_navigation', 0.9, 0, datetime('now', 'utc')),
('cursor', 'maintenance', 'refactoring', 0.8, 0, datetime('now', 'utc')),
('cursor', 'maintenance', 'documentation_sync', 0.85, 0, datetime('now', 'utc'));

-- Create schema version tracking
CREATE TABLE IF NOT EXISTS schema_versions (
    version TEXT PRIMARY KEY,
    applied_at TEXT DEFAULT (datetime('now', 'utc')),
    description TEXT
);

INSERT OR IGNORE INTO schema_versions (version, description) VALUES 
('1.0.0', 'Initial DevFlow Foundation schema with memory blocks, task contexts, and coordination sessions');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_status ON task_contexts(status);
CREATE INDEX IF NOT EXISTS idx_task_priority ON task_contexts(priority);
CREATE INDEX IF NOT EXISTS idx_task_platform ON task_contexts(primary_platform);
CREATE INDEX IF NOT EXISTS idx_task_complexity ON task_contexts(complexity_score);
CREATE INDEX IF NOT EXISTS idx_task_created ON task_contexts(created_at);
CREATE INDEX IF NOT EXISTS idx_task_cc_session ON task_contexts(cc_session_id);

CREATE INDEX IF NOT EXISTS idx_memory_task ON memory_blocks(task_id);
CREATE INDEX IF NOT EXISTS idx_memory_session ON memory_blocks(session_id);
CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_blocks(block_type);
CREATE INDEX IF NOT EXISTS idx_memory_importance ON memory_blocks(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_memory_created ON memory_blocks(created_at);
CREATE INDEX IF NOT EXISTS idx_memory_accessed ON memory_blocks(last_accessed DESC);

CREATE INDEX IF NOT EXISTS idx_session_task ON coordination_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_session_platform ON coordination_sessions(platform);
CREATE INDEX IF NOT EXISTS idx_session_time ON coordination_sessions(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_session_cost ON coordination_sessions(estimated_cost_usd);
CREATE INDEX IF NOT EXISTS idx_session_handoff_from ON coordination_sessions(handoff_from_session);
CREATE INDEX IF NOT EXISTS idx_session_handoff_to ON coordination_sessions(handoff_to_session);

CREATE INDEX IF NOT EXISTS idx_cost_date ON cost_analytics(date);
CREATE INDEX IF NOT EXISTS idx_cost_platform ON cost_analytics(platform);
CREATE INDEX IF NOT EXISTS idx_cost_total ON cost_analytics(total_cost_usd DESC);

CREATE INDEX IF NOT EXISTS idx_entity_type ON knowledge_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_confidence ON knowledge_entities(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_entity_usage ON knowledge_entities(usage_count DESC);

CREATE INDEX IF NOT EXISTS idx_relationship_source ON entity_relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationship_target ON entity_relationships(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationship_strength ON entity_relationships(relationship_strength DESC);

-- Performance optimization
ANALYZE;
`;

  await db.exec(schemaSQL);
  console.log('Database initialized successfully at:', dbPath);
  
  // Verify tables were created
  const tables = await db.all(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
  console.log('Created tables:', tables.map(t => t.name));
  
  await db.close();
}

// Run initialization
const dbPath = process.env.DB_PATH || './devflow-test.db';
initializeDatabase(dbPath).catch(console.error);