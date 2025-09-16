---
task: h-devflow-v3_1-core-ux
branch: feature/devflow-v3_1-core-ux
status: in-progress
created: 2025-09-14
modules: [core, ui, session-management, mcp-integration, cli-tools]
---

# DevFlow v3.1 - Phase 1: Core Stability & UX

## Description
Implement the four critical foundational features for DevFlow v3.1 to enhance core stability, user experience, and system integration. This phase focuses on solving session continuity issues, improving user interface feedback, and expanding the AI agent ecosystem with cutting-edge tools.

## Success Criteria
- [ ] **Smart Session Retry:** Automatic Claude Code session recovery with "riprendi da dove abbiamo interrotto" functionality
- [ ] **Custom Footer System:** Real-time monitoring footer showing model, limits, context, and task hierarchy
- [ ] **Context7 MCP Integration:** Up-to-date documentation system integrated and functional
- [ ] **Qwen Code CLI Integration:** Fourth AI agent (Qwen3-Coder-480B) integrated with MCP and DevFlow workflow

## Implementation Plan

### **Micro-Task 1: Smart Session Retry System** (5-7 giorni)
**Synthetic Agent Assignment: Reasoning Agent (DeepSeek V3)**
- **DEVFLOW31-001** (2 giorni): Session monitoring system with SQLite tracking
- **DEVFLOW31-002** (2 giorni): Rolling window detection and timer management
- **DEVFLOW31-003** (2 giorni): Auto-resume functionality with semantic memory integration
- **DEVFLOW31-004** (1 giorno): Command `daic resume` implementation and testing

### **Micro-Task 2: Custom Footer System** (3-4 giorni)
**Synthetic Agent Assignment: Code Agent (Qwen 2.5 Coder)**
- **DEVFLOW31-005** (1 giorno): Remove existing cc-sessions footer system
- **DEVFLOW31-006** (2 giorni): Implement new footer with real-time model/limits/context tracking
- **DEVFLOW31-007** (1 giorno): Task hierarchy display integration (Progetto→Macro→Micro)

### **Micro-Task 3: Context7 MCP Integration** (2 giorni)
**Synthetic Agent Assignment: Code Agent (Qwen 2.5 Coder)**
- **DEVFLOW31-008** (1 giorno): Install and configure Context7 MCP server
- **DEVFLOW31-009** (1 giorno): Integration testing and validation with DevFlow workflow

### **Micro-Task 4: Qwen Code CLI Integration** (4-5 giorni)
**Synthetic Agent Assignment: Code Agent (Qwen 2.5 Coder) + Auto Agent**
- **DEVFLOW31-010** (1 giorno): Install Qwen Code CLI globally with npm
- **DEVFLOW31-011** (2 giorni): Configure default model `Qwen3-Coder-480B-A35B-Instruct`
- **DEVFLOW31-012** (2 giorni): MCP server integration with DevFlow orchestrator
- **DEVFLOW31-013** (1 giorno): Fallback chain implementation (Claude→Codex→Gemini→Qwen3)

## Technical Implementation Details

### Smart Session Retry Architecture
```typescript
interface SessionMonitor {
  trackSessionStart(): Promise<void>;
  detectLimitReached(message: string): boolean;
  scheduleAutoResume(resumeTime: Date): Promise<void>;
  executeResume(): Promise<void>;
}
```

**Rolling Window Logic**:
- Monitor messaggi Claude Code per pattern "5-hour limit reached"
- Parse timestamp di scadenza dal messaggio
- Schedula auto-resume con comando "riprendi da dove abbiamo interrotto"
- Integra con semantic memory per recovery contesto completo

### Custom Footer Design
```
🧠 Sonnet-4 | 🔥 47/60 calls | 📊 23% ctx | 📋 DevFlow→v3.1-Core-UX→Session-Retry
```

**Elementi Monitorati**:
- **Modello Attivo**: Claude/Codex/Gemini/Qwen3 con fallback indication
- **Limiti Chiamate**: Current/Max calls nella finestra 5 ore
- **Context Percentage**: Pre-compressione warning (>80% = alert)
- **Task Hierarchy**: Progetto→Macro-Task→Micro-Task attuale

### Context7 MCP Configuration
```bash
# Installation command
claude mcp add context7 -- npx -y @upstash/context7-mcp@latest

# Usage integration
"use context7" → automatic latest docs injection
```

