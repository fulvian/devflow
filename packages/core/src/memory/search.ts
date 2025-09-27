import type Database from 'better-sqlite3';
import type { MemoryBlock, SemanticSearchOptions, SemanticSearchResult } from '@devflow/shared';

export class SearchService {
  constructor(private db: Database.Database) {}

  fullText(query: string, limit = 20): MemoryBlock[] {
    const rows = this.db.prepare(`
      SELECT mb.* FROM memory_fts f
      JOIN memory_blocks mb ON mb.rowid = f.rowid
      WHERE memory_fts MATCH ?
      ORDER BY mb.rowid DESC LIMIT ?
    `).all(query, limit) as any[];
    return rows.map(r => ({
      id: r.id,
      taskId: r.task_id,
      sessionId: r.session_id,
      blockType: r.block_type,
      label: r.label,
      content: r.content,
      metadata: JSON.parse(r.metadata ?? '{}'),
      importanceScore: r.importance_score,
      relationships: JSON.parse(r.relationships ?? '[]'),
      embeddingModel: r.embedding_model ?? undefined,
      createdAt: new Date(r.created_at),
      lastAccessed: new Date(r.last_accessed),
      accessCount: r.access_count,
    }));
  }

  // Semantic search placeholder: uses FTS rank as similarity
  semantic(query: string, options: SemanticSearchOptions = {}): SemanticSearchResult[] {
    // Fallback to keyword-only search
    const limit = options.maxResults ?? 20;
    const rows = this.db.prepare(`
      SELECT mb.* FROM memory_fts f
      JOIN memory_blocks mb ON mb.rowid = f.rowid
      WHERE memory_fts MATCH ?
      ORDER BY mb.rowid DESC LIMIT ?
    `).all(query, limit) as any[];
    
    return rows.map(r => ({
      block: {
        id: r.id,
        taskId: r.task_id,
        sessionId: r.session_id,
        blockType: r.block_type,
        label: r.label,
        content: r.content,
        metadata: JSON.parse(r.metadata ?? '{}'),
        importanceScore: r.importance_score,
        relationships: JSON.parse(r.relationships ?? '[]'),
        embeddingModel: r.embedding_model ?? undefined,
        createdAt: new Date(r.created_at),
        lastAccessed: new Date(r.last_accessed),
        accessCount: r.access_count,
      } as MemoryBlock,
      similarity: 0.5,
      relevanceScore: 0.5,
      context: r.content.substring(0, 200)
    }));
  }
}
