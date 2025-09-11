# DevFlow Phase 2 Semantic Search Engine Architecture
## DEVFLOW-P2-SEARCH-DESIGN-002A - Architecture Design

**Created**: 2025-09-09  
**Status**: Complete  
**Phase**: Advanced Intelligence (Phase 2)  
**Owner**: Claude Code (Architect)

---

## 🎯 Executive Summary

**Objective**: Design hybrid semantic search engine combining FTS5 keyword search with vector similarity for DevFlow Advanced Intelligence Phase 2.

**Approach**: Extend existing SearchService with SemanticSearchService that orchestrates both FTS5 and VectorEmbeddingService, providing configurable hybrid ranking algorithm.

**Key Innovation**: Weighted combination of BM25 keyword scores and cosine similarity semantic scores with intelligent result fusion and ranking.

---

## 🔍 Current System Analysis

### **Existing FTS5 Keyword Search**
```typescript
// packages/core/src/memory/search.ts
class SearchService {
  fullText(query: string, limit = 20): MemoryBlock[]
  semantic(query: string, options: SemanticSearchOptions = {}): SemanticSearchResult[] // placeholder
}
```

**Current Capabilities**:
- ✅ FTS5 full-text search with BM25 scoring via `memory_fts` virtual table
- ✅ Automatic indexing via database triggers  
- ✅ Porter stemming and ASCII tokenization
- ❌ Semantic similarity placeholder (returns fixed 0.5 similarity)

### **Existing Vector System**  
```typescript
// packages/core/src/ml/VectorEmbeddingService.ts
class VectorEmbeddingService {
  async semanticSearch(query: string, options: SemanticSearchOptions): Promise<SemanticSearchResult[]>
  async findSimilarMemoryBlocks(queryEmbedding: Float32Array, options): Promise<SimilarityMatch[]>
  cosineSimilarity(a: Float32Array, b: Float32Array): number
}
```

**Current Capabilities**:
- ✅ OpenAI embeddings (text-embedding-3-small/large) via API
- ✅ Vector storage in `memory_blocks.embedding` BLOB column
- ✅ Cosine similarity calculations with configurable thresholds
- ✅ Semantic search with similarity-based ranking
- ❌ No integration with FTS5 keyword search

### **Database Schema Foundation**
```sql
-- FTS5 Virtual Table
CREATE VIRTUAL TABLE memory_fts USING fts5(
    content, label, block_type,
    content='memory_blocks', content_rowid='rowid',
    tokenize='porter ascii'
);

-- Memory Blocks with Vector Support  
CREATE TABLE memory_blocks (
    -- ... other columns
    embedding BLOB, -- Vector embeddings for semantic similarity
    embedding_model TEXT DEFAULT 'text-embedding-3-small'
);
```

---

## 🏗️ Hybrid Search Architecture Design

### **Core Component: SemanticSearchService**

```typescript
export class SemanticSearchService {
  constructor(
    private searchService: SearchService,
    private vectorService: VectorEmbeddingService,
    private config: HybridSearchConfig = DEFAULT_CONFIG
  ) {}

  // Primary hybrid search interface
  async hybridSearch(
    query: string, 
    options: HybridSearchOptions = {}
  ): Promise<HybridSearchResult[]>

  // Individual search modes
  async keywordSearch(query: string, options: SearchOptions): Promise<KeywordSearchResult[]>
  async vectorSearch(query: string, options: VectorSearchOptions): Promise<VectorSearchResult[]>
  async rankedHybridSearch(query: string, options: RankedSearchOptions): Promise<RankedSearchResult[]>
}
```

### **Hybrid Ranking Algorithm**

#### **1. Dual Search Execution**
```typescript
interface HybridSearchExecution {
  // Execute both searches in parallel
  keywordResults: KeywordSearchResult[]  // FTS5 BM25 scores
  vectorResults: VectorSearchResult[]    // Cosine similarities  
  
  // Normalize scores to [0,1] range
  normalizedKeywordScores: Map<string, number>
  normalizedVectorScores: Map<string, number>
}
```