### Qwen Code CLI Setup
```bash
# Global installation
npm install -g @qwen-code/qwen-code

# Model configuration (OBBLIGATORIO)
qwen -m Qwen3-Coder-480B-A35B-Instruct

# MCP server integration
devflow_orchestrator.addAgent('qwen', QwenCodeAgent)
```

## Synthetic API Batching Strategy

### **Batch 1: Session Management (DEVFLOW31-001 to 004)**
**Justification**: Strettamente correlati, condividono database schema e monitoring logic
**Estimated API Calls**: 15-20 (complex reasoning + implementation)

### **Batch 2: Footer System (DEVFLOW31-005 to 007)**
**Justification**: UI components, shared styling e real-time update logic
**Estimated API Calls**: 10-15 (UI implementation focused)

### **Batch 3: Context7 + Qwen CLI (DEVFLOW31-008 to 013)**
**Justification**: External integrations, installation procedures, configuration management
**Estimated API Calls**: 12-18 (integration and configuration)

**Total Estimated API Usage**: 37-53 chiamate (well within 135/5h limit)

## Deliverables
- Functional Smart Session Retry system with automatic recovery
- Real-time monitoring footer replacing cc-sessions footer
- Context7 MCP server operational with documentation injection
- Qwen Code CLI integrated as fourth AI agent in DevFlow workflow
- Complete testing suite validating all Phase 1 functionality
- Updated documentation for new DevFlow v3.1 core features

## Risk Mitigation
- **Session Timing**: Extensive testing con different Claude Code usage patterns
- **Footer Performance**: Real-time updates without performance degradation
- **MCP Integration**: Fallback mechanisms se Context7 server unavailable
- **CLI Configuration**: Automatic model selection validation per Qwen Code

## Context Manifest

### Current DevFlow Architecture for v3.1 Integration

The DevFlow system currently operates through a sophisticated multi-layer architecture built around the DevFlow Orchestrator that coordinates four core services: TaskHierarchyService (SQLite-based task management), SemanticMemoryService (vector embeddings and similarity search), MemoryBridgeService (context injection/harvesting protocols), and SyntheticApiClient (rate-limited API integration). This foundation provides the perfect base for v3.1 enhancements.

**Session Management Current State**:
The system already maintains session state through SQLite database persistence and memory block storage, with cross-session reconstruction capabilities through TaskHierarchyService. The Smart Session Retry will extend this by adding real-time monitoring of Claude Code session windows and automatic recovery protocols when limits are reached.

**UI and Feedback Systems**:
Currently, DevFlow operates primarily as a backend orchestration system without direct user interface components. The custom footer system will be the first major UI enhancement, requiring integration with existing cc-sessions infrastructure while providing real-time monitoring of system state, API limits, and task progression.

**MCP Integration Architecture**:
The system already supports MCP (Model Context Protocol) integration through the synthetic MCP server components. Context7 integration will extend this existing MCP framework by adding documentation injection capabilities that complement the current semantic memory and context management systems.

**Multi-Agent Orchestration**:
DevFlow currently orchestrates three primary agents: Claude Code (primary), Synthetic API agents (Code/Reasoning/Context), and various MCP-based services. The Qwen Code CLI integration will add a fourth specialized agent focused on code architecture review and analysis, requiring extension of the existing agent coordination protocols.

### Smart Session Retry Technical Requirements

**Rolling Window Detection**:
Claude Code operates on a 5-hour rolling window that resets based on message timing. The Smart Session Retry must parse Claude Code limit messages to extract exact timing information, schedule automatic retry attempts, and coordinate with DevFlow's semantic memory system to provide context continuity across session breaks.

**Implementation Integration Points**:
- SQLite database extensions for session timing tracking
- Message parsing and pattern recognition for limit detection
- Scheduler integration with DevFlow orchestrator lifecycle
- Semantic memory bridge protocols for context restoration
- Integration with existing task hierarchy for seamless resumption

### Footer System Architecture Requirements

**Real-time Monitoring Integration**:
The new footer system must integrate with DevFlow's existing monitoring infrastructure while providing real-time updates on model selection (based on fallback chain), API limit tracking (synchronized with SyntheticApiClient rate limiting), context window utilization, and current task hierarchy position.

**cc-sessions Footer Replacement**:
The current footer provides basic context information but lacks integration with DevFlow's sophisticated task management and AI orchestration systems. The new footer will provide comprehensive system state visibility while maintaining performance and avoiding interference with Claude Code's native interface.

