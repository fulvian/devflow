# DevFlow Port Mapping Configuration

## Core Services Port Allocation

### Production Services (3000-3099)
| Service | Port | Environment Variable | Status | Description |
|---------|------|---------------------|--------|-------------|
| Database Manager | 3002 | `DB_MANAGER_PORT` | ✅ Active | SQLite database service |
| Vector Memory Service | 3003 | `VECTOR_MEMORY_PORT` | ✅ Active | Embedding and vector operations |
| Model Registry | 3004 | `MODEL_REGISTRY_PORT` | ✅ Active | AI model management |
| DevFlow Orchestrator | 3005 | `ORCHESTRATOR_PORT` | ✅ Active | Main orchestration service |
| Token Optimizer | 3006 | `TOKEN_OPTIMIZER_PORT` | ✅ Active | Context optimization |

### MCP Services (3100-3199)
| Service | Port | Environment Variable | Status | Description |
|---------|------|---------------------|--------|-------------|
| Codex MCP Server | 3101 | `CODEX_MCP_PORT` | ✅ Active | OpenAI Codex integration |
| Gemini MCP Server | 3102 | `GEMINI_MCP_PORT` | 🔄 Reserved | Google Gemini integration |
| Qwen MCP Server | 3103 | `QWEN_MCP_PORT` | 🔄 Reserved | Qwen model integration |
| Synthetic MCP Server | 3104 | `SYNTHETIC_MCP_PORT` | 🔄 Reserved | Synthetic.new integration |

### Orchestration Services (3200-3299)
| Service | Port | Environment Variable | Status | Description |
|---------|------|---------------------|--------|-------------|
| Real Dream Team Orchestrator | 3200 | `REAL_DREAM_TEAM_ORCHESTRATOR_PORT` | ✅ Active | Multi-model orchestration |
| CLI Integration Manager | 3201 | `CLI_INTEGRATION_MANAGER_PORT` | ✅ Active | CLI integration service |
| Platform Status Tracker | 3202 | `PLATFORM_STATUS_TRACKER_PORT` | ⚠️ Failed | Real-time status monitoring |

### gRPC Services (50000-59999)
| Service | Port | Environment Variable | Status | Description |
|---------|------|---------------------|--------|-------------|
| CC-Tools gRPC Server | 50051 | `CCTOOLS_GRPC_PORT` | ✅ Active | Cross-component communication |

## Port Conflict Resolution

### Automatic Port Detection
- Use `netstat -an | grep <port>` to check port availability
- Implement automatic port scanning for next available port
- Update environment variables dynamically if conflicts detected

### Reserved Port Ranges
- **3000-3099**: Core DevFlow services (high priority)
- **3100-3199**: MCP integration services (medium priority) 
- **3200-3299**: Advanced orchestration (medium priority)
- **50000-59999**: gRPC services (low priority, can auto-increment)

### Port Allocation Strategy
1. **Static allocation**: Core services have fixed ports (3002-3006)
2. **Dynamic allocation**: MCP services scan from base port if conflict
3. **Auto-increment**: gRPC services increment port until available

## Configuration Files

### Primary Configuration
- `.env`: Main environment variables for port configuration
- `devflow-start.sh`: Startup script with port validation logic

### Port Validation Functions
```bash
# Check if port is available
check_port_available() {
    local port=$1
    ! netstat -an | grep -q ":${port}.*LISTEN"
}

# Find next available port in range
find_available_port() {
    local base_port=$1
    local max_port=$2
    for ((port=base_port; port<=max_port; port++)); do
        if check_port_available $port; then
            echo $port
            return
        fi
    done
    echo "ERROR: No available ports in range $base_port-$max_port"
    return 1
}
```

## Troubleshooting

### Common Port Conflicts
1. **Port 3005**: DevFlow Orchestrator vs other services
2. **Port 3101**: Codex MCP vs external Codex instances
3. **Port 3200**: Real Dream Team vs other orchestrators

### Resolution Steps
1. Stop all DevFlow services: `./devflow-start.sh stop`
2. Check port conflicts: `netstat -an | grep -E "30[0-9][0-9]|50051"`
3. Update `.env` with available ports
4. Restart services: `./devflow-start.sh start`

## Monitoring

### Health Check Endpoints
- Database Manager: `http://localhost:3002/health`
- Vector Memory: `http://localhost:3003/health`
- Model Registry: `http://localhost:3004/health`
- DevFlow Orchestrator: `http://localhost:3005/health`
- Token Optimizer: `http://localhost:3006/health`
- Real Dream Team: `http://localhost:3200/health`
- CLI Integration: `http://localhost:3201/health`

### Port Status Monitoring
```bash
# Quick port status check
devflow_port_status() {
    echo "=== DevFlow Port Status ==="
    for port in 3002 3003 3004 3005 3006 3101 3200 3201 50051; do
        if netstat -an | grep -q ":${port}.*LISTEN"; then
            echo "Port $port: ✅ ACTIVE"
        else
            echo "Port $port: ❌ INACTIVE"
        fi
    done
}
```