/**
 * Memory Migration & Validation Utilities
 * Handles database schema validation, migration of existing data,
 * and system health checks for Phase 1 implementation
 */

import { DatabaseAdapter } from './database-adapter';
import { OllamaEmbeddingService } from './ollama-embedding-service';

export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  errors: string[];
  duration: number;
}

export interface ValidationResult {
  schemaValid: boolean;
  embeddingServiceHealthy: boolean;
  databaseConnected: boolean;
  issues: string[];
  recommendations: string[];
}

export interface MemorySystemHealth {
  totalMemories: number;
  totalClusters: number;
  avgEmbeddingDimensions: number;
  oldestMemory: Date | null;
  newestMemory: Date | null;
  storageSize: number;
}

export class MemoryMigrationUtils {
  private db: DatabaseAdapter;
  private embedding: OllamaEmbeddingService;

  constructor() {
    this.db = new DatabaseAdapter();
    this.embedding = new OllamaEmbeddingService();
  }

  /**
   * Validate Phase 1 system requirements and schema
   */
  async validateSystem(): Promise<ValidationResult> {
    const result: ValidationResult = {
      schemaValid: false,
      embeddingServiceHealthy: false,
      databaseConnected: false,
      issues: [],
      recommendations: []
    };

    try {
      // Test database connection
      await this.db.get('SELECT 1');
      result.databaseConnected = true;

      // Validate schema
      result.schemaValid = await this.validateDatabaseSchema();
      if (!result.schemaValid) {
        result.issues.push('Database schema validation failed');
        result.recommendations.push('Run schema migration to create required tables');
      }

      // Test Ollama service
      result.embeddingServiceHealthy = await this.embedding.testConnection();
      if (!result.embeddingServiceHealthy) {
        result.issues.push('Ollama embedding service not available');
        result.recommendations.push('Ensure Ollama is running with embeddinggemma:300m model');
      }

      // Additional health checks
      if (result.schemaValid) {
        const indexIssues = await this.validateIndexes();
        result.issues.push(...indexIssues);

        if (indexIssues.length > 0) {
          result.recommendations.push('Run index optimization for better performance');
        }
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.issues.push(`System validation error: ${message}`);
    }

    return result;
  }

  /**
   * Validate database schema for Phase 1 requirements
   */
  private async validateDatabaseSchema(): Promise<boolean> {
    try {
      const requiredTables = [
        'project_memory_embeddings',
        'project_memory_clusters',
        'projects'
      ];

      for (const table of requiredTables) {
        const result = await this.db.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          [table]
        );

        if (!result) {
          return false;
        }
      }

      // Check required columns
      const embeddingsColumns = await this.db.all(
        "PRAGMA table_info(project_memory_embeddings)"
      ) as any[];

      const requiredColumns = [
        'embedding_vector',
        'vector_dimension',
        'content_hash',
        'similarity_threshold'
      ];

      for (const column of requiredColumns) {
        if (!embeddingsColumns.some(col => col.name === column)) {
          return false;
        }
      }

      return true;

    } catch {
      return false;
    }
  }

  /**
   * Validate database indexes for optimal performance
   */
  private async validateIndexes(): Promise<string[]> {
    const issues: string[] = [];

    try {
      const indexes = await this.db.all(
        "SELECT name FROM sqlite_master WHERE type='index'"
      ) as any[];

      const requiredIndexes = [
        'idx_embeddings_content_type',
        'idx_embeddings_similarity',
        'idx_clusters_relevance'
      ];

      for (const indexName of requiredIndexes) {
        if (!indexes.some(idx => idx.name === indexName)) {
          issues.push(`Missing performance index: ${indexName}`);
        }
      }

    } catch (error) {
      issues.push(`Index validation error: ${error}`);
    }

    return issues;
  }

