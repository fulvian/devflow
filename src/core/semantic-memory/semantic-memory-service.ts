/**
 * SemanticMemoryService - Vector embeddings integration
 * Works with existing SQLite database tables for embeddings storage
 * 
 * Integrates with validated TaskHierarchyService foundation
 */

import { open, Database as SQLiteDatabase } from 'sqlite';
import { Database } from 'sqlite3';
import { TaskHierarchyService, TaskContext } from '../task-hierarchy/task-hierarchy-service';

// Types
export interface EmbeddingModel {
  id: string;
  name: string;
  dimensions: number;
  generateEmbedding(content: string): Promise<number[]>;
  calculateSimilarity(embedding1: number[], embedding2: number[]): Promise<number>;
}

export interface EmbeddingRecord {
  blockId: string;
  embedding: number[];
  model: string;
  dimensions: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SimilarityResult {
  taskId: string;
  similarity: number;
  task?: TaskContext;
}

// Errors
export class EmbeddingError extends Error {
  constructor(message: string) {
    super(`Embedding error: ${message}`);
    this.name = 'EmbeddingError';
  }
}

export class ModelNotFoundError extends Error {
  constructor(modelId: string) {
    super(`Embedding model ${modelId} not found`);
    this.name = 'ModelNotFoundError';
  }
}

/**
 * SemanticMemoryService - Main service class
 */
export class SemanticMemoryService {
  private db: SQLiteDatabase | null = null;
  private embeddingModels: Map<string, EmbeddingModel> = new Map();
  private readonly dbPath: string;

