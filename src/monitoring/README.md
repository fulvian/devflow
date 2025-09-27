# DevFlow Monitoring System

Native monitoring implementation perfectly aligned with DevFlow architecture.

## Features

- **Context7 Quality Tracking**: Real-time monitoring of Context7 quality metrics (53.3% current)
- **Task Lifecycle Monitoring**: Complete task state tracking and performance metrics
- **Database Performance**: Query time and size monitoring using better-sqlite3
- **Orchestrator Health**: Success rate and response time tracking
- **Prometheus Compatible**: Standard metrics endpoints for Grafana integration

## Quick Start

```bash
# Start monitoring server (default port 9091)
node src/monitoring/index.js start

# Check current metrics
node src/monitoring/index.js status

# Test server (port 9092)
node src/monitoring/index.js test
```

## Endpoints

- `GET /metrics` - Prometheus format metrics
- `GET /health` - Health check
- `GET /json` - JSON format metrics
- `GET /` - Web dashboard

## Configuration

Environment variables:
- `DEVFLOW_METRICS_PORT=9091` - Server port
- `DEVFLOW_DB_PATH=./data/devflow_unified.sqlite` - Database path
- `ORCHESTRATOR_URL=http://localhost:3005` - Orchestrator URL

## Integration

### Prometheus Configuration

```yaml
scrape_configs:
  - job_name: 'devflow-metrics'
    static_configs:
      - targets: ['localhost:9091']
    scrape_interval: 30s
```

### Grafana Dashboard

Import configuration from `config/grafana/devflow-dashboard.json`

### Alerting Rules

Load rules from `config/prometheus/devflow-alerts.yml`

## Key Metrics

- `devflow_context7_quality_score` - Context7 quality (0-1)
- `devflow_tasks_total{status}` - Task counts by status
- `devflow_database_query_time_ms` - DB performance
- `devflow_orchestrator_success_rate` - Orchestrator health

## Architecture Alignment

✅ Uses better-sqlite3 (DevFlow standard)
✅ Connects to ./data/devflow_unified.sqlite
✅ Integrates with orchestrator /api/metrics
✅ Native Node.js implementation
✅ Zero external monitoring dependencies

## Full Mode Readiness

System automatically tracks Context7 Full Mode readiness:
- Quality Score > 75% ✅
- Orchestrator Success > 95% ✅
- Database Performance Healthy ✅

Current status: **Not Ready** (Quality: 53.3%)