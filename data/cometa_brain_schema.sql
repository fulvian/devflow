-- Cometa Brain Database Schema Extensions
-- Da applicare a devflow_unified.sqlite

-- Tabella sessioni Cometa Brain
CREATE TABLE IF NOT EXISTS cometa_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    project_id INTEGER,
    start_time DATETIME,
    end_time DATETIME,
    intent_patterns TEXT, -- JSON: detected intent patterns
    context_effectiveness REAL DEFAULT 0.0, -- 0.0-1.0: effectiveness score
    learning_feedback TEXT, -- JSON: learning data extracted
    session_summary TEXT, -- Generated summary
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Memory stream per eventi significativi
CREATE TABLE IF NOT EXISTS cometa_memory_stream (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    event_type TEXT, -- 'task_creation', 'bug_fix', 'architecture', 'config'
    significance_score REAL DEFAULT 0.5, -- 0.0-1.0: importance/reusability
    context_data TEXT, -- JSON: structured context data
    semantic_embedding BLOB, -- Vector embedding for search
    tool_name TEXT, -- Tool that triggered the event
    file_paths TEXT, -- JSON: involved files
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES cometa_sessions(id)
);

-- Pattern riutilizzabili
CREATE TABLE IF NOT EXISTS cometa_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_type TEXT, -- 'solution', 'configuration', 'workflow'
    domain TEXT, -- 'authentication', 'database', 'ui', 'deployment'
    pattern_data TEXT, -- JSON: pattern definition
    success_rate REAL DEFAULT 0.5, -- 0.0-1.0: success rate when applied
    usage_count INTEGER DEFAULT 0,
    last_used DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Context injections tracking
CREATE TABLE IF NOT EXISTS cometa_context_injections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    prompt_hash TEXT, -- Hash of original prompt
    injected_context TEXT, -- Context that was injected
    context_type TEXT, -- 'project', 'task', 'pattern', 'historical'
    relevance_score REAL DEFAULT 0.5, -- 0.0-1.0: predicted relevance
    actual_usage REAL, -- 0.0-1.0: actual utilization (feedback)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES cometa_sessions(id)
);

-- Task predictions
CREATE TABLE IF NOT EXISTS cometa_task_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER,
    predicted_complexity REAL, -- 1.0-10.0: complexity score
    predicted_duration_minutes INTEGER,
    predicted_success_probability REAL, -- 0.0-1.0
    actual_duration_minutes INTEGER, -- Filled when completed
    prediction_accuracy REAL, -- Calculated post-completion
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (task_id) REFERENCES task_contexts(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_memory_stream_session ON cometa_memory_stream(session_id);
CREATE INDEX IF NOT EXISTS idx_memory_stream_significance ON cometa_memory_stream(significance_score DESC);
CREATE INDEX IF NOT EXISTS idx_memory_stream_type ON cometa_memory_stream(event_type);
CREATE INDEX IF NOT EXISTS idx_patterns_domain ON cometa_patterns(domain);
CREATE INDEX IF NOT EXISTS idx_patterns_success ON cometa_patterns(success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_context_relevance ON cometa_context_injections(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_task_predictions_accuracy ON cometa_task_predictions(prediction_accuracy DESC);

-- Triggers for auto-update timestamps
CREATE TRIGGER IF NOT EXISTS update_cometa_sessions_timestamp
AFTER UPDATE ON cometa_sessions
BEGIN
    UPDATE cometa_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;