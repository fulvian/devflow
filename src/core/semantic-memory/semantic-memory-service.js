"use strict";
/**
 * SemanticMemoryService - Vector embeddings integration
 * Works with existing SQLite database tables for embeddings storage
 *
 * Integrates with validated TaskHierarchyService foundation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockEmbeddingModel = exports.SemanticMemoryService = exports.ModelNotFoundError = exports.EmbeddingError = void 0;
const UnifiedDatabaseManager_1 = require("../../database/UnifiedDatabaseManager");
// Errors
class EmbeddingError extends Error {
    constructor(message) {
        super(`Embedding error: ${message}`);
        this.name = 'EmbeddingError';
    }
}
exports.EmbeddingError = EmbeddingError;
class ModelNotFoundError extends Error {
    constructor(modelId) {
        super(`Embedding model ${modelId} not found`);
        this.name = 'ModelNotFoundError';
    }
}
exports.ModelNotFoundError = ModelNotFoundError;
/**
 * SemanticMemoryService - Main service class
 */
class SemanticMemoryService {
    constructor(taskHierarchyService, dbPath = './data/devflow_unified.sqlite') {
        this.taskHierarchyService = taskHierarchyService;
        this.embeddingModels = new Map();
        this.unifiedDB = new UnifiedDatabaseManager_1.UnifiedDatabaseManager(dbPath);
    }
    /**
     * Initialize the service (UnifiedDatabaseManager is ready on construction)
     */
    async initialize() {
        try {
            // UnifiedDatabaseManager initializes on construction, no async init needed
            console.log('✅ SemanticMemoryService initialized with UnifiedDatabaseManager');
        }
        catch (error) {
            throw new EmbeddingError(`Failed to initialize: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Close the service
     */
    async close() {
        this.unifiedDB.close();
    }
    /**
     * Register an embedding model
     */
    registerEmbeddingModel(model) {
        this.embeddingModels.set(model.id, model);
        console.log(`📝 Registered embedding model: ${model.id}`);
    }
    /**
     * Generate and store embeddings for a task using UnifiedDatabaseManager
     */
    async generateTaskEmbedding(taskId, modelId) {
        const model = this.embeddingModels.get(modelId);
        if (!model) {
            throw new ModelNotFoundError(modelId);
        }
        try {
            // Get task content
            const task = await this.taskHierarchyService.getTaskById(taskId);
            if (!task) {
                throw new EmbeddingError(`Task ${taskId} not found`);
            }
            // Extract content for embedding
            const content = this.extractTaskContent(task);
            // Generate embedding
            const startTime = Date.now();
            const embedding = await model.generateEmbedding(content);
            const duration = Date.now() - startTime;
            // Store using unified database manager
            const embeddingBuffer = this.serializeEmbedding(embedding);
            this.unifiedDB.storeEmbedding(taskId, modelId, embeddingBuffer, embedding.length);
            console.log(`🔍 Generated embedding for task ${taskId} (${duration}ms, unified schema)`);
        }
        catch (error) {
            throw new EmbeddingError(`Failed to generate embedding for task ${taskId}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Generate embeddings for multiple tasks in batch using unified operations
     */
    async generateTaskEmbeddings(taskIds, modelId) {
        const model = this.embeddingModels.get(modelId);
        if (!model) {
            throw new ModelNotFoundError(modelId);
        }
        const batchSize = 10; // Increased batch size for unified operations
        for (let i = 0; i < taskIds.length; i += batchSize) {
            const batch = taskIds.slice(i, i + batchSize);
            const embeddings = [];
            // Generate all embeddings for this batch
            for (const taskId of batch) {
                try {
                    const task = await this.taskHierarchyService.getTaskById(taskId);
                    if (task) {
                        const content = this.extractTaskContent(task);
                        const embedding = await model.generateEmbedding(content);
                        const embeddingBuffer = this.serializeEmbedding(embedding);
                        embeddings.push({
                            blockId: taskId,
                            model: modelId,
                            embedding: embeddingBuffer,
                            dimensions: embedding.length
                        });
                    }
                }
                catch (error) {
                    console.error(`Failed to generate embedding for task ${taskId}:`, error);
                }
            }
            // Batch store using unified database manager
            if (embeddings.length > 0) {
                const embeddingIds = this.unifiedDB.batchStoreEmbeddings(embeddings);
                console.log(`📊 Batch processed ${embeddings.length} embeddings: ${embeddingIds.length} stored (${Math.floor(i / batchSize) + 1}/${Math.ceil(taskIds.length / batchSize)})`);
            }
        }
    }
    /**
     * Find similar tasks based on semantic similarity using unified schema
     */
    async findSimilarTasks(taskId, modelId, limit = 10, threshold = 0.7) {
        const model = this.embeddingModels.get(modelId);
        if (!model) {
            throw new ModelNotFoundError(modelId);
        }
        try {
            // Get source embedding using unified manager
            const sourceEmbedding = this.unifiedDB.getEmbedding(taskId, modelId);
            if (!sourceEmbedding) {
                throw new EmbeddingError(`No embedding found for task ${taskId} with model ${modelId}`);
            }
            const sourceVector = this.deserializeEmbedding(sourceEmbedding.embedding);
            // Use unified similarity search
            const similarEmbeddings = this.unifiedDB.findSimilarEmbeddings(sourceEmbedding.embedding, modelId, threshold, limit + 1 // +1 to exclude source task
            );
            // Filter out source task and calculate similarities
            const results = [];
            for (const result of similarEmbeddings) {
                if (result.block_id !== taskId) {
                    // Use the similarity from unified search or recalculate
                    let similarity = result.similarity;
                    // Optionally recalculate for more precision
                    if (model.calculateSimilarity) {
                        const targetVector = this.deserializeEmbedding(result.embedding);
                        similarity = await model.calculateSimilarity(sourceVector, targetVector);
                    }
                    if (similarity >= threshold) {
                        results.push({
                            taskId: result.block_id,
                            similarity
                        });
                    }
                }
            }
            // Sort by similarity and limit results
            const finalResults = results
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, limit);
            // Fetch task details
            for (const result of finalResults) {
                result.task = await this.taskHierarchyService.getTaskById(result.taskId) || undefined;
            }
            console.log(`🔍 Found ${finalResults.length} similar tasks for ${taskId} using unified schema`);
            return finalResults;
        }
        catch (error) {
            throw new EmbeddingError(`Failed to find similar tasks: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Get embedding for a task using unified schema
     */
    async getTaskEmbedding(taskId, modelId) {
        try {
            const embedding = this.unifiedDB.getEmbedding(taskId, modelId);
            return embedding ? this.deserializeEmbedding(embedding.embedding) : null;
        }
        catch (error) {
            console.error(`Failed to get embedding for task ${taskId}:`, error);
            return null;
        }
    }
    /**
     * Synchronize embeddings with task hierarchy
     */
    async synchronizeWithTaskHierarchy(modelId) {
        try {
            console.log(`🔄 Synchronizing embeddings for model ${modelId}...`);
            // Get all current tasks
            const rootTasks = await this.taskHierarchyService.getRootTasks();
            const allTasks = [];
            // Collect all tasks (including children)
            for (const rootTask of rootTasks) {
                allTasks.push(rootTask);
                const children = await this.getAllDescendants(rootTask.id);
                allTasks.push(...children);
            }
            const currentTaskIds = new Set(allTasks.map(t => t.id));
            // Find embeddings for deleted tasks
            const existingEmbeddings = await this.unifiedDB.queryMemoryBlocks({});
            const embeddingsToDelete = existingEmbeddings
                .filter(row => !currentTaskIds.has(row.id))
                .map(row => row.id);
            // Delete orphaned embeddings
            /* Implementation to delete orphaned embeddings would go here */
            // Find tasks missing embeddings
            const existingEmbeddingIds = new Set(existingEmbeddings
                .filter(row => currentTaskIds.has(row.id))
                .map(row => row.id));
            const tasksNeedingEmbeddings = allTasks
                .filter(task => !existingEmbeddingIds.has(task.id))
                .map(task => task.id);
            // Generate missing embeddings
            if (tasksNeedingEmbeddings.length > 0) {
                console.log(`📝 Generating embeddings for ${tasksNeedingEmbeddings.length} new tasks`);
                await this.generateTaskEmbeddings(tasksNeedingEmbeddings, modelId);
            }
            console.log(`✅ Synchronization complete for model ${modelId}`);
        }
        catch (error) {
            throw new EmbeddingError(`Synchronization failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Get all descendant tasks recursively
     */
    async getAllDescendants(parentId) {
        const children = await this.taskHierarchyService.getChildTasks(parentId);
        let descendants = [...children];
        for (const child of children) {
            const grandchildren = await this.getAllDescendants(child.id);
            descendants.push(...grandchildren);
        }
        return descendants;
    }
    /**
     * Extract content from task for embedding
     */
    extractTaskContent(task) {
        const parts = [
            task.title,
            task.description || '',
            `Status: ${task.status}`,
            `Priority: ${task.priority}`
        ].filter(Boolean);
        return parts.join(' ').trim();
    }
    /**
     * Serialize embedding for storage (convert to BLOB)
     */
    serializeEmbedding(embedding) {
        const buffer = Buffer.allocUnsafe(embedding.length * 4); // 4 bytes per float32
        for (let i = 0; i < embedding.length; i++) {
            buffer.writeFloatLE(embedding[i], i * 4);
        }
        return buffer;
    }
    /**
     * Deserialize embedding from storage (convert from BLOB)
     */
    deserializeEmbedding(buffer) {
        const embedding = [];
        for (let i = 0; i < buffer.length; i += 4) {
            embedding.push(buffer.readFloatLE(i));
        }
        return embedding;
    }
}
exports.SemanticMemoryService = SemanticMemoryService;
// Simple mock embedding model for testing
class MockEmbeddingModel {
    constructor(id, name, dimensions = 384) {
        this.id = id;
        this.name = name;
        this.dimensions = dimensions;
    }
    async generateEmbedding(content) {
        // Simple mock: generate consistent pseudo-random embedding based on content
        const seed = this.stringToSeed(content);
        const embedding = [];
        for (let i = 0; i < this.dimensions; i++) {
            embedding.push(this.pseudoRandom(seed + i) * 2 - 1); // Range [-1, 1]
        }
        return this.normalize(embedding);
    }
    async calculateSimilarity(embedding1, embedding2) {
        if (embedding1.length !== embedding2.length) {
            throw new Error('Embedding dimensions must match');
        }
        // Cosine similarity
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        for (let i = 0; i < embedding1.length; i++) {
            dotProduct += embedding1[i] * embedding2[i];
            norm1 += embedding1[i] * embedding1[i];
            norm2 += embedding2[i] * embedding2[i];
        }
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }
    stringToSeed(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }
    pseudoRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }
    normalize(vector) {
        const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        return vector.map(val => val / norm);
    }
}
exports.MockEmbeddingModel = MockEmbeddingModel;
