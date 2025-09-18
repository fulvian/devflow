# UI Monitoring Service CLAUDE.md

## Purpose
Provides real-time monitoring dashboard with WebSocket integration for Dream Team Orchestrator status tracking.

## Narrative Summary
The UI Monitoring Service implements a comprehensive real-time monitoring dashboard with WebSocket connectivity for tracking platform status, system health, and orchestrator performance. It provides both HTTP REST endpoints and WebSocket streams for real-time updates, integrating with Prometheus metrics and offering a complete monitoring solution for the Dream Team Orchestrator ecosystem.

## Key Files
- `monitoring-dashboard.ts:12-150` - Main dashboard server with WebSocket integration
- `platform-status-tracker.ts:1-200` - Platform health monitoring and status aggregation

## Core Components

### MonitoringDashboard (monitoring-dashboard.ts:12-150)
- **Purpose**: Real-time monitoring dashboard with WebSocket and HTTP interfaces
- **Key Features**:
  - WebSocket server for real-time status updates
  - HTTP server for REST API endpoints
  - Periodic status broadcasting to connected clients
  - Signal handling for graceful shutdown
  - Prometheus metrics integration
- **Ports**: Dashboard on 3202, WebSocket on 3203

### PlatformStatusTracker (platform-status-tracker.ts:1-200)
- **Purpose**: Comprehensive platform health monitoring and status aggregation
- **Key Features**:
  - Real-time platform health checks
  - System-wide health aggregation
  - Performance metrics collection
  - Status history tracking
  - Alert threshold management
- **Integration**: Used by MonitoringDashboard for status data

## API Endpoints
- `GET /status` - Overall system health status
- `GET /platforms` - Individual platform status details
- `GET /metrics` - Prometheus-compatible metrics
- WebSocket `/ws` - Real-time status updates

## Integration Points
### Consumes
- Dream Team Orchestrator: Platform health data
- MCP services: Agent availability status
- System metrics: Performance and resource data

### Provides
- Real-time monitoring dashboard
- WebSocket status streams
- REST API for status queries
- Prometheus metrics endpoint
- System health aggregation

## Configuration
Required environment variables:
- `DASHBOARD_PORT` - HTTP dashboard port (default: 3202)
- `WS_PORT` - WebSocket server port (default: 3203)
- `METRICS_INTERVAL` - Status update interval in milliseconds
- Platform endpoint configurations for health checks

## Key Patterns
- WebSocket-based real-time communication
- Periodic status broadcasting with interval management
- Signal handling for graceful shutdown
- Platform health aggregation with threshold monitoring
- REST API with WebSocket integration
- Prometheus metrics integration

## Related Documentation
- Dream Team Orchestrator monitoring integration
- WebSocket client implementation guides
- Prometheus metrics configuration
- Platform health check protocols