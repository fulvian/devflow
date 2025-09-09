# CODEX TASK 2A: Claude Code Adapter Implementation

## Context & Objective
Implementare l'adapter per Claude Code che si integra con cc-sessions hooks per salvare e ripristinare contesto automaticamente. Questo componente sarà il bridge tra il core memory system (CODEX-1B) e Claude Code sessions, abilitando memoria persistente trasparente.

**Sprint 2 Focus**: cc-sessions hooks integration + automatic context management

## Technical Requirements

### cc-sessions Integration
- **Hook System Integration**: Intercettare eventi di cc-sessions lifecycle
- **Context Extraction**: Automatico context saving da `.claude/context/` directory
- **Tool Usage Tracking**: Monitor tool calls per context update triggers
- **Session Lifecycle**: Hook su session start/end per context injection/persistence
- **File System Watching**: Monitor filesystem changes per real-time context updates

### Context Management System
- **Automatic Context Saving**: Save context dopo ogni tool usage significativo
- **Context Injection**: Restore context all'inizio di nuove sessions
- **Important Information Detection**: Identificare architectural decisions e key information
- **Context Compaction**: Utilizzare il memory system per compaction quando necessario
- **Memory Threshold Management**: Gestire context size limits intelligentemente

### Integration Architecture
- **Core Memory System**: Utilizzare SQLite memory system da CODEX-1B
- **cc-sessions Compatibility**: Rispettare existing cc-sessions workflows
- **Non-intrusive Design**: Non interferire con normal Claude Code operations
- **Error Resilience**: Graceful degradation se memory system non disponibile
- **Performance**: Context operations <100ms per non impattare user experience

## Implementation Guidelines

### Code Quality Standards
- **TypeScript strict mode** compliance al 100%
- **Integration testing** con mock cc-sessions environment  
- **Error handling robusto** con fallback mechanisms
- **Structured logging** per debugging e monitoring
- **Unit tests** per ogni component (target 90% coverage)
- **Filesystem operation safety** con proper error handling

### Hook Implementation Patterns
- **Filesystem watchers**: Utilizzare Node.js fs.watch per monitoring
- **Debouncing**: Prevent excessive context saves con debouncing logic
- **Event queuing**: Queue context operations per avoid race conditions
- **State management**: Track session state e context changes
- **Configuration**: Environment-based config per different setups

### Architecture Integration
- **Memory Manager**: Utilizzare SQLiteMemoryManager da @devflow/core
- **Context Serialization**: Serialize/deserialize context data efficiently
- **Hook Registration**: Register hooks con cc-sessions lifecycle events
- **Error Boundaries**: Isolate errors per non break Claude Code functionality
- **Logging Integration**: Integrate con existing DevFlow logging system

## Expected Deliverables

### Core Implementation Files
```
packages/adapters/claude-code/src/
├── adapter.ts                 # Main Claude Code adapter
├── hooks/
│   ├── session-hooks.ts       # Session lifecycle hooks
│   ├── tool-hooks.ts          # Tool usage monitoring hooks
│   ├── context-hooks.ts       # Context file monitoring
│   └── index.ts               # Hook registration system
├── context/
│   ├── manager.ts             # Context management orchestrator
│   ├── extractor.ts           # Context extraction from .claude/
│   ├── injector.ts            # Context injection into sessions
│   └── detector.ts            # Important information detection
├── filesystem/
│   ├── watcher.ts             # File system change monitoring
│   ├── debouncer.ts           # Debouncing utilities
│   └── safe-ops.ts            # Safe filesystem operations
└── index.ts                   # Main package exports
```

### Integration Components
- **Hook Integration**: Seamless integration con cc-sessions hook system
- **Context Pipeline**: Extract → Analyze → Store → Retrieve → Inject workflow
- **Configuration System**: Environment variables e config file support
- **Error Handling**: Comprehensive error scenarios con graceful fallbacks
- **Performance Monitoring**: Context operation timing e metrics

### Testing Suite
- **Unit Tests**: Ogni component con comprehensive coverage
- **Integration Tests**: Mock cc-sessions environment testing
- **Filesystem Tests**: File watching e context extraction validation
- **Performance Tests**: Context operation timing benchmarks
- **Error Scenario Tests**: Failure modes e recovery testing

