# MCP Integration for Dream Team Orchestrator

## Overview

This document describes the updated implementation of the Dream Team Orchestrator with real MCP (Model Context Protocol) integration, replacing the previous placeholder implementation that used fake `mcp://` URLs.

## Changes Made

### 1. Updated DreamTeamOrchestrator

The `DreamTeamOrchestrator` class has been updated to use the real MCP client instead of fake fetch calls:

- **File**: `src/core/orchestration/dream-team-orchestrator.ts.updated`
- **Key Changes**:
  - Replaced fake `fetch` calls to `mcp://` URLs with real MCP client communication
  - Added connection management for the MCP orchestrator
  - Implemented proper session handling
  - Added automatic connection/disconnection

### 2. Updated AgentHealthMonitor

The `AgentHealthMonitor` class has been updated to use real health checks:

- **File**: `src/core/orchestration/fallback/agent-health-monitor.ts.updated`
- **Key Changes**:
  - Replaced fake health check endpoints with real MCP-based health checks
  - Implemented connection management for health monitoring
  - Added proper session handling for health checks

### 3. MCP Client

The existing MCP client implementation is used:

- **File**: `src/core/orchestration/mcp-client.ts`
- **Features**:
  - WebSocket-based communication with the orchestrator
  - Session management
  - Model-specific message routing
  - Automatic reconnection

## Architecture

The updated implementation follows this architecture:

```
DreamTeamOrchestrator
├── MCPClient (WebSocket connection)
│   └── MCP Orchestrator Server
│       ├── Sonnet Model (Tech Lead)
│       ├── Codex Model (Senior Dev)
│       ├── Gemini Model (Doc Manager)
│       └── Qwen Model (QA Specialist)
└── AgentHealthMonitor
    └── MCPClient (for health checks)
```

## Usage

### Environment Variables

The implementation requires the following environment variables:

```bash
MCP_ORCHESTRATOR_URL=ws://localhost:3000  # WebSocket URL for MCP orchestrator
MCP_API_KEY=your-api-key                  # API key for authentication
```

### Example Usage

```typescript
import DreamTeamOrchestrator from './dream-team-orchestrator';

const orchestrator = new DreamTeamOrchestrator();

// Execute a workflow
const results = await orchestrator.executeDreamTeamWorkflow(
  "Create a REST API endpoint for user authentication with JWT tokens"
);

// The orchestrator automatically connects/disconnects as needed
```

## Implementation Details

### DreamTeamOrchestrator Methods

1. **connect()** - Establishes connection to the MCP orchestrator
2. **disconnect()** - Closes connection to the MCP orchestrator
3. **callClaudeTechLead()** - Sends message to Sonnet model
4. **callCodexSeniorDev()** - Sends message to Codex model
5. **callGeminiDocManager()** - Sends message to Gemini model
6. **callQwenQASpecialist()** - Sends message to Qwen model
7. **executeDreamTeamWorkflow()** - Executes the complete workflow

### AgentHealthMonitor Methods

1. **performHealthCheck()** - Checks health of a specific agent
2. **performRecovery()** - Attempts to recover an unhealthy agent
3. **checkAllAgents()** - Checks health of all agents
4. **getAgentAvailability()** - Checks availability of a specific agent
5. **measureResponseTime()** - Measures response time for an agent

## Testing

A test file has been created to demonstrate the usage:

- **File**: `src/core/orchestration/dream-team-test.ts`

## Next Steps

1. Replace the original files with the updated versions
2. Test the integration with actual MCP orchestrator
3. Verify that all CLI tools (Codex, Gemini, Qwen) are properly integrated
4. Update documentation as needed

## Files Created

1. `src/core/orchestration/dream-team-orchestrator.ts.updated` - Updated orchestrator
2. `src/core/orchestration/fallback/agent-health-monitor.ts.updated` - Updated health monitor
3. `src/core/orchestration/dream-team-test.ts` - Test file
4. `src/core/orchestration/MCP_INTEGRATION.md` - This documentation