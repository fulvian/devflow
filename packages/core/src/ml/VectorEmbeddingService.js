import { getDB } from '../database/connection.js';
export class VectorEmbeddingService {
    defaultModel;
    openaiApiKey;
    db;
    cache = new Map();
    CACHE_TTL = 24 * 60 * 60 * 1000; // 24 ore
    apiKeyAvailable;
    // Provider configurations
    providers = {
        'text-embedding-3-small': {
            name: 'OpenAI',
            model: 'text-embedding-3-small',
            dimensions: 1536,
            maxTokens: 8191,
            costPer1kTokens: 0.00002
        },
        'text-embedding-3-large': {
            name: 'OpenAI',
            model: 'text-embedding-3-large',
            dimensions: 3072,
            maxTokens: 8191,
            costPer1kTokens: 0.00013
        }
    };
    constructor(defaultModel = 'text-embedding-3-small', openaiApiKey, dbPath) {
        this.defaultModel = defaultModel;
        this.openaiApiKey = openaiApiKey;
        this.db = dbPath ? getDB({ path: dbPath }) : getDB();
        this.initializeDatabase();
        // Validate API key and set fallback mode
        this.apiKeyAvailable = !!(this.openaiApiKey || process.env['OPENAI_API_KEY']);
        if (!this.apiKeyAvailable) {
            console.warn('VectorEmbeddingService: No OpenAI API key provided. Vector search will be disabled. Only keyword search will be available.');
        }
    }
    /**
     * Initialize database tables for embeddings
     */
    initializeDatabase() {
        // Memory block embeddings table (without foreign key constraints for flexibility)
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_block_embeddings (
        block_id TEXT PRIMARY KEY,
        embedding BLOB NOT NULL,
        model TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Knowledge entity embeddings table (without foreign key constraints for flexibility)
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_entity_embeddings (
        entity_id TEXT PRIMARY KEY,
        embedding BLOB NOT NULL,
        model TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Indexes for performance
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_memory_embeddings_model ON memory_block_embeddings (model)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_entity_embeddings_model ON knowledge_entity_embeddings (model)');
    }
    /**
     * Generate embeddings for single text using specified model
     */
    async generateEmbeddings(text, model = this.defaultModel) {
        // Check if API key is available
        if (!this.apiKeyAvailable) {
            throw new Error('OpenAI API key not available. Vector embeddings are disabled. Use keyword-only search instead.');
        }
        const cacheKey = `${model}:${this.hashText(text)}`;
        // Check cache first
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
            return {
                embedding: cached.embedding,
                model,
                tokens: this.estimateTokens(text),
                provider: this.providers[model]?.name || 'Unknown'
            };
        }
        try {
            const embedding = await this.callEmbeddingAPI(text, model);
            // Cache result
            this.cache.set(cacheKey, {
                embedding,
                timestamp: Date.now()
            });
            return {
                embedding,
                model,
                tokens: this.estimateTokens(text),
                provider: this.providers[model]?.name || 'Unknown'
            };
        }
        catch (error) {
            throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Check if vector embeddings are available
     */
    isVectorSearchAvailable() {
        return this.apiKeyAvailable;
    }
    /**
     * Convenience method for embedding text
     */
    async embedText(text, model) {
        const response = await this.generateEmbeddings(text, model);
        return response.embedding;
    }
    /**
     * Batch processing for multiple texts
     */
    async generateBatchEmbeddings(texts, model = this.defaultModel) {
        const embeddings = [];
        const errors = [];
        let totalTokens = 0;
        // Process in chunks to avoid API limits
        const chunkSize = 100;
        for (let i = 0; i < texts.length; i += chunkSize) {
            const chunk = texts.slice(i, i + chunkSize);
            for (let j = 0; j < chunk.length; j++) {
                try {
                    const result = await this.generateEmbeddings(chunk[j] || '', model);
                    embeddings[i + j] = result.embedding;
                    totalTokens += result.tokens;
                }
                catch (error) {
                    errors.push({
                        index: i + j,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }
        }
        return { embeddings, totalTokens, errors };
    }
    /**
     * Store embedding for MemoryBlock
     */
    async storeMemoryBlockEmbedding(blockId, embedding, model = this.defaultModel) {
        const embeddingBuffer = Buffer.from(embedding.buffer);
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO memory_block_embeddings 
      (block_id, embedding, model, dimensions, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
        stmt.run(blockId, embeddingBuffer, model, embedding.length);
    }
    /**
     * Store embeddings for multiple MemoryBlocks
     */
    async storeMemoryBlockEmbeddings(blocks) {
        const transaction = this.db.transaction(() => {
            for (const block of blocks) {
                if (block.embedding) {
                    this.storeMemoryBlockEmbedding(block.id, block.embedding, block.embeddingModel || this.defaultModel);
                }
            }
        });
        transaction();
    }
    /**
     * Store embedding for KnowledgeEntity
     */
    async storeEntityEmbedding(entityId, embedding, model = this.defaultModel) {
        const embeddingBuffer = Buffer.from(embedding.buffer);
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO knowledge_entity_embeddings 
      (entity_id, embedding, model, dimensions, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
        stmt.run(entityId, embeddingBuffer, model, embedding.length);
    }
    /**
     * Store embeddings for multiple KnowledgeEntities
     */
    async storeEntityEmbeddings(entities) {
        const transaction = this.db.transaction(() => {
            for (const entity of entities) {
                if (entity.embedding) {
                    this.storeEntityEmbedding(entity.id, entity.embedding, this.defaultModel);
                }
            }
        });
        transaction();
    }
    /**
     * Retrieve MemoryBlock embedding
     */
    async getMemoryBlockEmbedding(blockId, model) {
        const query = model
            ? 'SELECT embedding FROM memory_block_embeddings WHERE block_id = ? AND model = ?'
            : 'SELECT embedding FROM memory_block_embeddings WHERE block_id = ? ORDER BY created_at DESC LIMIT 1';
        const stmt = this.db.prepare(query);
        const row = model ? stmt.get(blockId, model) : stmt.get(blockId);
        if (!row)
            return null;
        const buffer = row.embedding;
        return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
    }
    /**
     * Retrieve KnowledgeEntity embedding
     */
    async getEntityEmbedding(entityId, model) {
        const query = model
            ? 'SELECT embedding FROM knowledge_entity_embeddings WHERE entity_id = ? AND model = ?'
            : 'SELECT embedding FROM knowledge_entity_embeddings WHERE entity_id = ? ORDER BY created_at DESC LIMIT 1';
        const stmt = this.db.prepare(query);
        const row = model ? stmt.get(entityId, model) : stmt.get(entityId);
        if (!row)
            return null;
        const buffer = row.embedding;
        return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
    }
    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(a, b) {
        if (a.length !== b.length) {
            throw new Error('Vector dimensions must match for cosine similarity');
        }
        if (!a || !b || a.length !== b.length) {
            return 0;
        }
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            const aVal = a[i] || 0;
            const bVal = b[i] || 0;
            dotProduct += aVal * bVal;
            normA += aVal * aVal;
            normB += bVal * bVal;
        }
        const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
        return magnitude === 0 ? 0 : dotProduct / magnitude;
    }
    /**
     * Find similar MemoryBlocks using cosine similarity
     */
    async findSimilarMemoryBlocks(queryEmbedding, options = {}) {
        const { threshold = 0.7, maxResults = 10, taskIds, blockTypes, platforms } = options;
        // Build query with filters
        let query = `
      SELECT mb.*, mbe.embedding, mbe.model
      FROM memory_blocks mb
      JOIN memory_block_embeddings mbe ON mb.id = mbe.block_id
      WHERE 1=1
    `;
        const params = [];
        if (taskIds && taskIds.length > 0) {
            query += ` AND mb.task_id IN (${taskIds.map(() => '?').join(',')})`;
            params.push(...taskIds);
        }
        if (blockTypes && blockTypes.length > 0) {
            query += ` AND mb.block_type IN (${blockTypes.map(() => '?').join(',')})`;
            params.push(...blockTypes);
        }
        if (platforms && platforms.length > 0) {
            query += ` AND JSON_EXTRACT(mb.metadata, '$.platform') IN (${platforms.map(() => '?').join(',')})`;
            params.push(...platforms);
        }
        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params);
        const results = [];
        for (const row of rows) {
            const buffer = row.embedding;
            const embedding = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
            const similarity = this.cosineSimilarity(queryEmbedding, embedding);
            if (similarity >= threshold) {
                const block = {
                    id: row.id,
                    taskId: row.task_id,
                    sessionId: row.session_id,
                    blockType: row.block_type,
                    label: row.label,
                    content: row.content,
                    metadata: JSON.parse(row.metadata || '{}'),
                    importanceScore: row.importance_score,
                    relationships: JSON.parse(row.relationships || '[]'),
                    embedding,
                    embeddingModel: row.model,
                    createdAt: new Date(row.created_at),
                    lastAccessed: new Date(row.last_accessed),
                    accessCount: row.access_count
                };
                results.push({
                    block,
                    similarity,
                    relevanceScore: similarity * block.importanceScore,
                    context: this.extractContext(block.content, 100)
                });
            }
        }
        // Sort by relevance score and limit results
        return results
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, maxResults);
    }
    /**
     * Semantic search using text query
     */
    async semanticSearch(query, options = {}) {
        const queryEmbedding = await this.embedText(query, this.defaultModel);
        return this.findSimilarMemoryBlocks(queryEmbedding, options);
    }
    /**
     * Clean up expired cache entries
     */
    clearExpiredCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.CACHE_TTL) {
                this.cache.delete(key);
            }
        }
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        const size = this.cache.size;
        const memoryUsage = Array.from(this.cache.values())
            .reduce((total, entry) => total + entry.embedding.byteLength, 0);
        return {
            size,
            hitRate: 0, // Simplified - would need hit/miss tracking
            memoryUsage
        };
    }
    /**
     * Call OpenAI embedding API
     */
    async callEmbeddingAPI(text, model) {
        const apiKey = this.openaiApiKey || process.env['OPENAI_API_KEY'];
        if (!apiKey) {
            throw new Error('OpenAI API key not provided');
        }
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                input: text.replace(/\n/g, ' ').substring(0, 8000), // Limit length
                model,
                encoding_format: 'float'
            }),
        });
        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (!data?.data?.[0]?.embedding) {
            throw new Error('Invalid response from OpenAI API');
        }
        return new Float32Array(data.data[0].embedding);
    }
    /**
     * Simple text hashing for cache keys
     */
    hashText(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }
    /**
     * Estimate token count for text
     */
    estimateTokens(text) {
        // Rough estimation: ~4 characters per token for English
        return Math.ceil(text.length / 4);
    }
    /**
     * Extract context snippet from text
     */
    extractContext(text, maxLength) {
        if (text.length <= maxLength)
            return text;
        return text.substring(0, maxLength) + '...';
    }
    /**
     * Dispose resources and cleanup
     */
    dispose() {
        this.cache.clear();
        // Database connection cleanup handled by connection manager
    }
}
//# sourceMappingURL=VectorEmbeddingService.js.map