### Documentation & Setup
- **Setup Guide**: Step-by-step integration con existing Claude Code
- **Configuration Reference**: All environment variables e settings
- **Hook Documentation**: How hooks integrate con cc-sessions
- **Troubleshooting Guide**: Common issues e debug procedures
- **Usage Examples**: Real-world usage patterns e workflows

## Success Criteria

### Functional Requirements
- [ ] **cc-sessions Integration**: Successfully hooks into session lifecycle events
- [ ] **Context Extraction**: Automatic context saving from `.claude/context/` directory
- [ ] **Context Injection**: Automatic context restore all'inizio di sessions
- [ ] **Tool Usage Tracking**: Monitor e respond to tool calls per context updates
- [ ] **Important Info Detection**: Identify e prioritize architectural decisions
- [ ] **Memory Integration**: Successful integration con core SQLite memory system
- [ ] **Non-intrusive Operation**: No interference con normal Claude Code workflows

### Technical Validation
- [ ] **Build Success**: `pnpm build` completes without errors
- [ ] **Type Check**: `pnpm type-check` passes completely  
- [ ] **Lint Check**: `pnpm lint` passes with zero errors
- [ ] **Unit Tests**: >90% test coverage achieved
- [ ] **Integration Tests**: Full cc-sessions integration workflow tested
- [ ] **Performance**: Context operations complete <100ms

### Integration Readiness
- [ ] **Hook Registration**: Properly registers con cc-sessions lifecycle
- [ ] **Error Resilience**: Graceful handling of all error scenarios
- [ ] **Configuration**: Complete setup e configuration system
- [ ] **Documentation**: Setup guide e usage documentation complete
- [ ] **OpenRouter Ready**: Prepared for handoff to OpenRouter integration

## Technical Context

### cc-sessions Hook System
Il sistema di hook di cc-sessions permette integration points per:
- Session start/end events
- Tool usage monitoring
- Context file changes
- State transitions

### Memory System Integration
Utilizzare il memory system da CODEX-1B:
- `SQLiteMemoryManager` per persistence
- Context compaction strategies quando necessario
- Search capabilities per context retrieval
- Session e memory block management

### Context Directory Structure
Typical `.claude/context/` structure:
```
.claude/
├── context/
│   ├── current_session.json
│   ├── tool_usage.log
│   └── memory_blocks/
└── state/
    ├── current_task.json
    └── session_state.json
```

## Performance Requirements

### Context Operations Timing
- **Context Extraction**: <50ms per context save
- **Context Injection**: <100ms per session start
- **File System Watching**: <10ms response to file changes
- **Memory Operations**: <200ms per memory system interaction
- **Hook Processing**: <20ms per hook event

### Resource Usage
- **Memory Footprint**: <50MB additional memory usage
- **CPU Usage**: <5% additional CPU during active operations
- **Disk I/O**: Efficient batching per minimize filesystem operations
- **Network**: No network usage (local filesystem only)

## Report Template

Al completamento, fornire report strutturato con:

### Implementation Summary
- Components implementati con integration points
- Hook system implementation details
- Context management workflow description
- Performance optimization techniques applied

### Integration Results
- cc-sessions hook integration validation
- Context extraction/injection test results
- Memory system integration verification
- Error handling scenario results

### Testing Coverage
- Unit test coverage percentages
- Integration test scenarios validated
- Performance benchmark results
- Error resilience test outcomes

### Next Steps Recommendations
- OpenRouter gateway integration preparation (CODEX-3A)
- Performance optimization opportunities
- Additional hook points che potrebbero essere beneficial
- Documentation improvements needed

### Memory Context for Persistence
JSON object con implementation context:
```json
{
  "task": "CODEX-2A",
  "component": "claude-code-adapter", 
  "integration_points": ["cc-sessions", "core-memory-system"],
  "key_features": ["context-extraction", "context-injection", "hook-integration"],
  "performance_metrics": {"context_ops": "times", "hook_latency": "ms"},
  "next_integration": "openrouter-gateway"
}
```

---

**Target Completion**: 3-4 giorni di focused implementation  
**Dependencies**: CODEX-1B core memory system (✅ Complete)
**Next Task**: CODEX-3A OpenRouter Gateway Integration