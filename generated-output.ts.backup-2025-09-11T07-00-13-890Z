```json
{
  "modifications": [
    {
      "file": "src/services/SemanticSearchService.ts",
      "operation": "create",
      "content": "import { VectorEmbeddingService } from './VectorEmbeddingService';\nimport { SQLiteMemoryManager } from '../storage/SQLiteMemoryManager';\nimport { MemoryBlock, SemanticSearchResult } from '../types/shared';\nimport { LRUCache } from '../utils/LRUCache';\n\ninterface SearchConfig {\n  bm25Weight: number;\n  vectorWeight: number;\n  topK: number;\n  cacheSize: number;\n}\n\nclass SemanticSearchService {\n  private embeddingService: VectorEmbeddingService;\n  private memoryManager: SQLiteMemoryManager;\n  private cache: LRUCache<string, SemanticSearchResult[]>;\n  private config: SearchConfig;\n\n  constructor(\n    embeddingService: VectorEmbeddingService,\n    memoryManager: SQLiteMemoryManager,\n    config: SearchConfig\n  ) {\n    this.embeddingService = embeddingService;\n    this.memoryManager = memoryManager;\n    this.config = config;\n    this.cache = new LRUCache(config.cacheSize);\n  }\n\n  async search(query: string): Promise<SemanticSearchResult[]> {\n    // Check cache first\n    const cached = this.cache.get(query);\n    if (cached) {\n      return cached;\n    }\n\n    // Generate query embedding\n    const queryEmbedding = await this.embeddingService.generateEmbedding(query);\n    \n    // Get all memory blocks\n    const memoryBlocks = await this.memoryManager.getAllMemoryBlocks();\n    \n    // Calculate scores in parallel\n    const scoredBlocks = await Promise.all(\n      memoryBlocks.map(async (block) => {\n        const bm25Score = this.calculateBM25(query, block.content);\n        const vectorScore = await this.calculateVectorSimilarity(queryEmbedding, block);\n        \n        const combinedScore = \n          this.config.bm25Weight * bm25Score + \n          this.config.vectorWeight * vectorScore;\n          \n        return {\n          block,\n          score: combinedScore,\n          bm25Score,\n          vectorScore\n        };\n      })\n    );\n    \n    // Sort by combined score and take topK\n    const results = scoredBlocks\n      .sort((a, b) => b.score - a.score)\n      .slice(0, this.config.topK)\n      .map(item => ({\n        memoryBlock: item.block,\n        score: item.score,\n        details: {\n          bm25Score: item.bm25Score,\n          vectorScore: item.vectorScore\n        }\n      }));\n    \n    // Cache results\n    this.cache.set(query, results);\n    \n    return results;\n  }\n\n  private calculateBM25(query: string, content: string): number {\n    // Simplified BM25 implementation\n    const queryTerms = query.toLowerCase().split(' ');\n    const contentTerms = content.toLowerCase().split(' ');\n    \n    let score = 0;\n    const contentLength = contentTerms.length;\n    \n    for (const term of queryTerms) {\n      const termFreq = contentTerms.filter(t => t === term).length;\n      if (termFreq > 0) {\n        // Simplified BM25 formula\n        const idf = Math.log((contentLength - termFreq + 0.5) / (termFreq + 0.5) + 1);\n        const tf = termFreq / contentLength;\n        score += idf * (tf / (tf + 0.75));\n      }\n    }\n    \n    return score;\n  }\n\n  private async calculateVectorSimilarity(\n    queryEmbedding: number[], \n    block: MemoryBlock\n  ): Promise<number> {\n    // Get or generate embedding for memory block\n    let blockEmbedding = block.embedding;\n    if (!blockEmbedding) {\n      blockEmbedding = await this.embeddingService.generateEmbedding(block.content);\n    }\n    \n    // Calculate cosine similarity\n    return this.cosineSimilarity(queryEmbedding, blockEmbedding);\n  }\n\n  private cosineSimilarity(vecA: number[], vecB: number[]): number {\n    if (vecA.length !== vecB.length) {\n      throw new Error('Vectors must have the same dimensions');\n    }\n    \n    let dotProduct = 0;\n    let magnitudeA = 0;\n    let magnitudeB = 0;\n    \n    for (let i = 0; i < vecA.length; i++) {\n      dotProduct += vecA[i] * vecB[i];\n      magnitudeA += vecA[i] * vecA[i];\n      magnitudeB += vecB[i] * vecB[i];\n    }\n    \n    magnitudeA = Math.sqrt(magnitudeA);\n    magnitudeB = Math.sqrt(magnitudeB);\n    \n    if (magnitudeA === 0 || magnitudeB === 0) {\n      return 0;\n    }\n    \n    return dotProduct / (magnitudeA * magnitudeB);\n  }\n\n  // Update configuration\n  updateConfig(newConfig: Partial<SearchConfig>): void {\n    this.config = { ...this.config, ...newConfig };\n    // Resize cache if needed\n    if (newConfig.cacheSize !== undefined) {\n      this.cache = new LRUCache(newConfig.cacheSize);\n    }\n  }\n\n  // Clear cache\n  clearCache(): void {\n    this.cache.clear();\n  }\n}\n\nexport { SemanticSearchService };",
      "storage_integration": {
        "create_task_entry": true,
        "update_memory_blocks": false,
        "cc_sessions_compatible": true
      }
    },
    {
      "file": "src/types/shared.ts",
      "operation": "patch",
      "content": "export interface MemoryBlock {\n  id: string;\n  content: string;\n  embedding?: number[];\n  metadata?: Record<string, any>;\n  createdAt: Date;\n  updatedAt: Date;\n}\n\nexport interface SemanticSearchResult {\n  memoryBlock: MemoryBlock;\n  score: number;\n  details?: {\n    bm25Score: number;\n    vectorScore: number;\n  };\n}",
      "storage_integration": {
        "create_task_entry": false,
        "update_memory_blocks": false,
        "cc_sessions_compatible": true
      }
    },
    {
      "file": "src/utils/LRUCache.ts",
      "operation": "create",
      "content": "class LRUCache<K, V> {\n  private cache: Map<K, V>;\n  private capacity: number;\n\n  constructor(capacity: number) {\n    this.capacity = capacity;\n    this.cache = new Map<K, V>();\n  }\n\n  get(key: K): V | undefined {\n    const item = this.cache.get(key);\n    if (item) {\n      // Move to front (most recently used)\n      this.cache.delete(key);\n      this.cache.set(key, item);\n    }\n    return item;\n  }\n\n  set(key: K, value: V): void {\n    // If key already exists, delete it to update position\n    if (this.cache.has(key)) {\n      this.cache.delete(key);\n    } else if (this.cache.size >= this.capacity) {\n      // Remove least recently used item\n      const firstKey = this.cache.keys().next().value;\n      if (firstKey !== undefined) {\n        this.cache.delete(firstKey);\n      }\n    }\n    \n    // Add new item\n    this.cache.set(key, value);\n  }\n\n  clear(): void {\n    this.cache.clear();\n  }\n\n  size(): number {\n    return this.cache.size;\n  }\n}\n\nexport { LRUCache };",
      "storage_integration": {
        "create_task_entry": true,
        "update_memory_blocks": false,
        "cc_sessions_compatible": true
      }
    }
  ],
  "storage_actions": {
    "mode": "cc-sessions",
    "actions": ["create_memory_entry", "update_task_file"]
  },
  "summary": "Implemented SemanticSearchService with BM25 + vector fusion algorithm, LRU caching, and parallel query processing. Created LRUCache utility and updated shared types for memory blocks and search results.",
  "tokensEstimatedSaved": 800
}
```