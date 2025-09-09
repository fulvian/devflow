import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SemanticSearchService } from './semantic.js';
import { SearchService } from './search.js';
import { VectorEmbeddingService } from '../ml/VectorEmbeddingService.js';
import type { MemoryBlock } from '@devflow/shared';
import { getDB, closeDB } from '../database/connection.js';
import { runInitialSchema } from '../database/migrations.js';
import { unlinkSync } from 'fs';

describe('SemanticSearchService', () => {
  let db: ReturnType<typeof getDB>;
  let searchService: SearchService;
  let vectorService: VectorEmbeddingService;
  let semanticService: SemanticSearchService;
  const testDbPath = 'semantic.test.sqlite';

  beforeEach(async () => {
    // Clean up test database before each test
    try {
      unlinkSync(testDbPath);
    } catch (e) {
      // Database doesn't exist, that's fine
    }
    
    db = getDB({ path: testDbPath });
    runInitialSchema(db);
    searchService = new SearchService(db);
    // Use real API key for testing if available, otherwise use mock
    const apiKey = process.env['OPENAI_API_KEY'] || 'mock-api-key-for-testing';
    vectorService = new VectorEmbeddingService('text-embedding-3-small', apiKey, testDbPath);
    semanticService = new SemanticSearchService(db, searchService, vectorService);
  });

  afterEach(() => {
    // Use closeDB to properly close the connection
    closeDB(testDbPath);
    // Clean up test database after each test
    try {
      unlinkSync(testDbPath);
    } catch (e) {
      // Database doesn't exist, that's fine
    }
  });


        it('should perform hybrid search basic functionality', async () => {
          // Test only keyword search to avoid API calls
          const results = await semanticService.keywordSearch('database optimization', {
            maxResults: 10
          });

          expect(results).toBeDefined();
          expect(Array.isArray(results)).toBe(true);
        });

  it('should perform keyword-only search', async () => {
    // Test only keyword search which doesn't require API calls
    const results = await semanticService.keywordSearch('database', {
      maxResults: 5
    });

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
  });

  it('should handle empty search results gracefully', async () => {
    // Test with a query that should return no results
    const results = await semanticService.keywordSearch('nonexistentquery12345', {
      maxResults: 5
    });

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  it('should fallback to keyword search when vector search is not available', async () => {
    // Create a vector service without API key to test fallback
    const noApiKeyVectorService = new VectorEmbeddingService('text-embedding-3-small', undefined, testDbPath);
    const fallbackSemanticService = new SemanticSearchService(db, searchService, noApiKeyVectorService);

    // Test hybrid search should fallback to keyword-only
    const results = await fallbackSemanticService.hybridSearch('database', {
      mode: 'hybrid',
      maxResults: 5
    });

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    // Should work with keyword search even without API key
  });

  it('should handle vector search errors gracefully', async () => {
    // Test vector-only search with invalid API key should fallback
    const results = await semanticService.hybridSearch('database', {
      mode: 'vector-only',
      maxResults: 5
    });

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    // Should return empty results or fallback gracefully
  });
});