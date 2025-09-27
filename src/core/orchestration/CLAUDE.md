# Dream Team Orchestration Service CLAUDE.md

## Purpose
Orchestrates intelligent task delegation, multi-model continuous verification, and real-time progress tracking across multiple AI platforms with MCP integration.

## Narrative Summary
The Dream Team Orchestration Service provides sophisticated coordination of tasks across different AI platforms (Qwen, Gemini, Codex, Synthetic) with real MCP (Model Context Protocol) integration replacing previous placeholder implementations. It implements multi-model continuous verification, real-time task progress tracking with footer integration, platform detection, weighted round-robin scheduling, circuit breaker patterns, and both parallel and sequential processing modes. The service ensures optimal resource utilization while maintaining high availability through fallback strategies and production-ready monitoring.

## Key Files
- `dream-team-orchestrator.ts:20-115` - Main orchestrator with real MCP client integration
- `continuous-verifier.ts:7-70` - Multi-model continuous verification system
- `task-progress-tracker.ts:4-83` - Real-time task progress tracking with listener pattern
- `enhanced-continuous-verifier.ts:1-45` - Enhanced verification with Synthetic models
- `enhanced-dream-team-orchestrator.ts:1-150` - Production-ready orchestrator implementation
- `plan-adherence-validator.ts:1-120` - Plan adherence validation system
- `mcp-client.ts:1-200` - WebSocket-based MCP client for model communication
- `platform-detector.ts:25-150` - Multi-platform health monitoring and selection
- `enhanced-resource-manager.ts:24-150` - Token bucket rate limiting and circuit breaker management
- `enhanced-auto-ccr-runner.ts:50-200` - Enhanced CCR fallback orchestration with monitoring

## Core Components

### DreamTeamOrchestrator (dream-team-orchestrator.ts:20-115)
- **Purpose**: Central orchestration with real MCP client integration
- **Key Features**:
  - WebSocket-based MCP communication replacing fake endpoints
  - Circuit breaker pattern for each agent type (Tech Lead, Senior Dev, Doc Manager, QA)
  - Automatic connection/disconnection management
  - Session-based model communication with proper error handling
- **Integration**: Uses MCPClient for real model communication, AgentHealthMonitor for availability checks

### ContinuousVerifier (continuous-verifier.ts:7-70)
- **Purpose**: Multi-model continuous verification system for agent outputs
- **Key Features**:
  - AST-based code analysis for quality verification
  - Plan adherence validation against original tasks
  - Combined verification results with detailed feedback
  - Real-time verification workflow integration
- **Integration**: Uses CodeAnalyzer and PlanAdherenceValidator

### TaskProgressTracker (task-progress-tracker.ts:4-83)
- **Purpose**: Real-time task progress tracking with footer integration
- **Key Features**:
  - Micro-task based progress calculation
  - Event-driven progress notifications with listener pattern
  - Persistent progress storage (localStorage)
  - Real-time progress updates for UI integration
- **Integration**: Integrates with footer system for real-time status display

### MCPClient (mcp-client.ts:1-200)
- **Purpose**: WebSocket-based MCP client for model communication
- **Key Features**:
  - WebSocket connection management with automatic reconnection
  - Session-based message routing to specific models
  - Model-specific message handling (Sonnet, Codex, Gemini, Qwen)
  - Connection state management and error handling
- **Models Supported**: Claude Sonnet (Tech Lead), OpenAI Codex (Senior Dev), Google Gemini (Doc Manager), Qwen (QA Specialist)

### PlanAdherenceValidator (plan-adherence-validator.ts:1-120)
- **Purpose**: Validates agent outputs against original task requirements
- **Key Features**:
  - Task requirement analysis and decomposition
  - Output compliance checking against original specifications
  - Detailed feedback generation for non-adherent outputs
  - Integration with continuous verification workflow
- **Integration**: Used by ContinuousVerifier for comprehensive validation

### PlatformDetector (platform-detector.ts:25-150)
- **Purpose**: Multi-platform availability monitoring and intelligent selection
- **Key Features**:
  - Health checks for Codex, Gemini, Qwen, and Synthetic platforms
  - Weighted round-robin load balancing with capability filtering
  - Real-time status monitoring with latency and error rate tracking
  - Platform weight adjustment based on performance
- **Platforms Supported**: Codex, Gemini, Qwen, Synthetic

### EnhancedResourceManager (enhanced-resource-manager.ts:24-150)
- **Purpose**: Resource allocation and rate limiting across platforms
- **Key Features**:
  - Token bucket implementation for rate limiting
  - Circuit breaker pattern for failure handling
  - Priority-based task queuing (LOW, MEDIUM, HIGH)
  - Historical performance data collection
- **Resource Controls**: Token buckets per platform, circuit breakers, priority queues

### EnhancedAutoCCRRunner (enhanced-auto-ccr-runner.ts:50-200)
- **Purpose**: Enhanced CCR fallback orchestration with real-time monitoring
- **Key Features**:
  - SQLite polling for Claude session limits
  - Circuit breaker integration for failure detection
  - Context preservation during fallback triggers
  - Winston logging and metrics collection
- **Monitoring**: Real-time session monitoring, fallback strategy execution

## API Endpoints
- `executeDreamTeamWorkflow(prompt)` - Main workflow execution with MCP integration
- `verifyAgentOutput(response, task)` - Continuous verification of agent outputs
- `updateTaskProgress(taskId, microTask)` - Real-time progress updates
- `getTaskProgress(taskId)` - Retrieve current task progress
- Platform health status retrieval
- Resource utilization metrics
- Performance benchmarking data

## Integration Points
### Consumes
- MCP Orchestrator: WebSocket-based model communication
- CodeAnalyzer: AST-based code quality verification
- PlanAdherenceValidator: Task compliance validation
- AgentHealthMonitor: Real-time agent availability checks
- Circuit breaker services: Failure detection and recovery
- SQLite: Claude session monitoring
- Footer system: Real-time progress display

### Provides
- Task orchestration across multiple AI platforms with real MCP integration
- Multi-model continuous verification system
- Real-time task progress tracking with UI integration
- Resource management and rate limiting
- Performance metrics and health monitoring
- Fallback orchestration for CCR scenarios

## Configuration
Required environment variables:
- `MCP_ORCHESTRATOR_URL` - WebSocket URL for MCP orchestrator (default: ws://localhost:3000)
- `MCP_API_KEY` - API key for MCP authentication (default: devflow-api-key)
- Platform endpoint configurations for each AI service
- Token bucket capacities and refill rates per platform
- Circuit breaker thresholds and recovery timeouts
- Monitoring endpoint configurations
- Database paths for session tracking

## Key Patterns
- Real MCP integration replacing placeholder implementations
- Event-driven architecture with EventEmitter patterns for progress tracking
- Multi-model continuous verification with AST analysis
- WebSocket-based model communication with session management
- Circuit breaker pattern for resilience per agent type
- Real-time progress tracking with listener pattern
- Plan adherence validation for output quality assurance
- Token bucket rate limiting for resource control
- Priority queue management for task scheduling
- Performance benchmarking with historical data

## Related Documentation
- MCP_INTEGRATION.md - Detailed MCP integration documentation
- Platform-specific API integration guides
- Performance optimization strategies
- Circuit breaker configuration guides
- Fallback strategy documentation
- Real-time monitoring and dashboard setup
- Footer integration patterns