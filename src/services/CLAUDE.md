# Smart Session Retry Service CLAUDE.md

## Purpose
Central coordination hub for intelligent session retry system that manages Claude Code session tracking, auto-resumption, and integration with DevFlow monitoring infrastructure.

## Narrative Summary
The Smart Session Retry Service implements ClaudeNightsWatch-inspired patterns to handle Claude Code rate limiting intelligently. It tracks active sessions, records limit events, and schedules adaptive retries based on usage patterns and system conditions. The service integrates with DevFlow Cometa for task state management and provides comprehensive health monitoring through REST endpoints.

## Key Files
- `smart-session-retry-hub.ts:1-578` - Main service hub with HTTP server and monitoring
- `../core/session/ClaudeSessionTracker.ts:1-269` - Core session tracking and limit parsing
- `../core/session/AutoResumeManager.ts` - Handles automatic session resumption logic
- `../../.devflow/sessions/` - Session data storage directory

## API Endpoints
- `GET /health` - Complete system status with usage metrics
- `GET /sessions` - List of active Claude sessions
- `GET /schedules` - Pending retry schedules
- `POST /notify-limit` - Accept limit notifications from Claude Code

## Integration Points
### Consumes
- Claude Code: ccusage command for usage monitoring
- DevFlow Cometa: http://localhost:3007 for task state synchronization
- Session files: `.devflow/sessions/current_session.json`

### Provides
- Health monitoring: Port 8889 (configurable)
- Session state updates: Updates current_session.json with retry status
- Log output: `logs/session-retry.log`

## Configuration
Environment variables:
- `SESSION_RETRY_ENABLED` - Enable/disable service (default: true)
- `SESSION_RETRY_PORT` - HTTP server port (default: 8889)
- `SESSION_RETRY_LOG_LEVEL` - Logging verbosity (default: info)
- `SESSION_RETRY_MONITOR_INTERVAL` - Health check interval seconds (default: 30)
- `SESSION_RETRY_HEALTH_PORT` - Health endpoint port (default: 8889)
- `SESSION_RETRY_CLAUDE_INTEGRATION` - Claude Code integration (default: true)

## Key Patterns
- Adaptive retry delays based on Claude usage percentage (see calculateAdaptiveRetryDelay:200-212)
- Exponential backoff for failed retries (see scheduleAdaptiveRetry:214-238)
- Intelligent limit message parsing supporting multiple formats (see parseLimitMessage:143-213)
- PID file management for daemon process control (see writePidFile:420-426)

## Operational Status
As of 2025-09-19, the service has been:
- Fully tested with comprehensive MCP server validation
- Verified operational with all DevFlow daemon processes
- Integrated with session monitoring and DevFlow Cometa API
- Validated health check endpoints and status reporting

## Related Documentation
- ../core/session/CLAUDE.md - Session tracking components
- ../../docs/PORT_MAPPING.md - Port allocation reference
- ../../logs/session-retry.log - Service operation logs