  constructor(
    private taskHierarchyService: TaskHierarchyService,
    dbPath: string = './devflow.sqlite'
  ) {
    this.dbPath = dbPath;
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    try {
      this.db = await open({
        filename: this.dbPath,
        driver: require('sqlite3').Database
      });

      console.log('✅ SemanticMemoryService initialized');
    } catch (error) {
      throw new EmbeddingError(`Failed to initialize: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Close the service
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  /**
   * Register an embedding model
   */
  registerEmbeddingModel(model: EmbeddingModel): void {
    this.embeddingModels.set(model.id, model);
    console.log(`📝 Registered embedding model: ${model.id}`);
  }

  /**
   * Generate and store embeddings for a task
   */
  async generateTaskEmbedding(taskId: string, modelId: string): Promise<void> {
    if (!this.db) {
      throw new EmbeddingError('Service not initialized');
    }

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

      // Store in database
      await this.db.run(
        `INSERT OR REPLACE INTO memory_block_embeddings 
         (block_id, embedding, model, dimensions, created_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
        taskId,
        this.serializeEmbedding(embedding),
        modelId,
        embedding.length
      );

      console.log(`🔍 Generated embedding for task ${taskId} (${duration}ms)`);
    } catch (error) {
      throw new EmbeddingError(`Failed to generate embedding for task ${taskId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate embeddings for multiple tasks in batch
   */
  async generateTaskEmbeddings(taskIds: string[], modelId: string): Promise<void> {
    const batchSize = 5; // Process in small batches to avoid overwhelming
    
    for (let i = 0; i < taskIds.length; i += batchSize) {
      const batch = taskIds.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(taskId => this.generateTaskEmbedding(taskId, modelId))
      );
      
      console.log(`📊 Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(taskIds.length / batchSize)}`);
    }
  }

  /**
   * Find similar tasks based on semantic similarity
   */
  async findSimilarTasks(
    taskId: string,
    modelId: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<SimilarityResult[]> {
    if (!this.db) {
      throw new EmbeddingError('Service not initialized');
    }

    const model = this.embeddingModels.get(modelId);
    if (!model) {
      throw new ModelNotFoundError(modelId);
    }

    try {
      // Get source embedding
      const sourceRow = await this.db.get(
        `SELECT embedding FROM memory_block_embeddings 
         WHERE block_id = ? AND model = ?`,
        taskId, modelId
      );

      if (!sourceRow) {
        throw new EmbeddingError(`No embedding found for task ${taskId} with model ${modelId}`);
      }

      const sourceEmbedding = this.deserializeEmbedding(sourceRow.embedding);

      // Get all other embeddings for this model
      const allEmbeddings = await this.db.all(
        `SELECT block_id, embedding FROM memory_block_embeddings 
         WHERE block_id != ? AND model = ?`,
        taskId, modelId
      );

      // Calculate similarities
      const similarities: SimilarityResult[] = [];
      
      for (const row of allEmbeddings) {
        const embedding = this.deserializeEmbedding(row.embedding);
        const similarity = await model.calculateSimilarity(sourceEmbedding, embedding);
        
        if (similarity >= threshold) {
          similarities.push({
            taskId: row.block_id,
            similarity
          });
        }
      }

      // Sort by similarity and limit results
      const results = similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      // Optionally fetch task details
      for (const result of results) {
        result.task = await this.taskHierarchyService.getTaskById(result.taskId) || undefined;
      }

      return results;
    } catch (error) {
      throw new EmbeddingError(`Failed to find similar tasks: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get embedding for a task
   */
  async getTaskEmbedding(taskId: string, modelId: string): Promise<number[] | null> {
    if (!this.db) {
      throw new EmbeddingError('Service not initialized');
    }

    try {
      const row = await this.db.get(
        `SELECT embedding FROM memory_block_embeddings 
         WHERE block_id = ? AND model = ?`,
        taskId, modelId
      );

      return row ? this.deserializeEmbedding(row.embedding) : null;
    } catch (error) {
      console.error(`Failed to get embedding for task ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Synchronize embeddings with task hierarchy
   */
  async synchronizeWithTaskHierarchy(modelId: string): Promise<void> {
    if (!this.db) {
      throw new EmbeddingError('Service not initialized');
    }

    try {
      console.log(`🔄 Synchronizing embeddings for model ${modelId}...`);

      // Get all current tasks
      const rootTasks = await this.taskHierarchyService.getRootTasks();
      const allTasks: TaskContext[] = [];
      
      // Collect all tasks (including children)
      for (const rootTask of rootTasks) {
        allTasks.push(rootTask);
        const children = await this.getAllDescendants(rootTask.id);
        allTasks.push(...children);
      }

      const currentTaskIds = new Set(allTasks.map(t => t.id));

      // Find embeddings for deleted tasks
      const existingEmbeddings = await this.db.all(
        `SELECT block_id FROM memory_block_embeddings WHERE model = ?`,
        modelId
      );

      const embeddingsToDelete = existingEmbeddings
        .filter(row => !currentTaskIds.has(row.block_id))
        .map(row => row.block_id);

      // Delete orphaned embeddings
      if (embeddingsToDelete.length > 0) {
        for (const blockId of embeddingsToDelete) {
          await this.db.run(
            `DELETE FROM memory_block_embeddings WHERE block_id = ? AND model = ?`,
            blockId, modelId
          );
        }
        console.log(`🗑️ Removed ${embeddingsToDelete.length} orphaned embeddings`);
      }

      // Find tasks missing embeddings
      const existingEmbeddingIds = new Set(
        existingEmbeddings
          .filter(row => currentTaskIds.has(row.block_id))
          .map(row => row.block_id)
      );

      const tasksNeedingEmbeddings = allTasks
        .filter(task => !existingEmbeddingIds.has(task.id))
        .map(task => task.id);

      // Generate missing embeddings
      if (tasksNeedingEmbeddings.length > 0) {
        console.log(`📝 Generating embeddings for ${tasksNeedingEmbeddings.length} new tasks`);
        await this.generateTaskEmbeddings(tasksNeedingEmbeddings, modelId);
      }

      console.log(`✅ Synchronization complete for model ${modelId}`);
    } catch (error) {
      throw new EmbeddingError(`Synchronization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all descendant tasks recursively
   */
  private async getAllDescendants(parentId: string): Promise<TaskContext[]> {
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
  private extractTaskContent(task: TaskContext): string {
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
  private serializeEmbedding(embedding: number[]): Buffer {
    const buffer = Buffer.allocUnsafe(embedding.length * 4); // 4 bytes per float32
    for (let i = 0; i < embedding.length; i++) {
      buffer.writeFloatLE(embedding[i], i * 4);
    }
    return buffer;
  }

  /**
   * Deserialize embedding from storage (convert from BLOB)
   */
  private deserializeEmbedding(buffer: Buffer): number[] {
    const embedding: number[] = [];
    for (let i = 0; i < buffer.length; i += 4) {
      embedding.push(buffer.readFloatLE(i));
    }
    return embedding;
  }
}

// Simple mock embedding model for testing
export class MockEmbeddingModel implements EmbeddingModel {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly dimensions: number = 384
  ) {}

  async generateEmbedding(content: string): Promise<number[]> {
    // Simple mock: generate consistent pseudo-random embedding based on content
    const seed = this.stringToSeed(content);
    const embedding: number[] = [];
    
    for (let i = 0; i < this.dimensions; i++) {
      embedding.push(this.pseudoRandom(seed + i) * 2 - 1); // Range [-1, 1]
    }
    
    return this.normalize(embedding);
  }

  async calculateSimilarity(embedding1: number[], embedding2: number[]): Promise<number> {
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

  private stringToSeed(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private pseudoRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  private normalize(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map(val => val / norm);
  }
}