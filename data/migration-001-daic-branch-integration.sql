-- DevFlow Migration 001: DAIC & Branch Management Integration
-- Extends existing schema for task-branch mapping and DAIC context awareness
-- Version: 3.1.1

-- Task-Branch mapping table
CREATE TABLE IF NOT EXISTS task_branches (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    task_id TEXT NOT NULL,
    branch_name TEXT NOT NULL,
    branch_type TEXT DEFAULT 'feature', -- 'feature', 'hotfix', 'bugfix', 'task'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active', -- 'active', 'completed', 'merged', 'abandoned'
    commit_count INTEGER DEFAULT 0,
    last_commit_sha TEXT,
    merged_to TEXT, -- target branch when merged
    FOREIGN KEY (task_id) REFERENCES task_contexts(id),
    UNIQUE(task_id, branch_name)
);

-- DAIC intervention tracking
CREATE TABLE IF NOT EXISTS daic_interventions (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    task_id TEXT,
    intervention_type TEXT NOT NULL, -- 'mode_suggestion', 'implementation_block', 'workflow_guidance'
    context_data TEXT, -- JSON data about the intervention context
    user_accepted BOOLEAN DEFAULT FALSE,
    user_feedback TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_id TEXT, -- Claude Code session identifier
    FOREIGN KEY (task_id) REFERENCES task_contexts(id)
);

-- Branch governance rules configuration
CREATE TABLE IF NOT EXISTS branch_governance_rules (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    rule_name TEXT NOT NULL UNIQUE,
    rule_type TEXT NOT NULL, -- 'naming', 'validation', 'automation'
    rule_config TEXT NOT NULL, -- JSON configuration for the rule
    enabled BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Task workflow states for DAIC context awareness
CREATE TABLE IF NOT EXISTS task_workflow_states (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    task_id TEXT NOT NULL,
    workflow_phase TEXT NOT NULL, -- 'planning', 'implementation', 'testing', 'review', 'completed'
    daic_mode_suggestion TEXT, -- 'discussion', 'implementation', 'none'
    user_preference TEXT, -- 'auto', 'manual', 'never'
    last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP,
    context_metadata TEXT, -- JSON with additional context data
    FOREIGN KEY (task_id) REFERENCES task_contexts(id),
    UNIQUE(task_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_branches_task_id ON task_branches(task_id);
CREATE INDEX IF NOT EXISTS idx_task_branches_status ON task_branches(status);
CREATE INDEX IF NOT EXISTS idx_daic_interventions_task_id ON daic_interventions(task_id);
CREATE INDEX IF NOT EXISTS idx_daic_interventions_type ON daic_interventions(intervention_type);
CREATE INDEX IF NOT EXISTS idx_task_workflow_states_task_id ON task_workflow_states(task_id);
CREATE INDEX IF NOT EXISTS idx_task_workflow_states_phase ON task_workflow_states(workflow_phase);

-- Insert default branch governance rules
INSERT OR IGNORE INTO branch_governance_rules (rule_name, rule_type, rule_config) VALUES
('task_based_naming', 'naming', '{"pattern": "task/{task-name}", "auto_create": true, "validate_task_exists": true}'),
('feature_branch_naming', 'naming', '{"pattern": "feature/YYYY-MM-DD-{description}", "date_required": true, "description_min_length": 3}'),
('commit_task_validation', 'validation', '{"require_task_reference": true, "validate_against_objectives": true, "allow_wip": true}'),
('auto_branch_creation', 'automation', '{"enabled": true, "create_on_task_start": true, "naming_strategy": "task_based"}');

-- Insert default DAIC configuration for existing tasks (if any exist)
INSERT OR IGNORE INTO task_workflow_states (task_id, workflow_phase, daic_mode_suggestion, user_preference)
SELECT id, 'planning', 'discussion', 'auto'
FROM task_contexts
WHERE status = 'pending';

INSERT OR IGNORE INTO task_workflow_states (task_id, workflow_phase, daic_mode_suggestion, user_preference)
SELECT id, 'implementation', 'implementation', 'auto'
FROM task_contexts
WHERE status = 'in_progress';

-- Update schema version
INSERT OR REPLACE INTO memory_blocks (id, content, type, timestamp) VALUES
('schema_migration_001', 'DAIC & Branch Management Integration - v3.1.1', 'schema_migration', datetime('now'));