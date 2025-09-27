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

## API Documentation

### DevFlowSystem

#### Constructor

```typescript
new DevFlowSystem(config?: Partial<SystemConfig>)
```

#### Methods

| Method | Description |
|--------|-------------|
| `initialize(): Promise<void>` | Initialize the system components |
| `createTask(name, payload, priority): Task` | Create a new cognitive task |
| `storeMemory(key, value, ttl?): void` | Store data in cognitive memory |
| `retrieveMemory(key): any` | Retrieve data from cognitive memory |
| `getConfig(): SystemConfig` | Get current system configuration |
| `getStatus(): Object` | Get system status information |

#### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `initialized` | - | System successfully initialized |
| `taskCreated` | Task | New task created |
| `memoryStored` | MemoryEntry | Data stored in memory |
| `error` | ErrorObject | System error occurred |

## Configuration

```typescript
interface SystemConfig {
  debug: boolean;        // Enable debug logging
  memoryLimit: number;   // Maximum memory entries
  taskTimeout: number;   // Task execution timeout (ms)
}
```

## Development

```bash
# Development with watch mode
npm run dev

# Run tests
npm test

# Generate documentation
npm run docs

# Lint code
npm run lint
```

## Phase 1 Roadmap

- [x] Core system architecture
- [x] Task management subsystem
- [x] Memory persistence layer
- [x] Event system implementation
- [x] Configuration management
- [ ] Basic task execution engine
- [ ] Memory optimization strategies
- [ ] Performance benchmarking

**Current Status**: Phase 1 Setup Complete

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue on the GitHub repository or contact the development team.