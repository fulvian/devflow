"use strict";
/**
 * DevFlow Unified Database Manager v1.0
 * Post-schema unification implementation
 * Addresses divergences between DatabaseManager and orchestrator services
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnifiedDatabaseManager = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const crypto_1 = require("crypto");
class UnifiedDatabaseManager {
    constructor(dbPath = './data/devflow.sqlite') {
        this.db = new better_sqlite3_1.default(dbPath);
        // Enable optimizations and safety features
        this.db.pragma('foreign_keys = ON');
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('cache_size = 1000');
        this.db.pragma('temp_store = memory');
        this.initializeSchema();
    }
    /**
     * Initialize unified schema (idempotent)
     */
    initializeSchema() {
        // Ensure memory_blocks table exists
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_blocks (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        type TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        embedding BLOB
      )
    `);
        // Unified memory_block_embeddings schema
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_block_embeddings (
        id TEXT PRIMARY KEY,
        memory_block_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        embedding_vector BLOB NOT NULL,
        dimensions INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (memory_block_id) REFERENCES memory_blocks(id) ON DELETE CASCADE
      )
    `);
        // Performance indexes
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memory_embeddings_block_id ON memory_block_embeddings(memory_block_id);
      CREATE INDEX IF NOT EXISTS idx_memory_embeddings_model_id ON memory_block_embeddings(model_id);
      CREATE INDEX IF NOT EXISTS idx_memory_embeddings_created_at ON memory_block_embeddings(created_at);
    `);
        // Auto-update trigger for updated_at
        this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS trigger_memory_embeddings_updated_at
      AFTER UPDATE ON memory_block_embeddings
      FOR EACH ROW
      BEGIN
        UPDATE memory_block_embeddings
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.id;
      END
    `);
    }
    /**
     * Store embedding with unified schema
     */
    storeEmbedding(memoryBlockId, modelId, embeddingVector, dimensions) {
        const id = (0, crypto_1.randomUUID)();
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO memory_block_embeddings (
        id, memory_block_id, model_id, embedding_vector, dimensions
      ) VALUES (?, ?, ?, ?, ?)
    `);
        stmt.run(id, memoryBlockId, modelId, embeddingVector, dimensions);
        return id;
    }
    /**
     * Retrieve embedding by memory block and model
     */
    getEmbedding(memoryBlockId, modelId) {
        const stmt = this.db.prepare(`
      SELECT id, memory_block_id, model_id, embedding_vector, dimensions, created_at,
             created_at as updated_at
      FROM memory_block_embeddings
      WHERE memory_block_id = ? AND model_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);
        const row = stmt.get(memoryBlockId, modelId);
        if (!row)
            return null;
        return {
            id: row.id,
            memory_block_id: row.memory_block_id,
            model_id: row.model_id,
            embedding_vector: row.embedding_vector,
            dimensions: row.dimensions,
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at)
        };
    }
    /**
     * Get all embeddings for a memory block
     */
    getEmbeddingsForBlock(memoryBlockId) {
        const stmt = this.db.prepare(`
      SELECT id, memory_block_id, model_id, embedding_vector, dimensions,
             created_at, created_at as updated_at
      FROM memory_block_embeddings
      WHERE memory_block_id = ?
      ORDER BY created_at DESC
    `);
        const rows = stmt.all(memoryBlockId);
        return rows.map(row => ({
            id: row.id,
            memory_block_id: row.memory_block_id,
            model_id: row.model_id,
            embedding_vector: row.embedding_vector,
            dimensions: row.dimensions,
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at)
        }));
    }
    /**
     * Store memory block
     */
    storeMemoryBlock(id, content, type, timestamp, embedding) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO memory_blocks (id, content, type, timestamp, embedding)
      VALUES (?, ?, ?, ?, ?)
    `);
        stmt.run(id, content, type, timestamp, embedding || null);
    }
    /**
     * Query memory blocks with embeddings
     */
    queryMemoryBlocks(options = {}) {
        const { type, limit = 50, orderBy = 'timestamp' } = options;
        let query = `
      SELECT mb.id, mb.content, mb.type, mb.timestamp, mb.embedding
      FROM memory_blocks mb
      WHERE 1=1
    `;
        const params = [];
        if (type) {
            query += ` AND mb.type = ?`;
            params.push(type);
        }
        query += ` ORDER BY mb.${orderBy} DESC LIMIT ?`;
        params.push(limit);
        const stmt = this.db.prepare(query);
        const blocks = stmt.all(...params);
        // Fetch embeddings for each block
        return blocks.map(block => ({
            id: block.id,
            content: block.content,
            type: block.type,
            timestamp: block.timestamp,
            embedding: block.embedding,
            embeddings: this.getEmbeddingsForBlock(block.id)
        }));
    }
    /**
     * Batch operations for performance
     */
    batchStoreEmbeddings(embeddings) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO memory_block_embeddings (
        id, memory_block_id, model_id, embedding_vector, dimensions
      ) VALUES (?, ?, ?, ?, ?)
    `);
        const transaction = this.db.transaction(() => {
            const ids = [];
            for (const embedding of embeddings) {
                const id = (0, crypto_1.randomUUID)();
                stmt.run(id, embedding.memoryBlockId, embedding.modelId, embedding.embeddingVector, embedding.dimensions);
                ids.push(id);
            }
            return ids;
        });
        return transaction();
    }
    /**
     * Search embeddings by similarity (requires cosine similarity implementation)
     */
    findSimilarEmbeddings(queryVector, modelId, threshold = 0.7, limit = 10) {
        // Note: This is a simplified version. For production, implement proper vector similarity
        const stmt = this.db.prepare(`
      SELECT id, memory_block_id, model_id, embedding_vector, dimensions,
             created_at, created_at as updated_at
      FROM memory_block_embeddings
      WHERE model_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
        const rows = stmt.all(modelId, limit * 2); // Get more to filter by similarity
        // Simplified similarity calculation (replace with proper cosine similarity)
        const results = rows.map(row => ({
            id: row.id,
            memory_block_id: row.memory_block_id,
            model_id: row.model_id,
            embedding_vector: row.embedding_vector,
            dimensions: row.dimensions,
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at),
            similarity: 0.8 // Placeholder - implement actual similarity calculation
        })).filter(result => result.similarity >= threshold).slice(0, limit);
        return results;
    }
    /**
     * Get database statistics
     */
    getStats() {
        const memoryBlocks = this.db.prepare('SELECT COUNT(*) as count FROM memory_blocks').get();
        const embeddings = this.db.prepare('SELECT COUNT(*) as count FROM memory_block_embeddings').get();
        const models = this.db.prepare('SELECT COUNT(DISTINCT model_id) as count FROM memory_block_embeddings').get();
        const avgEmbeddings = memoryBlocks.count > 0 ? embeddings.count / memoryBlocks.count : 0;
        return {
            memoryBlocks: memoryBlocks.count,
            embeddings: embeddings.count,
            models: models.count,
            averageEmbeddingsPerBlock: Math.round(avgEmbeddings * 100) / 100
        };
    }
    /**
     * Cleanup and close database connection
     */
    close() {
        this.db.close();
    }
}
exports.UnifiedDatabaseManager = UnifiedDatabaseManager;
exports.default = UnifiedDatabaseManager;
//# sourceMappingURL=UnifiedDatabaseManager.js.map