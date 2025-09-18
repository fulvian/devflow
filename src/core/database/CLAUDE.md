# Database Management Service CLAUDE.md

## Purpose
Provides SQLite database schema management with full-text search capabilities and trigger-based automation for DevFlow Phase 1.

## Narrative Summary
The Database Management Service implements a comprehensive SQLite database solution for DevFlow Phase 1, featuring complete schema management, full-text search (FTS) integration, and automated trigger systems. It handles database initialization, schema creation, indexing, and trigger management with conflict resolution for FTS triggers. The service uses sqlite3 for compatibility and includes WAL mode for performance optimization.

## Key Files
- `devflow-database.ts:20-350` - Main database schema manager with FTS trigger fixes

## Core Components

### DevFlowDatabase (devflow-database.ts:20-350)
- **Purpose**: Complete SQLite database schema management with FTS integration
- **Key Features**:
  - SQLite database initialization with WAL mode
  - Complete schema creation for coordination sessions, task contexts, agent interactions
  - Full-text search (FTS) table management with conflict resolution
  - Automated trigger creation for data synchronization
  - Foreign key enforcement and performance optimization
  - Database backup and migration support
- **Schema Components**:
  - Coordination sessions for multi-agent workflows
  - Task contexts with hierarchical relationships
  - Agent interactions and response tracking
  - Memory fragments with semantic relationships
  - Performance metrics and monitoring data

## Database Schema

### Core Tables
- `coordination_sessions` - Multi-agent workflow coordination
- `task_contexts` - Task hierarchy and context management
- `agent_interactions` - Agent communication tracking
- `memory_fragments` - Semantic memory storage
- `performance_metrics` - System performance data

### FTS Integration
- `task_contexts_fts` - Full-text search for task content
- `memory_fragments_fts` - Full-text search for memory content
- Automated FTS synchronization triggers with conflict resolution

## Configuration
Required configuration:
- Database path with automatic directory creation
- WAL mode for concurrent access
- Foreign key enforcement enabled
- Cache size optimization (65536 pages)
- FTS trigger conflict resolution

## Key Patterns
- SQLite WAL mode for performance and concurrency
- Foreign key relationships with cascading operations
- Full-text search integration with automated synchronization
- Trigger-based automation with conflict handling
- Schema versioning and migration support
- Performance optimization with indexing strategies

## Integration Points
### Consumes
- File system: Database file storage and backup
- Configuration: Database path and optimization settings

### Provides
- Complete database schema for DevFlow Phase 1
- Full-text search capabilities
- Data persistence and retrieval
- Performance metrics storage
- Multi-agent coordination data management

## Related Documentation
- SQLite WAL mode configuration
- Full-text search implementation patterns
- Database migration and backup strategies
- Performance optimization guidelines