### Context7 MCP Integration Strategy

**Documentation Enhancement**:
Context7 provides up-to-date, version-specific documentation injection that will complement DevFlow's existing semantic memory system. While semantic memory provides learned context from previous development sessions, Context7 will provide current, authoritative documentation for libraries and frameworks being used.

**MCP Server Coordination**:
Integration will extend DevFlow's existing MCP server management to include Context7 as a documentation provider, with fallback mechanisms if the service is unavailable and integration with the semantic memory system for documentation caching and relevance scoring.

### Qwen Code CLI Integration Architecture

**Fourth Agent Integration**:
Qwen Code CLI will serve as a specialized code architecture review agent, utilizing the Qwen3-Coder-480B-A35B-Instruct model with its 256k context window for comprehensive code analysis. This agent will integrate with DevFlow's existing agent coordination protocols while providing specialized capabilities for code review, architecture analysis, and implementation validation.

**Fallback Chain Extension**:
The integration will extend DevFlow's current agent fallback system to include Qwen3 as the fourth option: Claude Code (primary) → Codex (structured coding) → Gemini (integration testing) → Qwen3 (architecture review). This provides comprehensive coverage of different coding specializations while maintaining system reliability through redundancy.

## Notes
- All integrations must maintain backward compatibility with existing DevFlow functionality
- API usage optimization through batching is critical for staying within Synthetic limits
- Real-world testing required after each micro-task completion
- Documentation updates required for all new functionality
- Performance monitoring essential for footer real-time updates

## Work Log

### 2025-09-14 17:30-18:00 - Macro-Task Creation and Planning
**Task Structure Established**: High-priority macro-task created for DevFlow v3.1 Phase 1
**Micro-Task Breakdown**: 13 specific micro-tasks defined with clear Synthetic agent assignments
**Batching Strategy**: Three optimized batches identified for API efficiency (37-53 total calls)
**Technical Architecture**: Comprehensive implementation plan with integration points defined
**Next Step**: Begin implementation with DEVFLOW31-001 (Session Monitoring System)

### 2025-09-14 20:00-20:15 - Architectural Pivot: Reverse Integration
**Problem Identified**: Codex and Gemini integration within Claude Code sessions proved problematic
**Strategic Solution**: Reversed architecture - External AI agents (Codex/Gemini) consume DevFlow services as clients
**Technical Approach**: DevFlow Orchestrator API exposes all services (Synthetic agents, semantic memory, task management)
**Implementation**: Complete reverse integration architecture with comprehensive SDK and testing

**Deliverables Completed**:
- **DevFlow Orchestrator API**: Complete REST API with Express.js, WebSocket support, authentication, rate limiting
- **Codex Client SDK**: TypeScript SDK with async operations, caching, WebSocket real-time updates, error handling
- **Gemini Client SDK**: Python SDK optimized for Google AI models, multimodal support, advanced caching
- **Integration Testing**: Comprehensive test suite with mock servers, Docker environment, performance benchmarks
- **Client-Server Architecture**: External agents access DevFlow services through standardized APIs

**Key Benefits Achieved**:
1. **Decoupling**: External AIs independent of DevFlow internals - eliminates session integration complexity
2. **Scalability**: New AI agents integrate via API contracts - no internal modifications required
3. **Reliability**: Centralized DevFlow services with redundant client access patterns
4. **Flexibility**: Specialized AI agents (Codex for code, Gemini for analysis) with optimized interactions

**Architecture Summary**:
- DevFlow Orchestrator exposes unified API (Synthetic agents, semantic memory, tasks, sessions)
- Codex SDK provides TypeScript client with enterprise-grade features (retry, caching, WebSocket)
- Gemini SDK provides Python client with AI-specific optimizations (streaming, multimodal)
- Complete test coverage with Docker-based environment and performance validation

**Next Phase**: Deploy and validate reverse integration in production environment

### 2025-09-15 - MCP Synthetic Server Database Integration
**Issue Addressed**: Inconsistent responses from MCP Synthetic Server due to stateless architecture.
**Solution Implemented**:
- Integrated MCP Synthetic Server with DevFlow's unified SQLite database (Cometa).
- Modified `handleReasoning` to query database for task status, falling back to AI model if no data found.
**Impact**: MCP Synthetic Server now provides consistent and reliable task status information from the central memory system.