#### **2. Score Fusion Strategy**  
```typescript
interface HybridScore {
  blockId: string
  keywordScore: number      // FTS5 BM25 normalized [0,1]
  semanticScore: number     // Cosine similarity [0,1]  
  hybridScore: number       // Weighted combination
  fusionMethod: 'weighted' | 'harmonic' | 'geometric'
  explanation: string       // Why this result ranked here
}

// Configurable fusion methods
function calculateHybridScore(
  keywordScore: number,
  semanticScore: number, 
  weights: { keyword: number, semantic: number },
  method: FusionMethod
): number {
  switch (method) {
    case 'weighted':
      return weights.keyword * keywordScore + weights.semantic * semanticScore
    case 'harmonic':
      return 2 / (1/keywordScore + 1/semanticScore)  
    case 'geometric':
      return Math.sqrt(keywordScore * semanticScore)
  }
}
```

#### **3. Result Deduplication & Ranking**
```typescript
interface ResultFusion {
  // Handle overlapping results from both searches
  deduplicate(keywordResults: KeywordSearchResult[], vectorResults: VectorSearchResult[]): MergedResult[]
  
  // Apply hybrid scoring algorithm
  rankResults(mergedResults: MergedResult[], algorithm: RankingAlgorithm): RankedResult[]
  
  // Apply filtering and limits
  filterAndLimit(rankedResults: RankedResult[], options: FilterOptions): FinalResult[]
}
```

---

## 📊 API Contract Specification

### **Core Interfaces**

```typescript
// Main search options interface
interface HybridSearchOptions extends SemanticSearchOptions {
  // Search mode configuration
  mode: 'hybrid' | 'keyword-only' | 'vector-only' | 'intelligent'
  
  // Hybrid ranking configuration  
  weights: {
    keyword: number    // Weight for FTS5 BM25 scores [0,1]
    semantic: number   // Weight for vector similarity [0,1]  
  }
  
  // Advanced options
  fusionMethod: 'weighted' | 'harmonic' | 'geometric'
  minKeywordScore: number     // Minimum BM25 score threshold
  minSemanticScore: number    // Minimum cosine similarity threshold  
  boostExactMatches: boolean  // Boost results with exact keyword matches
  
  // Filtering and pagination
  maxResults: number
  blockTypes: string[]        // Filter by block types
  taskIds: string[]           // Filter by specific tasks
  dateRange: { from: Date, to: Date }
  importanceThreshold: number // Filter by importance score
}

// Enhanced search result interface
interface HybridSearchResult extends SemanticSearchResult {
  // Core result data
  block: MemoryBlock
  
  // Scoring breakdown
  scores: {
    keyword: number           // FTS5 BM25 score [0,1]
    semantic: number          // Cosine similarity [0,1]
    hybrid: number           // Combined score [0,1]
    importance: number       // Block importance weight
  }
  
  // Result metadata
  matchType: 'keyword' | 'semantic' | 'both'
  keywordMatches: string[]   // Matched terms from FTS5
  semanticContext: string    // Relevant semantic context snippet
  explanation: string        // Human-readable ranking explanation
  
  // Enhanced context
  relevanceContext: string   // Extended relevant context
  relatedBlocks: string[]    // IDs of semantically related blocks
}
```

---

## ⚡ Performance Requirements

### **Response Time Targets**
- **Hybrid Search**: <200ms for standard queries (up to 1000 blocks)
- **Keyword-only Search**: <50ms (maintain current performance)  
- **Vector-only Search**: <150ms (current VectorEmbeddingService performance)
- **Batch Search**: <500ms for up to 10 concurrent queries

### **Quality Targets** 
- **Accuracy**: >90% improvement over keyword-only search for semantic queries
- **Relevance**: >85% user satisfaction with hybrid results vs pure keyword
- **Coverage**: Handle both technical keywords and natural language queries
- **Consistency**: Stable ranking for identical queries across sessions

---

## 🔧 Implementation Strategy  

### **Phase 1: Algorithm Design (Next)**
**Subtask**: DEVFLOW-P2-SEARCH-ALGO-002B  
**Owner**: Synthetic_Reasoning (DeepSeek-V3)
- Hybrid ranking algorithm with configurable fusion methods
- Score normalization and result deduplication strategies
- Performance optimization recommendations

