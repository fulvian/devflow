# DevFlow Startup Script Compliance Implementation

## Objective

Implement complete startup script compliance to restore full DevFlow system functionality by adding the 6 missing critical/important services that are fully implemented but not started by `start-devflow.sh`.

## Context

Comprehensive analysis revealed that DevFlow has excellent architecture with all services implemented, but the startup script only activates 53% of available services, creating critical functionality gaps.

## Project Background

Based on the detailed compliance analysis in `DevFlow-Startup-Script-Compliance-Report.md`, the current system suffers from:

- **Model Registry Daemon** (CRITICAL) - AI model management completely unavailable
- **CLI Integration Daemon** (CRITICAL) - MCP command execution broken
- **Real Dream Team Orchestrator** (IMPORTANT) - Advanced orchestration disabled
- **Progress Tracking Daemon** (IMPORTANT) - Real-time tracking unavailable
- **Project Lifecycle API** (IMPORTANT) - Programmatic management disabled
- **Monitoring Dashboard** (IMPORTANT) - Visual monitoring unavailable

## Scope

**IN SCOPE:**
- Add 6 missing service startup functions to `start-devflow.sh`
- Implement proper health checks and process management
- Update port configuration and service dependencies
- Ensure Context7-compliant implementation patterns
- Test complete system integration

**OUT OF SCOPE:**
- Modifying existing service implementations (already complete)
- Changing architectural patterns (focus on startup script only)
- Performance optimization (focus on functionality restoration)

## Success Criteria

1. **Full Service Coverage**: All 15 implemented services started by startup script
2. **Health Check Compliance**: All services have proper health validation
3. **Dependency Management**: Correct startup order and inter-service dependencies
4. **Context7 Compliance**: Implementation follows Context7 architectural patterns
5. **System Integration**: Complete DevFlow functionality restored to 100%

## Deliverables

1. **Updated start-devflow.sh** with all missing service functions
2. **Service Integration Tests** to validate complete system functionality
3. **Documentation Updates** reflecting full system capabilities
4. **Health Check Validation** ensuring robust service management
5. **Performance Benchmarks** measuring system improvement

## Research Requirements

- Online research for microservices startup script best practices
- Context7 pattern investigation for service orchestration
- Industry standards for health checks and process management
- Best practices for service dependency management
- Modern approaches to system integration testing

## Detailed Implementation Plan

### Phase 1: Critical Infrastructure Services (Priority: CRITICAL - Day 1-2)

#### 1.1 Model Registry Daemon (CRITICAL)
**Implementation Location**: `src/core/services/model-registry-daemon.ts`
**Port**: 3004
**Dependencies**: Database Manager (3002)
**Health Check Pattern**: HTTP endpoint `/health` with model availability status

**Implementation Steps**:
1. Add startup function to `start-devflow.sh`:
```bash
start_model_registry() {
    echo "Starting Model Registry Daemon on port ${MODEL_REGISTRY_PORT:-3004}..."
    npx ts-node src/core/services/model-registry-daemon.ts > logs/model-registry.log 2>&1 &
    local PID=$!
    echo $PID > .model-registry.pid
    wait_for_health_check "http://localhost:${MODEL_REGISTRY_PORT:-3004}/health" "Model Registry"
}
```
2. Update `set_defaults()` with MODEL_REGISTRY_PORT=3004
3. Add to startup sequence with database dependency
4. Implement health check validation

#### 1.2 CLI Integration Daemon (CRITICAL)
**Implementation Location**: `src/core/mcp/cli-integration-daemon.ts`
**Port**: 3201
**Dependencies**: Unified Orchestrator (3005)
**Health Check Pattern**: HTTP endpoint `/health` with MCP connectivity status

**Implementation Steps**:
1. Add startup function with MCP integration:
```bash
start_cli_integration() {
    echo "Starting CLI Integration Daemon on port ${CLI_INTEGRATION_PORT:-3201}..."
    npx ts-node src/core/mcp/cli-integration-daemon.ts > logs/cli-integration.log 2>&1 &
    local PID=$!
    echo $PID > .cli-integration.pid
    wait_for_health_check "http://localhost:${CLI_INTEGRATION_PORT:-3201}/health" "CLI Integration"
}
```
2. Configure MCP authentication and orchestrator communication
3. Add to startup sequence after orchestrator is ready

### Phase 2: Advanced Orchestration Services (Priority: IMPORTANT - Day 3-5)

#### 2.1 Real Dream Team Orchestrator (IMPORTANT)
**Implementation Location**: `src/core/orchestration/real-dream-team-daemon.ts`
**Port**: 3200
**Dependencies**: Model Registry (3004), CLI Integration (3201)
**Advanced Features**: Circuit breakers, multi-agent coordination, fallback strategies