  /**
   * Migrate existing data to Phase 1 schema
   */
  async migrateExistingData(): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: false,
      migratedCount: 0,
      errors: [],
      duration: 0
    };

    try {
      // Check for legacy data to migrate
      const legacyData = await this.findLegacyData();

      if (legacyData.length === 0) {
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // Migrate data in batches
      const batchSize = 10;
      for (let i = 0; i < legacyData.length; i += batchSize) {
        const batch = legacyData.slice(i, i + batchSize);

        try {
          await this.migrateBatch(batch);
          result.migratedCount += batch.length;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Batch migration error: ${message}`);
        }
      }

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Migration failed: ${message}`);
    }

    return result;
  }

  /**
   * Find legacy data that needs migration
   */
  private async findLegacyData(): Promise<any[]> {
    try {
      // Look for data in existing tables that needs embedding generation
      const query = `
        SELECT tc.id, tc.title, tc.description, tc.project_id, tc.content_hash
        FROM task_contexts tc
        LEFT JOIN project_memory_embeddings pme ON tc.content_hash = pme.content_hash
        WHERE pme.id IS NULL AND tc.project_id IS NOT NULL
        LIMIT 100
      `;

      return await this.db.all(query) as any[];
    } catch {
      return [];
    }
  }

  /**
   * Migrate a batch of legacy data
   */
  private async migrateBatch(batch: any[]): Promise<void> {
    for (const item of batch) {
      try {
        const content = `${item.title || ''} ${item.description || ''}`.trim();

        if (!content) continue;

        // Generate embedding
        const embedding = await this.embedding.generateEmbedding(content);

        // Store in project_memory_embeddings
        const query = `
          INSERT INTO project_memory_embeddings
          (project_id, content_hash, content, content_type, embedding_vector,
           vector_dimension, metadata, similarity_threshold)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const embeddingBuffer = Buffer.alloc(embedding.length * 4);
        for (let i = 0; i < embedding.length; i++) {
          embeddingBuffer.writeFloatBE(embedding[i], i * 4);
        }

        const params = [
          item.project_id,
          item.content_hash || this.generateHash(content),
          content,
          'task', // Assume task content type for legacy data
          embeddingBuffer,
          this.embedding.dimensions,
          JSON.stringify({ migratedFrom: 'task_contexts', originalId: item.id }),
          0.7
        ];

        await this.db.run(query, params);

      } catch (error) {
        console.warn(`Failed to migrate item ${item.id}:`, error);
      }
    }
  }

  /**
   * Generate content hash for migration
   */
  private generateHash(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content.trim()).digest('hex');
  }

  /**
   * Get system health metrics
   */
  async getSystemHealth(): Promise<MemorySystemHealth> {
    try {
      const stats = await Promise.all([
        this.db.get('SELECT COUNT(*) as count FROM project_memory_embeddings'),
        this.db.get('SELECT COUNT(*) as count FROM project_memory_clusters'),
        this.db.get('SELECT AVG(vector_dimension) as avg FROM project_memory_embeddings'),
        this.db.get('SELECT MIN(created_at) as oldest FROM project_memory_embeddings'),
        this.db.get('SELECT MAX(created_at) as newest FROM project_memory_embeddings'),
        this.getStorageSize()
      ]);

      return {
        totalMemories: (stats[0] as any)?.count || 0,
        totalClusters: (stats[1] as any)?.count || 0,
        avgEmbeddingDimensions: (stats[2] as any)?.avg || 0,
        oldestMemory: (stats[3] as any)?.oldest ? new Date((stats[3] as any).oldest) : null,
        newestMemory: (stats[4] as any)?.newest ? new Date((stats[4] as any).newest) : null,
        storageSize: stats[5] as number
      };

    } catch {
      return {
        totalMemories: 0,
        totalClusters: 0,
        avgEmbeddingDimensions: 0,
        oldestMemory: null,
        newestMemory: null,
        storageSize: 0
      };
    }
  }

  /**
   * Estimate storage size of memory system
   */
  private async getStorageSize(): Promise<number> {
    try {
      const result = await this.db.get(`
        SELECT
          SUM(LENGTH(embedding_vector)) +
          SUM(LENGTH(content)) +
          SUM(LENGTH(metadata)) as total_size
        FROM project_memory_embeddings
      `) as any;

      return result?.total_size || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Cleanup orphaned data and optimize database
   */
  async optimizeDatabase(): Promise<{ cleaned: number; optimized: boolean }> {
    try {
      // Remove orphaned embeddings
      const cleanupQuery = `
        DELETE FROM project_memory_embeddings
        WHERE project_id NOT IN (SELECT id FROM projects)
      `;

      const result = await this.db.run(cleanupQuery);

      // Vacuum database
      await this.db.run('VACUUM');

      // Analyze for query optimization
      await this.db.run('ANALYZE');

      return {
        cleaned: result.changes || 0,
        optimized: true
      };

    } catch {
      return {
        cleaned: 0,
        optimized: false
      };
    }
  }
}