### **Phase 2: Core Service Implementation (2-3 days)**
**Subtask**: DEVFLOW-P2-SEARCH-SERVICE-002C  
**Owner**: Synthetic_Code (Qwen3-Coder-480B)
- SemanticSearchService with hybrid search capabilities
- Integration layer connecting SearchService + VectorEmbeddingService
- Configuration system with intelligent defaults

### **Phase 3: Real-time Indexing (1 day)**
**Subtask**: DEVFLOW-P2-SEARCH-INDEXING-002D
**Owner**: Synthetic_Code (Qwen3-Coder-480B)  
- Auto-indexing hooks in SQLiteMemoryManager.storeMemoryBlock()
- Background processing for large-scale re-indexing
- Error handling and retry logic

---

## 🔍 Integration Points

### **SearchService Extension**
```typescript
// Extend existing SearchService with hybrid capabilities
export class SearchService {
  constructor(private db: Database.Database) {}
  
  // Existing methods (backward compatible)
  fullText(query: string, limit = 20): MemoryBlock[]
  semantic(query: string, options: SemanticSearchOptions = {}): SemanticSearchResult[]
  
  // New hybrid search methods
  async hybridSearch(query: string, options: HybridSearchOptions = {}): Promise<HybridSearchResult[]>
  async intelligentSearch(query: string, options: IntelligentSearchOptions = {}): Promise<HybridSearchResult[]>
}
```

### **Database Schema Extensions**  
```sql
-- No schema changes required! Current schema already supports:
-- 1. memory_blocks.embedding BLOB for vector storage  
-- 2. memory_fts virtual table for FTS5 keyword search
-- 3. Automatic triggers for FTS5 maintenance

-- Optional performance indexes (if needed)
CREATE INDEX IF NOT EXISTS idx_memory_embedding_model ON memory_blocks(embedding_model);
CREATE INDEX IF NOT EXISTS idx_memory_blocks_compound ON memory_blocks(block_type, importance_score DESC, created_at);
```

---

## ✅ Backward Compatibility

### **Guaranteed Compatibility**
- **Existing SearchService.fullText()**: No changes, maintains exact same behavior
- **Existing SearchService.semantic()**: Enhanced to use real semantic search instead of placeholder  
- **Database schema**: No breaking changes, only performance enhancements
- **Memory block storage**: Fully compatible, automatic embedding generation

### **Migration Strategy**  
```typescript
// Seamless upgrade path
class SearchService {
  // Phase 1: Existing methods enhanced internally
  semantic(query: string, options: SemanticSearchOptions = {}): SemanticSearchResult[] {
    // NOW: Uses real SemanticSearchService instead of placeholder
    return this.semanticSearchService.hybridSearch(query, { mode: 'vector-only', ...options })
  }
  
  // Phase 2: New methods available
  hybridSearch(query: string, options: HybridSearchOptions = {}): Promise<HybridSearchResult[]> {
    // NEW: Full hybrid capabilities
  }
}
```

---

## 📋 Implementation Checklist

### **Architecture Phase (Complete ✅)**
- [x] **Current system analysis**: FTS5 + Vector service capabilities mapped  
- [x] **Integration points identified**: SearchService, VectorEmbeddingService, SQLiteMemoryManager
- [x] **API contract defined**: HybridSearchOptions, HybridSearchResult, configuration interfaces
- [x] **Performance requirements**: <200ms hybrid search, >90% accuracy improvement
- [x] **Backward compatibility**: Zero breaking changes, seamless upgrade path

### **Next Phase: Algorithm Design**  
**Subtask**: DEVFLOW-P2-SEARCH-ALGO-002B  
**Owner**: Synthetic_Reasoning (DeepSeek-V3)
- [ ] **Hybrid ranking algorithm**: Weighted, harmonic, geometric fusion methods
- [ ] **Score normalization**: BM25 + cosine similarity to [0,1] range  
- [ ] **Result deduplication**: Handle overlapping FTS5/vector results
- [ ] **Performance optimization**: Minimize computational overhead

---

**Status**: ✅ **ARCHITECTURE DESIGN COMPLETE**  
**Next Step**: Delegate DEVFLOW-P2-SEARCH-ALGO-002B to Synthetic_Reasoning  
**Target**: Production-ready hybrid semantic search in 7 days

---

*DevFlow Phase 2 - Advanced Intelligence Implementation*  
*Architecture designed by Claude Code - 2025-09-09*