**Implementation Steps**:
1. Add startup function with circuit breaker initialization:
```bash
start_dream_team_orchestrator() {
    echo "Starting Real Dream Team Orchestrator on port ${DREAM_TEAM_PORT:-3200}..."
    npx ts-node src/core/orchestration/real-dream-team-daemon.ts > logs/dream-team.log 2>&1 &
    local PID=$!
    echo $PID > .dream-team.pid
    wait_for_health_check "http://localhost:${DREAM_TEAM_PORT:-3200}/health" "Dream Team Orchestrator"
}
```
2. Configure agent coordination and circuit breaker patterns
3. Implement advanced health checks with agent status

#### 2.2 Progress Tracking Daemon (IMPORTANT)
**Implementation Location**: `src/daemon/progress-tracking-daemon.ts`
**Dependencies**: Database Manager (3002)
**Features**: Real-time progress updates, task lifecycle monitoring

**Implementation Steps**:
1. Add background process startup:
```bash
start_progress_tracking() {
    echo "Starting Progress Tracking Daemon..."
    npx ts-node src/daemon/progress-tracking-daemon.ts > logs/progress-tracking.log 2>&1 &
    local PID=$!
    echo $PID > .progress-tracking.pid
    sleep 2 && check_process_health $PID "Progress Tracking"
}
```
2. Configure real-time database updates and WebSocket integration

#### 2.3 Project Lifecycle API (IMPORTANT)
**Implementation Location**: `src/api/project-lifecycle-api.js`
**Port**: 3003
**Dependencies**: Database Manager (3002), Progress Tracking
**Features**: REST API for project management, automation hooks

**Implementation Steps**:
1. Add API server startup:
```bash
start_project_api() {
    echo "Starting Project Lifecycle API on port ${PROJECT_API_PORT:-3003}..."
    node src/api/project-lifecycle-api.js > logs/project-api.log 2>&1 &
    local PID=$!
    echo $PID > .project-api.pid
    wait_for_health_check "http://localhost:${PROJECT_API_PORT:-3003}/health" "Project API"
}
```

### Phase 3: Monitoring and Enhancement Services (Priority: ENHANCEMENT - Day 6-7)

#### 3.1 Monitoring Dashboard (ENHANCEMENT)
**Implementation Location**: `src/core/ui/monitoring-dashboard.ts`
**Ports**: 3202 (HTTP), 3203 (WebSocket)
**Dependencies**: All services for comprehensive monitoring
**Features**: Real-time dashboards, WebSocket live updates, system health visualization

**Implementation Steps**:
1. Add dual-port startup for HTTP and WebSocket:
```bash
start_monitoring_dashboard() {
    echo "Starting Monitoring Dashboard on ports ${DASHBOARD_PORT:-3202}/${WS_PORT:-3203}..."
    npx ts-node src/core/ui/monitoring-dashboard.ts > logs/monitoring.log 2>&1 &
    local PID=$!
    echo $PID > .monitoring-dashboard.pid
    wait_for_health_check "http://localhost:${DASHBOARD_PORT:-3202}/health" "Monitoring Dashboard"
}
```

### Health Check Standardization (Context7 Compliance)

#### Enhanced Health Check Function
```bash
wait_for_health_check() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -sf --max-time 5 "$url" > /dev/null 2>&1; then
            echo "✅ $service_name is healthy"
            return 0
        fi
        echo "⏳ Waiting for $service_name health check (attempt $attempt/$max_attempts)..."
        sleep 2
        ((attempt++))
    done

    echo "❌ $service_name health check failed after $max_attempts attempts"
    return 1
}
```

#### Process Health Check for Background Services
```bash
check_process_health() {
    local pid=$1
    local service_name=$2

    if kill -0 $pid 2>/dev/null; then
        echo "✅ $service_name process is running (PID: $pid)"
        return 0
    else
        echo "❌ $service_name process failed to start"
        return 1
    fi
}
```

## Risk Assessment

**HIGH RISK**: Current system operating at 53% capacity
**MEDIUM RISK**: Service integration complexity
**LOW RISK**: Implementation effort (services already exist)

## Dependencies

- Existing service implementations (already complete)
- Current startup script structure
- Context7 architectural compliance
- System testing capabilities

## Timeline

- **Day 1**: Research and planning
- **Day 2-3**: Critical services implementation
- **Week 1**: Important services implementation
- **Week 2-3**: Enhancement and testing
- **Week 4**: Documentation and validation

## Notes

This task focuses on unlocking existing system capabilities rather than building new functionality. All required services are implemented and ready for integration.