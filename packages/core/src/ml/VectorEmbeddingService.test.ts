import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VectorEmbeddingService } from './VectorEmbeddingService.js';
import type { MemoryBlock, KnowledgeEntity, SemanticSearchOptions } from '@devflow/shared';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock OpenAI API response
const mockEmbeddingResponse = {
  data: [{
    embedding: new Array(1536).fill(0).map(() => Math.random()),
    index: 0,
    object: 'embedding'
  }],
  model: 'text-embedding-3-small',
  object: 'list',
  usage: { prompt_tokens: 10, total_tokens: 10 }
};

describe('VectorEmbeddingService', () => {
  let service: VectorEmbeddingService;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    // Use in-memory database for testing
    service = new VectorEmbeddingService('text-embedding-3-small', mockApiKey, ':memory:');
    
    // Reset fetch mock
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockEmbeddingResponse)
    });
  });

  afterEach(() => {
    service.dispose();
  });

  describe('generateEmbeddings', () => {
    it('should generate embeddings for text', async () => {
      const text = 'Test embedding text';
      const result = await service.generateEmbeddings(text);

      expect(result).toMatchObject({
        embedding: expect.any(Float32Array),
        model: 'text-embedding-3-small',
        tokens: expect.any(Number),
        provider: 'OpenAI'
      });

      expect(result.embedding).toHaveLength(1536);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            input: text,
            model: 'text-embedding-3-small',
            encoding_format: 'float'
          })
        })
      );
    });

    it('should use cache for repeated requests', async () => {
      const text = 'Cached embedding text';
      
      // First call
      const result1 = await service.generateEmbeddings(text);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Second call should use cache
      const result2 = await service.generateEmbeddings(text);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No additional API call
      
      expect(result1.embedding).toEqual(result2.embedding);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      await expect(service.generateEmbeddings('test'))
        .rejects.toThrow('OpenAI API error: 401 Unauthorized');
    });

    it('should handle missing API key', async () => {
      const serviceNoKey = new VectorEmbeddingService('text-embedding-3-small', undefined, ':memory:');
      
      await expect(serviceNoKey.generateEmbeddings('test'))
        .rejects.toThrow('OpenAI API key not available');
        
      serviceNoKey.dispose();
    });
  });

  describe('embedText', () => {
    it('should return Float32Array embedding', async () => {
      const text = 'Simple embed text';
      const embedding = await service.embedText(text);

      expect(embedding).toBeInstanceOf(Float32Array);
      expect(embedding).toHaveLength(1536);
    });
  });

  describe('batch processing', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = ['Text 1', 'Text 2', 'Text 3'];
      const result = await service.generateBatchEmbeddings(texts);

      expect(result.embeddings).toHaveLength(3);
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle batch errors gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockEmbeddingResponse) })
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockEmbeddingResponse) });

      const texts = ['Text 1', 'Text 2', 'Text 3'];
      const result = await service.generateBatchEmbeddings(texts);

      expect(result.embeddings).toHaveLength(3);
      expect(result.embeddings[0]).toBeInstanceOf(Float32Array);
      expect(result.embeddings[1]).toBeUndefined(); // Failed
      expect(result.embeddings[2]).toBeInstanceOf(Float32Array);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        index: 1,
        error: expect.stringContaining('API Error')
      });
    });
  });

  describe('MemoryBlock embeddings', () => {
    it('should store and retrieve MemoryBlock embedding', async () => {
      const blockId = 'test-block-123';
      const embedding = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      const model = 'text-embedding-3-small';

      await service.storeMemoryBlockEmbedding(blockId, embedding, model);
      const retrieved = await service.getMemoryBlockEmbedding(blockId, model);

      expect(retrieved).toEqual(embedding);
    });

    it('should handle multiple MemoryBlocks', async () => {
      const blocks: MemoryBlock[] = [
        {
          id: 'block-1',
          taskId: 'task-1',
          sessionId: 'session-1',
          blockType: 'implementation',
          label: 'Test Block 1',
          content: 'Block 1 content',
          metadata: { platform: 'claude_code' },
          importanceScore: 0.8,
          relationships: [],
          embedding: new Float32Array([0.1, 0.2]),
          embeddingModel: 'text-embedding-3-small',
          createdAt: new Date(),
          lastAccessed: new Date(),
          accessCount: 1
        },
        {
          id: 'block-2',
          taskId: 'task-1',
          sessionId: 'session-1',
          blockType: 'debugging',
          label: 'Test Block 2',
          content: 'Block 2 content',
          metadata: { platform: 'openai_codex' },
          importanceScore: 0.6,
          relationships: [],
          embedding: new Float32Array([0.3, 0.4]),
          embeddingModel: 'text-embedding-3-small',
          createdAt: new Date(),
          lastAccessed: new Date(),
          accessCount: 2
        }
      ];

      await service.storeMemoryBlockEmbeddings(blocks);

      const embedding1 = await service.getMemoryBlockEmbedding('block-1');
      const embedding2 = await service.getMemoryBlockEmbedding('block-2');

      expect(embedding1).toEqual(blocks[0].embedding);
      expect(embedding2).toEqual(blocks[1].embedding);
    });
  });

  describe('KnowledgeEntity embeddings', () => {
    it('should store and retrieve KnowledgeEntity embedding', async () => {
      const entityId = 'entity-123';
      const embedding = new Float32Array([0.5, 0.6, 0.7, 0.8]);
      const model = 'text-embedding-3-small';

      await service.storeEntityEmbedding(entityId, embedding, model);
      const retrieved = await service.getEntityEmbedding(entityId, model);

      expect(retrieved).toEqual(embedding);
    });

    it('should handle multiple KnowledgeEntities', async () => {
      const entities: KnowledgeEntity[] = [
        {
          id: 'entity-1',
          entityType: 'technology',
          name: 'TypeScript',
          confidenceScore: 0.9,
          extractionSource: {
            sessionId: 'session-1',
            platform: 'claude_code',
            extractionMethod: 'manual',
            confidence: 0.9,
            sourceContext: 'Used in project'
          },
          firstSeen: new Date(),
          lastConfirmed: new Date(),
          usageCount: 5,
          validationStatus: 'confirmed',
          embedding: new Float32Array([0.1, 0.2, 0.3]),
          tags: ['language', 'frontend']
        }
      ];

      await service.storeEntityEmbeddings(entities);
      const retrieved = await service.getEntityEmbedding('entity-1');

      expect(retrieved).toEqual(entities[0].embedding);
    });
  });

  describe('similarity calculations', () => {
    it('should calculate cosine similarity correctly', () => {
      const vec1 = new Float32Array([1, 0, 0]);
      const vec2 = new Float32Array([0, 1, 0]);
      const vec3 = new Float32Array([1, 0, 0]);

      expect(service.cosineSimilarity(vec1, vec2)).toBeCloseTo(0); // Orthogonal
      expect(service.cosineSimilarity(vec1, vec3)).toBeCloseTo(1); // Identical
    });

    it('should throw error for mismatched dimensions', () => {
      const vec1 = new Float32Array([1, 0]);
      const vec2 = new Float32Array([1, 0, 0]);

      expect(() => service.cosineSimilarity(vec1, vec2))
        .toThrow('Vector dimensions must match');
    });
  });

  describe('semantic search', () => {
    beforeEach(async () => {
      // Create mock memory_blocks table for testing (drop and recreate to avoid constraints)
      service['db'].exec('DROP TABLE IF EXISTS memory_blocks');
      service['db'].exec(`
        CREATE TABLE memory_blocks (
          id TEXT PRIMARY KEY,
          task_id TEXT,
          session_id TEXT,
          block_type TEXT,
          label TEXT,
          content TEXT,
          metadata TEXT,
          importance_score REAL,
          relationships TEXT,
          created_at TEXT,
          last_accessed TEXT,
          access_count INTEGER
        )
      `);
      
      // Setup test data in database
      const testBlocks: MemoryBlock[] = [
        {
          id: 'search-block-1',
          taskId: 'task-search',
          sessionId: 'session-search',
          blockType: 'implementation',
          label: 'JavaScript Function',
          content: 'function calculateSum(a, b) { return a + b; }',
          metadata: { platform: 'claude_code' },
          importanceScore: 0.8,
          relationships: [],
          embedding: new Float32Array(1536).fill(0.0).map((_, i) => i === 0 ? 1.0 : 0.0), // Very similar to query
          embeddingModel: 'text-embedding-3-small',
          createdAt: new Date(),
          lastAccessed: new Date(),
          accessCount: 1
        },
        {
          id: 'search-block-2',
          taskId: 'task-search',
          sessionId: 'session-search',
          blockType: 'debugging',
          label: 'Error Handling',
          content: 'try { risky(); } catch(e) { console.log(e); }',
          metadata: { platform: 'openai_codex' },
          importanceScore: 0.6,
          relationships: [],
          embedding: new Float32Array(1536).fill(0.0).map((_, i) => i === 1 ? 1.0 : 0.0), // Very different from query
          embeddingModel: 'text-embedding-3-small',
          createdAt: new Date(),
          lastAccessed: new Date(),
          accessCount: 2
        }
      ];

      // Insert test blocks into memory_blocks table
      for (const block of testBlocks) {
        service['db'].prepare(`
          INSERT INTO memory_blocks 
          (id, task_id, session_id, block_type, label, content, metadata, importance_score, relationships, created_at, last_accessed, access_count)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          block.id, block.taskId, block.sessionId, block.blockType, block.label, block.content,
          JSON.stringify(block.metadata), block.importanceScore, JSON.stringify(block.relationships),
          block.createdAt.toISOString(), block.lastAccessed.toISOString(), block.accessCount
        );
      }

      await service.storeMemoryBlockEmbeddings(testBlocks);
    });

    it('should find similar memory blocks', async () => {
      const queryEmbedding = new Float32Array(1536).fill(0.0).map((_, i) => i === 0 ? 1.0 : 0.0); // Very similar to first block
      const options: SemanticSearchOptions = {
        threshold: 0.5,
        maxResults: 10
      };

      const results = await service.findSimilarMemoryBlocks(queryEmbedding, options);

      expect(results).toHaveLength(1); // Only first block should be similar enough
      expect(results[0].block.id).toBe('search-block-1');
      expect(results[0].similarity).toBeGreaterThan(0.5);
    });

    it('should perform semantic search with text query', async () => {
      const query = 'JavaScript calculation function';
      const results = await service.semanticSearch(query, { threshold: 0.1 });

      // Should call API and find results based on similarity
      expect(mockFetch).toHaveBeenCalled();
      expect(results).toBeInstanceOf(Array);
    });
  });

  describe('cache management', () => {
    it('should track cache statistics', () => {
      const stats = service.getCacheStats();
      
      expect(stats).toMatchObject({
        size: expect.any(Number),
        hitRate: expect.any(Number),
        memoryUsage: expect.any(Number)
      });
    });

    it('should clear expired cache entries', () => {
      service.clearExpiredCache();
      const stats = service.getCacheStats();
      expect(stats.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling', () => {
    it('should handle invalid API responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }) // Empty data
      });

      await expect(service.generateEmbeddings('test'))
        .rejects.toThrow('Invalid response from OpenAI API');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.generateEmbeddings('test'))
        .rejects.toThrow('Embedding generation failed: Network error');
    });
  });
});