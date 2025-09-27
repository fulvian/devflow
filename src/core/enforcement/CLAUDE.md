# Enforcement Daemon Service CLAUDE.md

## Purpose
Provides system enforcement, health monitoring, and recovery management for DevFlow daemon processes.

## Narrative Summary
The Enforcement Daemon Service ensures system reliability through continuous health monitoring, automatic recovery from failures, and startup validation. It implements a comprehensive daemon management system that can detect process failures, handle PID file conflicts, and perform graceful degradation when necessary. The service is designed to keep critical DevFlow processes running reliably in production environments.

## Key Files
- `health-monitor.ts:18-135` - Core health monitoring with configurable metrics collection
- `recovery-manager.ts:21-196` - Automatic recovery and process conflict resolution
- `startup-validator.ts` - Validates system prerequisites before daemon startup

## Core Components

### HealthMonitor (health-monitor.ts:18-135)
- **Purpose**: Continuous monitoring of system health and resource status
- **Key Features**: 
  - Configurable check intervals and heartbeat timeout detection
  - Memory, CPU, and resource availability monitoring
  - Real-time health status reporting with issue detection
- **Configuration**: Check interval, critical resources, heartbeat timeout

### RecoveryManager (recovery-manager.ts:21-196)
- **Purpose**: Handles process failures and conflicts with automatic recovery
- **Key Features**:
  - PID file cleanup and stale process detection
  - Process conflict resolution with graceful/forced termination
  - Resource validation and graceful degradation support
  - Configurable retry attempts with exponential backoff
- **Configuration**: Max recovery attempts, recovery interval, resource check timeout

### StartupValidator (startup-validator.ts)
- **Purpose**: Pre-flight validation before daemon initialization
- **Features**: System resource validation, dependency checking

## Configuration
Required environment variables:
- `ENFORCEMENT_PID_DIR` - Directory for PID files (default: /var/run)
- Health check intervals and resource paths configurable per component

## Integration Points
### Consumes
- System resources: `/tmp`, `/var/log`, `/var/run` for validation
- Process management: PID files and process signals for control

### Provides
- Health metrics and status reporting
- Process recovery and conflict resolution
- System reliability monitoring

## Key Patterns
- Event-driven monitoring with configurable intervals
- Circuit breaker pattern for graceful degradation
- PID-based process management with cleanup
- Resource validation with timeout protection

## Related Documentation
- DevFlow daemon startup scripts
- System monitoring integration
- Process management protocols