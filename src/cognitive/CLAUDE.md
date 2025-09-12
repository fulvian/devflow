# Cognitive Engine Service

## Purpose
Provides high-level cognitive orchestration interfaces and session management for DevFlow's intelligent task processing and memory integration.

## Narrative Summary
This service acts as the top-level orchestrator for DevFlow's cognitive capabilities, providing unified interfaces to the underlying task hierarchy, semantic memory, and memory bridge services. It manages cognitive sessions, coordinates between different cognitive subsystems, and provides simplified APIs for cognitive operations.

## Key Files
- `index.ts` - Main cognitive engine exports and initialization (cognitive/index.ts:1-1799)
- `interfaces.ts` - Core cognitive interfaces and type definitions (cognitive/interfaces.ts:1-2197)
- `memory-core.ts` - Memory management core functionality (cognitive/memory-core.ts:1-6053)
- `session-manager.ts` - Cognitive session lifecycle management (cognitive/session-manager.ts:1-4634)
- `types.ts` - Cognitive system type definitions (cognitive/types.ts:1-2801)

## Core Components
### Session Management
- Cognitive session lifecycle coordination
- Session state persistence and recovery
- Multi-session context isolation
- Session-based memory scoping

### Memory Integration
- Unified interface to semantic memory services
- Task hierarchy navigation
- Memory bridge protocol coordination
- Context compression and optimization

### Cognitive Mapping
- Intelligent task routing and platform selection
- Capability-based task assignment
- Context-aware decision making
- Cognitive load balancing

## Integration Points
### Consumes
- TaskHierarchyService: Task management and hierarchy navigation
- SemanticMemoryService: Vector-based task similarity and search
- MemoryBridgeService: Agent context injection and harvesting
- SyntheticApiClient: External agent coordination

### Provides
- Unified cognitive operations API
- Session management for cognitive workflows
- High-level task processing orchestration
- Cognitive context management
- Memory consolidation and retrieval

## Configuration
- Session persistence: SQLite-based session storage
- Memory integration: Configurable embedding models
- Cognitive parameters: Adjustable processing thresholds
- Platform routing: Multi-platform agent coordination

## Key Patterns
- Facade pattern for cognitive subsystem coordination
- Session-based context isolation
- Event-driven cognitive processing
- Lazy initialization of cognitive components
- Unified error handling across cognitive operations

## Related Documentation
- `../core/task-hierarchy/CLAUDE.md` - Foundation task management
- `../core/semantic-memory/CLAUDE.md` - Vector-based memory operations
- `../core/memory-bridge/CLAUDE.md` - Agent-memory integration
- `../core/synthetic-api/CLAUDE.md` - External agent coordination