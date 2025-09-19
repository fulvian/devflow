-- DevFlow Database Migration Script - Corrected Version
-- Migrates data from simple to advanced database schema with proper column mapping

BEGIN TRANSACTION;

-- Attach the simple database
ATTACH DATABASE 'data/devflow.sqlite' AS simple_db;

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- 1. Migrate task_contexts table with proper status mapping
INSERT OR IGNORE INTO task_contexts (
    id, title, description, status, priority, created_at, updated_at,
    complexity_score, primary_platform, architectural_context,
    implementation_context, debugging_context, maintenance_context
)
SELECT
    id,
    title,
    description,
    CASE
        WHEN status = 'pending' THEN 'planning'
        WHEN status = 'in_progress' THEN 'active'
        WHEN status = 'completed' THEN 'completed'
        WHEN status = 'blocked' THEN 'blocked'
        ELSE 'planning'
    END as status,
    CASE
        WHEN priority = 'high' THEN 'h-'
        WHEN priority = 'medium' THEN 'm-'
        WHEN priority = 'low' THEN 'l-'
        ELSE 'm-'
    END as priority,
    created_at,
    updated_at,
    0.5 as complexity_score, -- Default complexity
    'claude_code' as primary_platform, -- Default platform
    '{}' as architectural_context,
    '{}' as implementation_context,
    '{}' as debugging_context,
    '{}' as maintenance_context
FROM simple_db.task_contexts;

-- 2. Migrate memory_blocks table with proper column mapping
INSERT OR IGNORE INTO memory_blocks (
    id, task_id, session_id, block_type, label, content,
    metadata, importance_score, embedding, embedding_model,
    created_at, last_accessed
)
SELECT
    mb.id,
    -- Try to find a matching task based on timing or create orphaned reference
    COALESCE(
        (SELECT id FROM simple_db.task_contexts tc
         WHERE datetime(tc.created_at) <= datetime(mb.timestamp)
         ORDER BY datetime(tc.created_at) DESC LIMIT 1),
        'orphaned'
    ) as task_id,
    'migrated-session' as session_id,
    CASE
        WHEN mb.type = 'context' THEN 'context'
        WHEN mb.type = 'decision' THEN 'decision'
        WHEN mb.type = 'implementation' THEN 'implementation'
        WHEN mb.type = 'debugging' THEN 'debugging'
        ELSE 'context'
    END as block_type,
    'migrated-' || substr(mb.id, 1, 8) as label,
    mb.content,
    json_object(
        'source', 'simple_migration',
        'original_id', mb.id,
        'original_type', mb.type,
        'migration_timestamp', datetime('now', 'utc')
    ) as metadata,
    0.5 as importance_score,
    mb.embedding,
    'text-embedding-3-small' as embedding_model,
    mb.timestamp as created_at,
    mb.timestamp as last_accessed
FROM simple_db.memory_blocks mb;

-- 3. Migrate memory_block_embeddings if exists and has compatible structure
INSERT OR IGNORE INTO memory_block_embeddings (
    id, memory_block_id, model_id, embedding_vector, dimensions, created_at
)
SELECT
    id, memory_block_id, model_id, embedding_vector, dimensions, created_at
FROM simple_db.memory_block_embeddings
WHERE EXISTS (
    SELECT 1 FROM simple_db.sqlite_master
    WHERE type='table' AND name='memory_block_embeddings'
);

-- Verification: Count migrated records
CREATE TEMPORARY VIEW migration_summary AS
SELECT
    'task_contexts' as table_name,
    (SELECT COUNT(*) FROM task_contexts WHERE id IN (SELECT id FROM simple_db.task_contexts)) as migrated_count,
    (SELECT COUNT(*) FROM simple_db.task_contexts) as source_count
UNION ALL
SELECT
    'memory_blocks' as table_name,
    (SELECT COUNT(*) FROM memory_blocks WHERE json_extract(metadata, '$.source') = 'simple_migration') as migrated_count,
    (SELECT COUNT(*) FROM simple_db.memory_blocks) as source_count
UNION ALL
SELECT
    'memory_block_embeddings' as table_name,
    (SELECT COUNT(*) FROM memory_block_embeddings WHERE memory_block_id IN (SELECT id FROM simple_db.memory_block_embeddings)) as migrated_count,
    (SELECT COUNT(*) FROM simple_db.memory_block_embeddings WHERE EXISTS (SELECT 1 FROM simple_db.sqlite_master WHERE type='table' AND name='memory_block_embeddings')) as source_count;

-- Show migration summary
SELECT * FROM migration_summary;

-- Update completion timestamps for completed tasks
UPDATE task_contexts
SET completed_at = updated_at
WHERE status = 'completed' AND completed_at IS NULL;

-- Detach the simple database
DETACH DATABASE simple_db;

-- Final integrity check
PRAGMA integrity_check;

-- Commit transaction
COMMIT;