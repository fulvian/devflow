# Memory Bridge Protocol Service

## Purpose
Bridges Synthetic agents with the DevFlow Cognitive Task+Memory System, managing context injection and harvesting with 2000-token budget constraints and compression protocols.

## Narrative Summary
This service implements the critical bridge between external AI agents (via Synthetic API) and DevFlow's internal cognitive memory system. It manages a 2000-token budget for context sharing, applies intelligent compression when approaching limits, and orchestrates the injection/harvesting cycle that enables agents to benefit from historical task context and contribute new learnings back to the system.

## Key Files
- `memory-bridge-service.ts` - Main service orchestrating context injection/harvesting
- `injection-protocol.ts` - Context preparation and injection logic
- `harvesting-protocol.ts` - Memory extraction and storage protocols
- `context-compression.ts` - Token budget management and compression
- `memory-cache.ts` - Temporary context storage and retrieval

## Core Protocols
### Context Injection
- `injectContext()`: Prepares task context with similar tasks for agent consumption (memory-bridge-service.ts:99-169)
- Token budget validation with 2000-token limit
- Compression applied when context exceeds threshold (1800 tokens)
- Similar task retrieval via SemanticMemoryService integration

### Memory Harvesting
- `harvestMemory()`: Extracts and stores agent execution results (memory-bridge-service.ts:174-222)
- Context cleanup and budget restoration
- Memory persistence for future similarity matching
- Token accounting and budget management

## Integration Points
### Consumes
- TaskHierarchyService: Task context retrieval and validation
- SemanticMemoryService: Similar task discovery via embeddings
- Agent execution results: Post-processing outputs

### Provides
- AgentContext objects: Structured context for agent consumption
- MemoryHarvestResult: Processed agent outputs for storage
- Token budget management: 2000-token constraint enforcement
- Context compression: Intelligent reduction when approaching limits

## Budget Management
### Token Accounting
- Maximum budget: 2000 tokens (configurable)
- Token estimation: 4 characters ≈ 1 token (memory-bridge-service.ts:255-281)
- Budget tracking: Current usage and remaining capacity
- Automatic restoration: Tokens returned on memory harvesting

### Compression Strategy
- Compression threshold: 1800 tokens (90% of budget)
- Similar tasks reduction: Remove least similar results (memory-bridge-service.ts:286-295)
- Compressed context format: Truncated titles and essential metadata (memory-bridge-service.ts:300-316)

## Configuration
- Token budget: 2000 tokens (default, configurable)
- Compression threshold: 1800 tokens
- Similar tasks limit: 5 tasks maximum
- Similarity threshold: 0.3 minimum

## Key Patterns
- Budget constraint enforcement with TokenBudgetExceededError
- Context lifecycle management (inject → execute → harvest)
- Intelligent compression with metadata preservation
- Active context tracking per agent-task pair
- Token estimation for budget planning (memory-bridge-service.ts:255-281)

## Error Handling
- `BridgeError`: General bridge operation failures
- `TokenBudgetExceededError`: Budget constraint violations
- Context validation and missing task handling
- Graceful degradation when similarity search fails

## Related Documentation
- `../task-hierarchy/CLAUDE.md` - Task context management
- `../semantic-memory/CLAUDE.md` - Similar task discovery
- `../synthetic-api/CLAUDE.md` - Agent integration protocols
- `../../cognitive/CLAUDE.md` - Cognitive engine interfaces