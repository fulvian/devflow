# DevFlow Unified System v1.0

A production-ready AI orchestration platform with comprehensive microservices architecture, real-time monitoring, and Context7-compliant implementation patterns.

## Overview

DevFlow is a sophisticated AI orchestration and task management platform designed for enterprise-grade intelligent applications. It provides a unified approach to AI model management, real-time task orchestration, and comprehensive system monitoring with 100% service coverage.

### Key Features

- **AI Model Registry**: Centralized AI model management with intelligent routing
- **Real-time Orchestration**: Multi-agent coordination with circuit breaker patterns
- **Context7 Integration**: Up-to-date documentation and code examples integration
- **Microservices Architecture**: 14 production-ready services with health monitoring
- **Progress Tracking**: Real-time task monitoring with WebSocket dashboard
- **Vector Memory System**: Intelligent embedding processing with Ollama integration

## Architecture

```
DevFlow Unified System v1.0
├── Infrastructure Services
│   ├── Database Manager (Port 3002)
│   ├── Model Registry (Port 3004)
│   ├── Vector Memory (Port 3008)
│   └── Context Bridge (Port 3007)
├── Orchestration Services
│   ├── Unified Orchestrator (Port 3005)
│   ├── CLI Integration (Port 3201)
│   ├── Real Dream Team (Port 3200)
│   └── Progress Tracking (Daemon)
├── Management Services
│   ├── Project Lifecycle API (Port 3003)
│   ├── Monitoring Dashboard (Port 3202/3203)
│   ├── Codex MCP Server (Port 8013)
│   └── Enforcement Daemon (Port 8787)
└── Background Processing
    ├── APScheduler Embedding (Daemon)
    ├── DevFlow Metrics (Port 9091)
    └── Enhanced Memory System
```

## Installation & Quick Start

```bash
# Clone the repository
git clone https://github.com/fulvioventura/devflow.git

cd devflow

# Install dependencies
npm install

# Start the complete DevFlow system
./start-devflow.sh

# Check system status
./start-devflow.sh status
```

### Prerequisites

- Node.js 18+ (with TypeScript support)
- Python 3.9+ (for embedding processing)
- Ollama (for vector embeddings)
- Codex CLI (for MCP integration)
- SQLite 3

## System Usage

### Starting DevFlow System

```bash
# Start all services (recommended)
./start-devflow.sh

# Start specific services
./start-devflow.sh start

# Check system health
./start-devflow.sh status

# Stop all services
./start-devflow.sh stop
```

### API Endpoints

```bash
# System Health
curl http://localhost:3005/health

# Orchestrator Status
curl http://localhost:3005/api/metrics

# Model Registry
curl http://localhost:3004/health

# Real-time Dashboard
open http://localhost:3202

# Progress Tracking
curl http://localhost:3005/api/tasks
```

### Context7 Integration

```bash
# Access up-to-date documentation
npx @upstash/context7-mcp --api-key YOUR_KEY

# Codex CLI with MCP
codex "Help me implement..."
```

## Service Documentation

### Core Services

| Service | Port | Description | Status Endpoint |
|---------|------|-------------|-----------------|
| **Database Manager** | 3002 | SQLite unified database | `/health` |
| **Model Registry** | 3004 | AI model management | `/health` |
| **Vector Memory** | 3008 | Embedding storage | `/health` |
| **Context Bridge** | 3007 | AI context injection | `/health` |
| **Unified Orchestrator** | 3005 | Task orchestration | `/health` |
| **CLI Integration** | 3201 | MCP command execution | `/health` |
| **Real Dream Team** | 3200 | Multi-agent coordination | `/health` |
| **Project API** | 3003 | Project management | `/health` |
| **Monitoring Dashboard** | 3202/3203 | Real-time monitoring | `/health` |
| **Codex MCP** | 8013 | Context7 integration | `/health` |
| **Enforcement** | 8787 | Code compliance | `/health` |
| **DevFlow Metrics** | 9091 | Prometheus metrics | `/metrics` |

### Background Services

| Service | Type | Description |
|---------|------|-------------|
| **Progress Tracking** | Daemon | Real-time task monitoring |
| **APScheduler Embedding** | Daemon | Automatic embedding processing |
| **Enhanced Memory** | System | Semantic memory with Ollama |

## Configuration

### Environment Variables (.env)

```bash
# Core Services
ORCHESTRATOR_PORT=3005
DB_MANAGER_PORT=3002
PROJECT_API_PORT=3003
MODEL_REGISTRY_PORT=3004

# Advanced Services
CONTEXT_BRIDGE_PORT=3007
VECTOR_MEMORY_PORT=3008
ENHANCED_MEMORY_PORT=3009

# Orchestration
DREAM_TEAM_PORT=3200
CLI_INTEGRATION_PORT=3201
DASHBOARD_PORT=3202
WS_PORT=3203

# External Services
CODEX_SERVER_PORT=8013
ENFORCEMENT_DAEMON_PORT=8787
DEVFLOW_METRICS_PORT=9091

# Database
DEVFLOW_DB_PATH=./data/devflow_unified.sqlite
```

## Development & Monitoring

```bash
# System commands
./start-devflow.sh start    # Start all services
./start-devflow.sh stop     # Stop all services
./start-devflow.sh status   # Check system status
./start-devflow.sh restart  # Restart system

# Monitoring
curl http://localhost:3005/api/metrics  # Orchestrator metrics
curl http://localhost:9091/metrics      # Prometheus metrics
open http://localhost:3202              # Real-time dashboard
```

## Implementation Status

### ✅ COMPLETED (100% Functional)

- [x] **Infrastructure Services** - Database, Model Registry, Vector Memory, Context Bridge
- [x] **Orchestration Services** - Unified Orchestrator, CLI Integration, Real Dream Team
- [x] **Management Services** - Project API, Monitoring Dashboard, Codex MCP, Enforcement
- [x] **Background Processing** - Progress Tracking, APScheduler Embedding, DevFlow Metrics
- [x] **Context7 Integration** - Modern MCP patterns, health checks, circuit breakers
- [x] **Production Readiness** - Comprehensive monitoring, error handling, graceful shutdown

**Current Status**: ✅ **Production Ready - 100% Service Coverage**

## Key Achievements

### 🚀 Performance Improvements
- **System Coverage**: Increased from 53% to 100% (+47 percentage points)
- **Service Count**: From 8 to 14 active services (+75% increase)
- **Real-time Processing**: Live progress tracking and WebSocket monitoring
- **Context7 Compliance**: Modern MCP integration patterns implemented

### 🏗️ Architecture Highlights
- **Microservices Design**: 14 independent, scalable services
- **Circuit Breaker Patterns**: Production-grade resilience and failover
- **Health Monitoring**: Comprehensive endpoint monitoring across all services
- **Unified Database**: Single source of truth with referential integrity
- **Background Processing**: Intelligent embedding processing with rate limiting

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/DevFlowEnhancement`)
3. Follow Context7 best practices for implementation
4. Ensure all health checks pass: `./start-devflow.sh status`
5. Commit your changes with conventional commits
6. Push to the branch and open a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support & Documentation

- **System Status**: `./start-devflow.sh status`
- **Health Dashboard**: http://localhost:3202
- **API Documentation**: http://localhost:3005/api/metrics
- **Issues**: GitHub Issues for bug reports and feature requests
- **Context7 Docs**: Integration with up-to-date documentation patterns

---

**DevFlow Unified System v1.0** - Production-ready AI orchestration platform with 100% service coverage and Context7 compliance.