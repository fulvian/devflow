-- Migration: Add Critical Issues Tracking Tables
-- Date: 2025-09-25
-- Description: Core infrastructure for critical issues tracking system

-- Create critical_issues table
CREATE TABLE IF NOT EXISTS critical_issues (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    category TEXT NOT NULL CHECK (category IN ('technical_debt', 'bug', 'performance', 'security', 'architecture')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    project_context TEXT,
    project_id INTEGER,
    technical_debt_score INTEGER DEFAULT 0,
    pattern_hash TEXT,
    resolution_plan TEXT,
    estimated_effort INTEGER, -- hours
    actual_effort INTEGER, -- hours
    tags TEXT, -- JSON array
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_critical_issues_severity ON critical_issues(severity);
CREATE INDEX IF NOT EXISTS idx_critical_issues_category ON critical_issues(category);
CREATE INDEX IF NOT EXISTS idx_critical_issues_status ON critical_issues(status);
CREATE INDEX IF NOT EXISTS idx_critical_issues_project ON critical_issues(project_id);
CREATE INDEX IF NOT EXISTS idx_critical_issues_pattern ON critical_issues(pattern_hash);
CREATE INDEX IF NOT EXISTS idx_critical_issues_created ON critical_issues(created_at);

-- Create audit trigger for critical_issues
CREATE TRIGGER IF NOT EXISTS audit_critical_issues_insert 
AFTER INSERT ON critical_issues
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, new_values)
    VALUES ('critical_issues', NEW.id, 'INSERT', json_object(
        'title', NEW.title,
        'severity', NEW.severity,
        'category', NEW.category,
        'status', NEW.status
    ));
END;

CREATE TRIGGER IF NOT EXISTS audit_critical_issues_update 
AFTER UPDATE ON critical_issues
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_values, new_values)
    VALUES ('critical_issues', NEW.id, 'UPDATE',
        json_object('title', OLD.title, 'severity', OLD.severity, 'status', OLD.status),
        json_object('title', NEW.title, 'severity', NEW.severity, 'status', NEW.status)
    );
END;

-- Update timestamp trigger
CREATE TRIGGER IF NOT EXISTS update_critical_issues_timestamp 
AFTER UPDATE ON critical_issues
BEGIN
    UPDATE critical_issues SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;