-- Task ID: DEVFLOW-DB-FIX-001
-- Database Schema Fix Script
-- Purpose: Resolve issues with invalid triggers and missing columns in coordination_sessions table

-- 1. First, let's examine the current table structure to understand what columns actually exist
-- This is for documentation purposes and can be commented out in production
/*
PRAGMA table_info(coordination_sessions);
*/

-- 2. Drop problematic triggers that reference non-existent columns
-- These triggers are causing errors and need to be removed before we can fix the schema

-- Drop trigger that references NEW.payload (if exists)
DROP TRIGGER IF EXISTS trg_coordination_sessions_payload;

-- Drop trigger that references NEW.status (if exists)
DROP TRIGGER IF EXISTS trg_coordination_sessions_status;

-- Drop trigger that references NEW.ended_at (if exists)
DROP TRIGGER IF EXISTS trg_coordination_sessions_ended_at;

-- Drop trigger that references NEW.updated_at (if exists)
DROP TRIGGER IF EXISTS trg_coordination_sessions_updated_at;

-- Drop any other related triggers that might have similar issues
DROP TRIGGER IF EXISTS trg_coordination_sessions_insert;
DROP TRIGGER IF EXISTS trg_coordination_sessions_update;

-- 3. Add missing columns to the coordination_sessions table
-- Add payload column if it doesn't exist
ALTER TABLE coordination_sessions 
ADD COLUMN IF NOT EXISTS payload TEXT;

-- Add status column if it doesn't exist
ALTER TABLE coordination_sessions 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Add ended_at column if it doesn't exist
ALTER TABLE coordination_sessions 
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP;

-- Add updated_at column if it doesn't exist
ALTER TABLE coordination_sessions 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 4. Recreate triggers with proper column references
-- Create trigger for updating updated_at on record update
CREATE TRIGGER IF NOT EXISTS trg_coordination_sessions_update_timestamp
    AFTER UPDATE ON coordination_sessions
    FOR EACH ROW
    BEGIN
        UPDATE coordination_sessions 
        SET updated_at = CURRENT_TIMESTAMP 
        WHERE id = NEW.id;
    END;

-- Create trigger for setting initial updated_at on record insert
CREATE TRIGGER IF NOT EXISTS trg_coordination_sessions_insert_timestamp
    AFTER INSERT ON coordination_sessions
    FOR EACH ROW
    BEGIN
        UPDATE coordination_sessions 
        SET updated_at = CURRENT_TIMESTAMP 
        WHERE id = NEW.id;
    END;

-- Create trigger for status-based operations (example)
CREATE TRIGGER IF NOT EXISTS trg_coordination_sessions_status_change
    AFTER UPDATE OF status ON coordination_sessions
    FOR EACH ROW
    WHEN OLD.status IS NOT NULL AND NEW.status IS NOT NULL
    BEGIN
        -- Example: Log status changes or perform actions based on status
        INSERT INTO session_audit_log (session_id, old_status, new_status, changed_at)
        VALUES (NEW.id, OLD.status, NEW.status, CURRENT_TIMESTAMP);
    END;

-- Create trigger for handling session completion
CREATE TRIGGER IF NOT EXISTS trg_coordination_sessions_completion
    AFTER UPDATE OF status ON coordination_sessions
    FOR EACH ROW
    WHEN NEW.status = 'completed' AND OLD.status != 'completed'
    BEGIN
        UPDATE coordination_sessions 
        SET ended_at = CURRENT_TIMESTAMP 
        WHERE id = NEW.id;
    END;

-- 5. Ensure data integrity with proper constraints
-- Add constraints for status column if they don't exist
CREATE INDEX IF NOT EXISTS idx_coordination_sessions_status 
ON coordination_sessions(status);

CREATE INDEX IF NOT EXISTS idx_coordination_sessions_ended_at 
ON coordination_sessions(ended_at);

-- Add check constraint for status values (adjust values as needed)
-- Note: SQLite doesn't enforce CHECK constraints in all versions, but we include it for documentation
-- CHECK (status IN ('active', 'inactive', 'completed', 'failed'))

-- 6. Update existing records to ensure data consistency
-- Set updated_at for records that might not have it
UPDATE coordination_sessions 
SET updated_at = CURRENT_TIMESTAMP 
WHERE updated_at IS NULL;

-- Set default status for records that don't have a status
UPDATE coordination_sessions 
SET status = 'active' 
WHERE status IS NULL;

-- 7. Create audit table for session status changes (referenced in trigger above)
CREATE TABLE IF NOT EXISTS session_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    old_status TEXT,
    new_status TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES coordination_sessions(id)
);

-- 8. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_session_audit_session_id 
ON session_audit_log(session_id);

CREATE INDEX IF NOT EXISTS idx_session_audit_changed_at 
ON session_audit_log(changed_at);

-- 9. Verify the fixes by checking trigger definitions
-- This is for verification and can be commented out in production
/*
SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE '%coordination%';
*/

-- 10. Final verification query to ensure columns exist
-- This is for verification and can be commented out in production
/*
SELECT 
    id, 
    payload, 
    status, 
    ended_at, 
    updated_at 
FROM coordination_sessions 
LIMIT 1;
*/