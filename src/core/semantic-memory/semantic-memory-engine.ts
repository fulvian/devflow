/**
 * SemanticMemoryEngine - Enhanced project memory with Ollama embeddings
 * Manages vector storage, retrieval, and semantic content organization
 * Integrates with existing project_memory_embeddings table
 */

import { OllamaEmbeddingService } from './ollama-embedding-service';
import { DatabaseAdapter } from './database-adapter';
import * as crypto from 'crypto';

export interface MemoryContent {
  content: string;
  contentType: 'task' | 'conversation' | 'file' | 'decision' | 'context';
  metadata?: Record<string, any>;
  projectId: number;
}

export interface MemoryRecord {
  id: number;
  projectId: number;
  contentHash: string;
  content: string;
  contentType: string;
  embeddingVector: number[];
  vectorDimension: number;
  metadata: Record<string, any>;
  similarityThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemorySearchOptions {
  projectId: number;
  contentTypes?: string[];
  similarityThreshold?: number;
  limit?: number;
  includeMetadata?: boolean;
}

export interface MemorySearchResult {
  memory: MemoryRecord;
  similarity: number;
}

export class SemanticMemoryError extends Error {
  constructor(message: string) {
    super(`SemanticMemory: ${message}`);
    this.name = 'SemanticMemoryError';
  }
}

export class SemanticMemoryEngine {
  private db: DatabaseAdapter;
  private embedding: OllamaEmbeddingService;

  constructor() {
    this.db = new DatabaseAdapter();
    this.embedding = new OllamaEmbeddingService();
  }

  /**
   * Store memory with semantic embedding
   */
  async storeMemory(memoryContent: MemoryContent): Promise<string> {
    try {
      const contentHash = this.generateContentHash(memoryContent.content);

      // Check for existing memory with same content hash
      const existing = await this.getMemoryByHash(contentHash);
      if (existing) {
        return contentHash;
      }

      // Generate embedding using Ollama
      const embedding = await this.embedding.generateEmbedding(memoryContent.content);

      // Store in database
      const query = `
        INSERT INTO project_memory_embeddings
        (project_id, content_hash, content, content_type, embedding_vector,
         vector_dimension, metadata, similarity_threshold)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        memoryContent.projectId,
        contentHash,
        memoryContent.content,
        memoryContent.contentType,
        this.serializeEmbedding(embedding),
        this.embedding.dimensions,
        JSON.stringify(memoryContent.metadata || {}),
        0.7 // Default similarity threshold
      ];

      await this.db.run(query, params);
      return contentHash;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new SemanticMemoryError(`Failed to store memory: ${message}`);
    }
  }

  /**
   * Retrieve memory by content hash
   */
  async getMemoryByHash(contentHash: string): Promise<MemoryRecord | null> {
    try {
      const query = `
        SELECT id, project_id, content_hash, content, content_type,
               embedding_vector, vector_dimension, metadata,
               similarity_threshold, created_at, updated_at
        FROM project_memory_embeddings
        WHERE content_hash = ?
      `;

      const row = await this.db.get(query, [contentHash]) as any;

      if (!row) return null;

      return this.mapRowToMemoryRecord(row);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new SemanticMemoryError(`Failed to retrieve memory: ${message}`);
    }
  }

  /**
   * Update existing memory content and embedding
   */
  async updateMemory(contentHash: string, newContent: string, metadata?: Record<string, any>): Promise<void> {
    try {
      const newHash = this.generateContentHash(newContent);
      const embedding = await this.embedding.generateEmbedding(newContent);

      const query = `
        UPDATE project_memory_embeddings
        SET content_hash = ?, content = ?, embedding_vector = ?,
            metadata = ?, updated_at = CURRENT_TIMESTAMP
        WHERE content_hash = ?
      `;

      const params = [
        newHash,
        newContent,
        this.serializeEmbedding(embedding),
        JSON.stringify(metadata || {}),
        contentHash
      ];

      await this.db.run(query, params);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new SemanticMemoryError(`Failed to update memory: ${message}`);
    }
  }

  /**
   * Generate SHA-256 hash of content for deduplication
   */
  private generateContentHash(content: string): string {
    return crypto.createHash('sha256').update(content.trim()).digest('hex');
  }

  /**
   * Serialize embedding vector to BLOB format
   */
  private serializeEmbedding(embedding: number[]): Buffer {
    const buffer = Buffer.alloc(embedding.length * 4); // 4 bytes per float32
    for (let i = 0; i < embedding.length; i++) {
      buffer.writeFloatBE(embedding[i], i * 4);
    }
    return buffer;
  }

  /**
   * Deserialize embedding vector from BLOB format
   */
  private deserializeEmbedding(buffer: Buffer): number[] {
    const embedding: number[] = [];
    for (let i = 0; i < buffer.length; i += 4) {
      embedding.push(buffer.readFloatBE(i));
    }
    return embedding;
  }

  /**
   * Map database row to MemoryRecord object
   */
  private mapRowToMemoryRecord(row: any): MemoryRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      contentHash: row.content_hash,
      content: row.content,
      contentType: row.content_type,
      embeddingVector: this.deserializeEmbedding(row.embedding_vector),
      vectorDimension: row.vector_dimension,
      metadata: JSON.parse(row.metadata || '{}'),
      similarityThreshold: row.similarity_threshold,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Get all memories for a project
   */
  async getProjectMemories(projectId: number, contentTypes?: string[]): Promise<MemoryRecord[]> {
    try {
      let query = `
        SELECT id, project_id, content_hash, content, content_type,
               embedding_vector, vector_dimension, metadata,
               similarity_threshold, created_at, updated_at
        FROM project_memory_embeddings
        WHERE project_id = ?
      `;

      const params: any[] = [projectId];

      if (contentTypes && contentTypes.length > 0) {
        query += ` AND content_type IN (${contentTypes.map(() => '?').join(',')})`;
        params.push(...contentTypes);
      }

      query += ` ORDER BY created_at DESC`;

      const rows = await this.db.all(query, params) as any[];

      return rows.map(row => this.mapRowToMemoryRecord(row));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new SemanticMemoryError(`Failed to get project memories: ${message}`);
    }
  }

  /**
   * Delete memory by content hash
   */
  async deleteMemory(contentHash: string): Promise<void> {
    try {
      const query = 'DELETE FROM project_memory_embeddings WHERE content_hash = ?';
      await this.db.run(query, [contentHash]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new SemanticMemoryError(`Failed to delete memory: ${message}`);
    }
  }

  /**
   * Get memory count for a project
   */
  async getMemoryCount(projectId: number): Promise<number> {
    try {
      const query = 'SELECT COUNT(*) as count FROM project_memory_embeddings WHERE project_id = ?';
      const result = await this.db.get(query, [projectId]) as any;
      return result?.count || 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new SemanticMemoryError(`Failed to get memory count: ${message}`);
    }
  }
}