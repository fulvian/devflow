# Dream Team Orchestration Service CLAUDE.md

## Purpose
Orchestrates intelligent task delegation and resource management across multiple AI platforms and processing modes.

## Narrative Summary
The Dream Team Orchestration Service provides sophisticated coordination of tasks across different AI platforms (Qwen, Gemini, Codex, Synthetic) with intelligent routing, resource management, and performance optimization. It implements platform detection, weighted round-robin scheduling, circuit breaker patterns, and both parallel and sequential processing modes. The service ensures optimal resource utilization while maintaining high availability through fallback strategies.

## Key Files
- `dream-team-coordinator-enhanced.ts:6-110` - Main coordination engine with event-driven task processing
- `platform-detector.ts:25-150` - Multi-platform health monitoring and selection
- `enhanced-resource-manager.ts:24-150` - Token bucket rate limiting and circuit breaker management
- `enhanced-auto-ccr-runner.ts:50-200` - Enhanced CCR fallback orchestration with monitoring
- `agent-routing-engine.ts` - Intelligent agent selection and routing logic
- `batch-optimization-engine.ts` - Batch processing optimization for API efficiency

## Core Components

### DreamTeamCoordinator (dream-team-coordinator-enhanced.ts:6-110)
- **Purpose**: Central orchestration of multi-platform task processing
- **Key Features**:
  - Event-driven task queue management with priority handling
  - Parallel processing for documentation and QA tasks
  - Performance benchmarking and metrics collection
  - Alternative solution generation for failed high-priority tasks
- **Integration**: Uses QwenValidator for early task validation

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
- Task submission and status tracking
- Platform health status retrieval
- Resource utilization metrics
- Performance benchmarking data

## Integration Points
### Consumes
- QwenValidator: Early task validation
- PerformanceBenchmark: Task timing and metrics
- Circuit breaker services: Failure detection and recovery
- SQLite: Claude session monitoring

### Provides
- Task orchestration across multiple AI platforms
- Resource management and rate limiting
- Performance metrics and health monitoring
- Fallback orchestration for CCR scenarios

## Configuration
Required environment variables:
- Platform endpoint configurations for each AI service
- Token bucket capacities and refill rates per platform
- Circuit breaker thresholds and recovery timeouts
- Monitoring endpoint configurations
- Database paths for session tracking

## Key Patterns
- Event-driven architecture with EventEmitter patterns
- Weighted round-robin load balancing
- Circuit breaker pattern for resilience
- Token bucket rate limiting for resource control
- Priority queue management for task scheduling
- Performance benchmarking with historical data

## Related Documentation
- Platform-specific API integration guides
- Performance optimization strategies
- Circuit breaker configuration guides
- Fallback strategy documentation