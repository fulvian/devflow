# Task Hierarchy Management Service

## Purpose
Provides production SQLite-based CRUD operations for cognitive task contexts, supporting hierarchical task organization with temporal consistency validation and transaction management.

## Narrative Summary
This service replaces in-memory task management with persistent SQLite storage, implementing the foundation for DevFlow's cognitive task system. It supports parent-child task relationships, comprehensive metadata storage, and temporal consistency validation. The implementation includes full CRUD operations, transaction support, and hierarchical queries for building task trees.

## Key Files
- `task-hierarchy-service.ts` - Main service with SQLite implementation and CRUD operations
- `task-types.ts` - TypeScript interfaces and enums for task management
- Database schema in `task_contexts` table

## Database Schema
### task_contexts Table
- `id`: TEXT (Primary Key, auto-generated)
- `parent_id`: TEXT (References task_contexts.id)
- `title`, `description`: Task content
- `status`: TaskStatus enum (planning, active, blocked, completed, archived)
- `priority`: TaskPriority enum (h-, m-, l-, ?-)
- `complexity_score`, `estimated_duration_minutes`: Numeric planning fields
- `required_capabilities`: JSON array of capability strings
- `primary_platform`: Platform enum (claude_code, openai_codex, gemini_cli, cursor)
- `platform_routing`: JSON object for platform-specific routing
- Context fields: `architectural_context`, `implementation_context`, `debugging_context`, `maintenance_context`
- Claude Code integration: `cc_session_id`, `cc_task_file`, `branch_name`
- Relationships: `parent_task_id`, `depends_on` (JSON array)
- Timestamps: `created_at`, `updated_at`, `completed_at`

## Core Operations
### CRUD Operations
- `createTask()`: Insert with parent validation and JSON serialization (task-hierarchy-service.ts:165-231)
- `getTaskById()`: Single task retrieval with row mapping (task-hierarchy-service.ts:236-255)
- `updateTask()`: Dynamic field updates with timestamp management (task-hierarchy-service.ts:260-354)
- `deleteTask()`: Deletion with child task validation (task-hierarchy-service.ts:359-391)

### Hierarchical Queries
- `getChildTasks()`: Direct children with creation order (task-hierarchy-service.ts:396-420)
- `getRootTasks()`: Tasks without parents (task-hierarchy-service.ts:425-439)
- `getTaskHierarchy()`: Full tree traversal with recursion (task-hierarchy-service.ts:444-477)
- `getTaskTree()`: Recursive descent for subtrees (task-hierarchy-service.ts:482-496)

## Integration Points
### Consumes
- SQLite database: Persistent storage with foreign key constraints
- Configuration: Database path (default: './devflow.sqlite')

### Provides
- TaskContext CRUD operations
- Hierarchical task navigation
- Transaction management via `executeInTransaction()`
- Temporal consistency validation
- Row-to-object mapping with JSON deserialization

## Configuration
- Database file path: Configurable (default: './devflow.sqlite')
- Foreign key constraints: Enabled for referential integrity
- Transaction support: Available for complex operations

## Key Patterns
- Database initialization with pragma settings (task-hierarchy-service.ts:138-150)
- Dynamic SQL generation for updates (task-hierarchy-service.ts:276-339)
- JSON serialization for complex fields (task-hierarchy-service.ts:200-211)
- Row mapping with type safety (task-hierarchy-service.ts:557-582)
- Recursive tree traversal (task-hierarchy-service.ts:482-496)
- Transaction wrapper for atomic operations (task-hierarchy-service.ts:536-552)
- Temporal consistency validation (task-hierarchy-service.ts:501-531)

## Error Handling
- `TaskNotFoundError`: Task ID validation
- `TaskHierarchyError`: Parent-child relationship violations
- `DatabaseError`: SQLite operation failures
- Transaction rollback on operation failures

## Related Documentation
- `../semantic-memory/CLAUDE.md` - Embedding generation for tasks
- `../memory-bridge/CLAUDE.md` - Context injection protocols
- Database migration scripts in project setup