-- DevFlow Database Migration Script - Simplified Version
-- Migrates core data without touching FTS tables

BEGIN TRANSACTION;

-- Disable triggers temporarily to avoid FTS conflicts
PRAGMA recursive_triggers = OFF;

-- Attach the simple database
ATTACH DATABASE 'data/devflow.sqlite' AS simple_db;

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- 1. Migrate task_contexts table
INSERT OR IGNORE INTO task_contexts (
    id, title, description, status, priority, created_at, updated_at
)
SELECT
    id,
    title,
    COALESCE(description, '') as description,
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
    updated_at
FROM simple_db.task_contexts;

-- 2. Migrate memory_blocks table (only core fields to avoid FTS conflicts)
INSERT OR IGNORE INTO memory_blocks (
    task_id, session_id, block_type, label, content,
    metadata, importance_score, embedding, embedding_model,
    created_at, last_accessed
)
SELECT
    -- Find most recent task as fallback
    COALESCE(
        (SELECT id FROM task_contexts tc
         WHERE datetime(tc.created_at) <= datetime(mb.timestamp)
         ORDER BY datetime(tc.created_at) DESC LIMIT 1),
        (SELECT id FROM task_contexts ORDER BY created_at DESC LIMIT 1)
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
        'original_type', mb.type
    ) as metadata,
    0.5 as importance_score,
    mb.embedding,
    'text-embedding-3-small' as embedding_model,
    mb.timestamp as created_at,
    mb.timestamp as last_accessed
FROM simple_db.memory_blocks mb;

-- 3. Migrate memory_block_embeddings with correct column mapping
INSERT OR IGNORE INTO memory_block_embeddings (
    block_id, embedding, model, dimensions, created_at
)
SELECT
    mbe.memory_block_id as block_id,
    mbe.embedding_vector as embedding,
    mbe.model_id as model,
    mbe.dimensions,
    mbe.created_at
FROM simple_db.memory_block_embeddings mbe
WHERE EXISTS (
    SELECT 1 FROM simple_db.sqlite_master
    WHERE type='table' AND name='memory_block_embeddings'
);

-- Update completion timestamps
UPDATE task_contexts
SET completed_at = updated_at
WHERE status = 'completed' AND completed_at IS NULL;

-- Verification query
SELECT
    'task_contexts' as table_name,
    COUNT(*) as migrated_records
FROM task_contexts
WHERE id IN (SELECT id FROM simple_db.task_contexts)

UNION ALL

SELECT
    'memory_blocks' as table_name,
    COUNT(*) as migrated_records
FROM memory_blocks
WHERE json_extract(metadata, '$.source') = 'simple_migration'

UNION ALL

SELECT
    'memory_block_embeddings' as table_name,
    COUNT(*) as migrated_records
FROM memory_block_embeddings
WHERE block_id IN (SELECT memory_block_id FROM simple_db.memory_block_embeddings);

-- Detach simple database
DETACH DATABASE simple_db;

-- Re-enable triggers
PRAGMA recursive_triggers = ON;

-- Final integrity check
PRAGMA integrity_check;

COMMIT;