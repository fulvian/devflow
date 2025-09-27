-- DevFlow Production Schema v2.1.0
-- Post M1-CRITICAL, M2-CONFIG, M3-INTEGRATION fixes

CREATE TABLE IF NOT EXISTS task_contexts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'medium',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memory_blocks (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    type TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    embedding BLOB
);

CREATE TABLE IF NOT EXISTS memory_block_embeddings (
    id TEXT PRIMARY KEY,
    memory_block_id TEXT,
    model_id TEXT NOT NULL,
    embedding_vector BLOB NOT NULL,
    dimensions INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (memory_block_id) REFERENCES memory_blocks(id)
);

CREATE INDEX IF NOT EXISTS idx_memory_blocks_type ON memory_blocks(type);
CREATE INDEX IF NOT EXISTS idx_embeddings_model ON memory_block_embeddings(model_id);

-- Insert sample production data
INSERT OR IGNORE INTO memory_blocks (id, content, type, timestamp) VALUES
('mem_001', 'User completed onboarding process successfully', 'user_action', datetime('now')),
('mem_002', 'System processed batch job with 150 tasks', 'system_event', datetime('now')),
('mem_003', 'Performance optimization reduced response time by 40%', 'performance', datetime('now')),
('mem_004', 'Vector search functionality deployed and tested', 'deployment', datetime('now')),
('mem_005', 'Token optimizer achieved 35% efficiency improvement', 'optimization', datetime('now'));
