# Semantic Memory Service

## Purpose
Manages vector embeddings and semantic search capabilities for the DevFlow Cognitive Task+Memory System, enabling similarity-based task discovery and context retrieval.

## Narrative Summary
This service bridges the TaskHierarchy foundation with vector-based semantic search. It generates and stores embeddings for task content, enabling the system to find contextually similar tasks based on semantic meaning rather than just keyword matching. The implementation includes synchronization with task hierarchy changes and batch processing for efficient embedding generation.

## Key Files
- `semantic-memory-service.ts` - Main service with embedding management and similarity search
- `synthetic-embedding-integration.ts` - Production Synthetic API embedding model
- `embedding-model.ts` - Abstract embedding model interface
- `mock-embedding-model.ts` - Testing implementation (semantic-memory-service.ts:375-432)

## Database Integration
### Tables Used
- `memory_block_embeddings`: Stores vector embeddings with metadata
  - `block_id`: References task IDs from task_contexts table
  - `embedding`: Serialized vector data (BLOB format)
  - `model`: Model identifier for embedding generation
  - `dimensions`: Vector dimensionality

## Core Operations
### Embedding Generation
- `generateTaskEmbedding()`: Single task embedding with content extraction (semantic-memory-service.ts:103-143)
- `generateTaskEmbeddings()`: Batch processing with rate limiting (semantic-memory-service.ts:148-160)
- `extractTaskContent()`: Task content preparation for embedding (semantic-memory-service.ts:340-349)

### Similarity Search
- `findSimilarTasks()`: Semantic similarity with configurable threshold (semantic-memory-service.ts:165-230)
- Cosine similarity calculation via registered models
- Results include similarity scores and optional task details

## Integration Points
### Consumes
- TaskHierarchyService: Task content and hierarchy management
- EmbeddingModel implementations: Vector generation and similarity calculation
- SQLite database: Persistent embedding storage

### Provides
- Semantic task search capabilities
- Embedding synchronization with task hierarchy
- Model registration and management
- Vector serialization/deserialization for SQLite storage

## Configuration
- Database path: Configurable SQLite file location (default: './data/devflow_unified.sqlite')
- Batch size: 5 tasks per batch for embedding generation
- Embedding models: Registered via `registerEmbeddingModel()`

## Key Patterns
- Service initialization with database connection (semantic-memory-service.ts:69-80)
- Vector serialization using Float32 buffer format (semantic-memory-service.ts:354-371)
- Hierarchical synchronization with orphan cleanup (semantic-memory-service.ts:257-320)
- Mock model with consistent pseudo-random generation (semantic-memory-service.ts:375-432)

## Related Documentation
- `../task-hierarchy/CLAUDE.md` - Task context management
- `../synthetic-api/CLAUDE.md` - Production embedding generation
- `../memory-bridge/CLAUDE.md` - Context injection protocols