# CCR Context Bridge Service CLAUDE.md

## Purpose
Provides intelligent context management and bridging between Claude Code sessions and external AI platforms with fallback orchestration.

## Narrative Summary
The CCR Context Bridge Service manages context flow between Claude Code sessions and external AI platforms through sophisticated session management, context compression, and fallback orchestration. It handles token budget enforcement, cross-session memory persistence, and provides seamless fallback to direct API calls when synthetic platforms are unavailable. The service maintains conversation continuity while optimizing token usage through smart compression and advanced context management.

## Key Files
- `context-bridge.ts:25-161` - Main bridge orchestrating context flow and API calls
- `advanced-context-manager.ts:5-88` - Context window optimization with relevance scoring
- `compression-optimizer.ts` - Smart compression algorithms for context reduction
- `cross-session-memory.ts` - Persistent memory across Claude Code sessions
- `session-manager.ts:4-50` - Session lifecycle and context persistence
- `smart-compression.ts` - Intelligent context compression strategies
- `ccr-router-enhanced.ts` - Enhanced routing with fallback capabilities

## Core Components

### CCRContextBridge (context-bridge.ts:25-161)
- **Purpose**: Central orchestrator for context flow and API integration
- **Key Features**:
  - Session ID generation and validation
  - Token budget enforcement with smart compression
  - MCP integration for context preparation
  - Fallback orchestration to direct API calls
  - Redis-based session persistence
- **Integration**: Uses TaskHierarchyService, SemanticMemoryService, ContextCompressor

### AdvancedContextManager (advanced-context-manager.ts:5-88)
- **Purpose**: Advanced context window management with optimization
- **Key Features**:
  - Sliding window approach with configurable length limits
  - Relevance scoring for context entry prioritization
  - Context pruning based on relevance and recency
  - Cross-session state persistence
- **Algorithm**: Weighted relevance scoring combining recency and content type factors

### CompressionOptimizer (compression-optimizer.ts)
- **Purpose**: Intelligent compression algorithms for context reduction
- **Features**: Multi-strategy compression, semantic preservation, token optimization

### CrossSessionMemory (cross-session-memory.ts)
- **Purpose**: Persistent memory management across Claude Code sessions
- **Features**: State serialization, memory retrieval, cross-session continuity

### SessionManager (session-manager.ts:4-50)
- **Purpose**: Session lifecycle management and context persistence
- **Features**: Redis-based storage, TTL management, context serialization

### SmartCompression (smart-compression.ts)
- **Purpose**: Context compression with preservation of important information
- **Features**: Intelligent content selection, token budget adherence

### CCREnhancedRouter (ccr-router-enhanced.ts)
- **Purpose**: Enhanced routing with sophisticated fallback capabilities
- **Features**: Multi-tier fallback strategies, performance monitoring

## API Endpoints
- `processRequest(prompt, sessionId?)` - Main context processing endpoint
- `cleanupSession(sessionId)` - Session cleanup and resource deallocation

## Integration Points
### Consumes
- Redis: Session and context persistence
- MCP Core Services: TaskHierarchy, SemanticMemory, ContextCompressor
- Synthetic API: Primary AI platform integration
- Direct API: Fallback AI service calls

### Provides
- Context bridging between Claude Code and external AI platforms
- Session management with persistent memory
- Token budget enforcement and optimization
- Fallback orchestration for high availability
- Performance metrics and monitoring data

## Configuration
Required environment variables:
- `REDIS_URL` - Redis connection for session persistence
- `SESSION_TTL` - Session time-to-live configuration
- `TOKEN_BUDGET` - Maximum token limits per session
- `ENABLE_COMPRESSION` - Toggle for smart compression features
- Platform endpoint configurations for API integrations

## Key Patterns
- Session-based context management with Redis persistence
- Token budget enforcement with smart compression fallback
- Multi-tier fallback strategy (Synthetic → Direct API)
- Relevance-based context pruning algorithms
- Cross-session memory persistence for continuity
- Event-driven logging and monitoring

## Related Documentation
- MCP Core Services integration guides
- Redis session management patterns
- Token optimization strategies
- Fallback orchestration protocols
- Context compression algorithms