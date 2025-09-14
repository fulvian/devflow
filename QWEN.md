# DevFlow Cognitive Task+Memory System - Project Context

## Project Overview

DevFlow is a sophisticated cognitive computing framework built with TypeScript that provides intelligent task management and persistent memory systems. The project implements a structured approach to handling cognitive workloads with built-in memory persistence, semantic search capabilities, and multi-platform AI orchestration.

The system is designed to be a "Universal Development State Manager" that eliminates AI tools "digital amnesia" through persistent memory and intelligent coordination between different AI platforms including Claude Code, OpenAI Codex, Gemini CLI, and Cursor.

## Core Architecture

### Main Components

1. **Task Management System** - Hierarchical task management with priority queuing
2. **Persistent Memory System** - SQLite-based storage with TTL support and vector embeddings
3. **Semantic Search Engine** - Hybrid vector and keyword search capabilities
4. **Multi-Platform Orchestration** - Intelligent routing between AI platforms
5. **Event-Driven Architecture** - Comprehensive event system for monitoring and extension

### Key Directories

```
devflow/
├── src/                    # Main source code
│   ├── cognitive/         # Core cognitive system components
│   ├── core/              # Core system modules
│   │   ├── database/      # Database schema and connection management
│   │   ├── orchestration/ # Multi-agent routing and delegation
│   │   ├── semantic-memory/ # Vector embeddings and semantic search
│   │   ├── task-hierarchy/ # Task management system
│   │   └── embeddings/    # Embedding model integrations
│   ├── test/              # Test suites and integration tests
│   └── utils/             # Utility functions
├── packages/              # Monorepo packages for modular components
├── mcp-servers/           # Model Context Protocol server implementations
├── docs/                  # Documentation and guides
├── configs/               # Configuration files
└── scripts/               # Utility scripts
```

## Key Technologies

- **TypeScript** - Primary language with full type safety
- **Node.js** - Runtime environment
- **SQLite** - Primary database for persistence
- **Vector Embeddings** - Semantic search capabilities
- **Model Context Protocol (MCP)** - Standardized AI tool integration
- **Jest** - Testing framework

## Building and Running

### Prerequisites
- Node.js 14+
- npm 6+
- TypeScript 4.5+

### Installation
```bash
npm install
```

### Building
```bash
npm run build
```

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run integration tests
npm run test:integration

# Generate coverage report
npm run test:coverage
```

### Development Commands
```bash
# Development with watch mode
npm run dev
```

## Development Conventions

### Code Structure
- **TypeScript Native** - Full type safety and modern ES2020 features
- **Modular Architecture** - Clear separation of concerns
- **Event-Driven** - Extensible through event system
- **Test-First** - Comprehensive test coverage expected

### Configuration
The system uses a flexible configuration approach:
```typescript
interface SystemConfig {
  debug: boolean;        // Enable debug logging
  memoryLimit: number;   // Maximum memory entries
  taskTimeout: number;   // Task execution timeout (ms)
}
```

### Core Classes

1. **DevFlowSystem** - Main system class
   - Manages task creation and execution
   - Handles memory storage and retrieval
   - Provides event system for extensions

2. **TaskHierarchyService** - Task management
   - Hierarchical task organization
   - Status tracking and prioritization
   - SQLite persistence

3. **SemanticMemoryService** - Semantic search
   - Vector embedding generation and storage
   - Similarity search between tasks
   - Integration with embedding models

4. **AgentClassificationEngine** - Multi-platform orchestration
   - Intelligent task routing to appropriate AI agents
   - Usage monitoring and session limit prevention
   - Delegation hierarchy (Sonnet → Codex → Gemini → Synthetic)

## Database Schema

The system uses SQLite with a comprehensive schema including:

- **task_contexts** - Hierarchical task management
- **memory_blocks** - Content storage with metadata
- **memory_block_embeddings** - Vector embeddings for semantic search
- **coordination_sessions** - Cross-platform session tracking
- **platform_performance** - Performance metrics tracking
- **knowledge_entities** - Semantic knowledge graph
- **entity_relationships** - Knowledge entity relationships

## Semantic Search Capabilities

The system implements hybrid semantic search with:

1. **Vector Similarity Search** - Cosine similarity between embeddings
2. **Keyword Search** - Traditional text-based search
3. **Hybrid Ranking** - Combined vector and keyword scoring
4. **Multiple Embedding Models** - Support for different embedding providers

Currently supports:
- Mock embedding models for testing
- Ollama integration with EmbeddingGemma (768 dimensions)
- OpenAI embedding models (1536+ dimensions)

## Multi-Platform Orchestration

DevFlow implements intelligent routing between AI platforms:

- **Claude Code (Sonnet)** - Architecture design and complex reasoning
- **OpenAI Codex** - Code generation and implementation
- **Gemini CLI** - Debugging and testing
- **Synthetic** - Routine tasks and basic coding

The system monitors usage patterns and automatically delegates tasks to prevent session limits while optimizing for platform specializations.

## Current Status

The project is in an advanced development phase with:

- ✅ Core system architecture implemented
- ✅ Task management subsystem complete
- ✅ Memory persistence layer functional
- ✅ Event system implementation complete
- ✅ Semantic search with vector embeddings
- ✅ Multi-platform orchestration engine
- ✅ Database schema with comprehensive indexing
- ✅ Integration tests for core functionality

## Key Files for Understanding the System

1. **`src/index.ts`** - Main entry point and core DevFlowSystem class
2. **`src/core/database/devflow-database.ts`** - Database schema and connection management
3. **`src/core/task-hierarchy/task-hierarchy-service.ts`** - Task management implementation
4. **`src/core/semantic-memory/semantic-memory-service.ts`** - Semantic search and embeddings
5. **`src/core/orchestration/agent-routing-engine.ts`** - Multi-platform routing logic
6. **`src/test/smoke-test-semantic-memory.ts`** - Integration testing examples

## Integration with Claude Code

The system provides full integration with Claude Code sessions through:
- **MCP Tools** - Custom tools for search, handoff, and memory management
- **Context Injection** - Automatic injection of relevant context at session start
- **Memory Capture** - Automatic capture of architectural decisions
- **Platform Handoff** - Seamless transition between AI platforms

## Performance Targets

- **Context Injection**: <500ms
- **Memory Capture**: >95% success rate
- **Handoff Success**: >90% success rate
- **Token Reduction**: 30%+
- **Vector Search**: Sub-second response times

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

The project follows standard TypeScript development practices with comprehensive testing and type safety.