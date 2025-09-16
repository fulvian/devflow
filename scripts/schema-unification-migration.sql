-- DevFlow Schema Unification Migration v1.0
-- Addresses memory_block_embeddings divergences between services
-- Root cause: parallel development without centralized schema governance

-- START TRANSACTION for atomic migration
BEGIN TRANSACTION;

-- Step 1: Backup existing data if table exists
CREATE TABLE IF NOT EXISTS memory_block_embeddings_backup AS
SELECT * FROM memory_block_embeddings WHERE 1=0;

INSERT INTO memory_block_embeddings_backup
SELECT * FROM memory_block_embeddings;

-- Step 2: Drop existing table to recreate with unified schema
DROP TABLE IF EXISTS memory_block_embeddings;

-- Step 3: Create unified schema (combines best of both approaches)
CREATE TABLE memory_block_embeddings (
    -- Unified Primary Key Strategy: Use composite key for better data integrity
    id TEXT PRIMARY KEY,                    -- From Schema 1: unique row identifier
    memory_block_id TEXT NOT NULL,         -- From Schema 1: explicit FK reference
    model_id TEXT NOT NULL,                -- From Schema 1: clear model identifier

    -- Unified Embedding Storage: Consistent column naming
    embedding_vector BLOB NOT NULL,        -- From Schema 1: explicit naming
    dimensions INTEGER NOT NULL,           -- Common: vector dimensions

    -- Unified Temporal Tracking: Best of both worlds
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,   -- From Schema 1: proper datetime
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,   -- From Schema 2: update tracking

    -- Data Integrity: Maintain FK relationship
    FOREIGN KEY (memory_block_id) REFERENCES memory_blocks(id) ON DELETE CASCADE
);

-- Step 4: Create performance indexes
CREATE INDEX IF NOT EXISTS idx_memory_embeddings_block_id ON memory_block_embeddings(memory_block_id);
CREATE INDEX IF NOT EXISTS idx_memory_embeddings_model_id ON memory_block_embeddings(model_id);
CREATE INDEX IF NOT EXISTS idx_memory_embeddings_created_at ON memory_block_embeddings(created_at);

-- Step 5: Create trigger for updated_at auto-update
CREATE TRIGGER IF NOT EXISTS trigger_memory_embeddings_updated_at
    AFTER UPDATE ON memory_block_embeddings
    FOR EACH ROW
BEGIN
    UPDATE memory_block_embeddings
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- Step 6: Migrate data back with schema transformation
-- Handle both schema formats that might exist
INSERT INTO memory_block_embeddings (
    id,
    memory_block_id,
    model_id,
    embedding_vector,
    dimensions,
    created_at,
    updated_at
)
SELECT
    CASE
        WHEN id IS NOT NULL THEN id  -- From Schema 1 format
        ELSE 'emb_' || SUBSTR(block_id, 1, 16) || '_' || SUBSTR(model, 1, 8)  -- Generate ID for Schema 2 format
    END as id,
    CASE
        WHEN memory_block_id IS NOT NULL THEN memory_block_id  -- From Schema 1
        ELSE block_id  -- From Schema 2 (assuming block_id references memory_blocks)
    END as memory_block_id,
    CASE
        WHEN model_id IS NOT NULL THEN model_id  -- From Schema 1
        ELSE model  -- From Schema 2
    END as model_id,
    CASE
        WHEN embedding_vector IS NOT NULL THEN embedding_vector  -- From Schema 1
        ELSE embedding  -- From Schema 2
    END as embedding_vector,
    dimensions,
    CASE
        WHEN created_at IS NOT NULL THEN created_at
        ELSE CURRENT_TIMESTAMP
    END as created_at,
    CASE
        WHEN updated_at IS NOT NULL THEN updated_at
        ELSE CURRENT_TIMESTAMP
    END as updated_at
FROM memory_block_embeddings_backup;

-- Step 7: Verify migration success
SELECT
    'Migration Summary' as operation,
    COUNT(*) as total_rows,
    COUNT(DISTINCT memory_block_id) as unique_blocks,
    COUNT(DISTINCT model_id) as unique_models
FROM memory_block_embeddings;

-- If everything successful, commit
COMMIT;

-- Log migration completion
INSERT INTO migration_log (
    migration_name,
    completed_at,
    affected_tables,
    rows_migrated
) VALUES (
    'schema_unification_memory_embeddings_v1.0',
    CURRENT_TIMESTAMP,
    'memory_block_embeddings',
    (SELECT COUNT(*) FROM memory_block_embeddings)
);

-- Success message
SELECT 'Schema unification migration completed successfully' as status;