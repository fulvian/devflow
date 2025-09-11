# Orchestration System Deployment Guide

## Overview
This guide provides instructions for deploying the Orchestration System in production environments. The system supports multiple deployment models including containerized deployments and traditional server setups.

## Prerequisites

### System Requirements
- Minimum 4 CPU cores
- Minimum 8GB RAM
- Minimum 50GB available disk space
- Network access to all execution nodes

### Software Dependencies
- Docker 20.10+ (for containerized deployment)
- Kubernetes 1.20+ (for Kubernetes deployment)
- PostgreSQL 13+ with PostGIS extension
- Redis 6+ for caching
- Node.js 16+ (for direct deployment)

## Deployment Options

### 1. Docker Compose Deployment

For simple deployments, use the provided docker-compose configuration:

```yaml
version: '3.8'

services:
  orchestration-api:
    image: orchestration-system:latest
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/orchestration
      - REDIS_URL=redis://redis:6379
      - API_KEY=your-generated-api-key
    depends_on:
      - db
      - redis

  db:
    image: postgres:13
    environment:
      - POSTGRES_DB=orchestration
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - db_data:/var/lib/postgresql/data

  redis:
    image: redis:6

volumes:
  db_data:
```

Deploy with:
```bash
docker-compose up -d
```

### 2. Kubernetes Deployment

For production environments, use the Kubernetes manifests:

**deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orchestration-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: orchestration-api
  template:
    metadata:
      labels:
        app: orchestration-api
    spec:
      containers:
      - name: api
        image: orchestration-system:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: orchestration-config
        - secretRef:
            name: orchestration-secrets
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 60
          periodSeconds: 30
```

**service.yaml:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: orchestration-api
spec:
  selector:
    app: orchestration-api
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: LoadBalancer
```

Deploy with:
```bash
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
```

### 3. Direct Server Deployment

For traditional server deployments:

1. Install dependencies:
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Install Redis
sudo apt-get install -y redis-server
```

2. Create database:
```sql
CREATE DATABASE orchestration;
CREATE USER orchestration_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE orchestration TO orchestration_user;
```

3. Configure environment:
```bash
export DATABASE_URL=postgresql://orchestration_user:secure_password@localhost:5432/orchestration
export REDIS_URL=redis://localhost:6379
export API_KEY=your-generated-api-key
export NODE_ENV=production
```

4. Start application:
```bash
npm install --production
npm run build
npm start
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `API_KEY` | Secret key for API authentication | Yes |
| `PORT` | HTTP server port (default: 3000) | No |
| `LOG_LEVEL` | Logging level (default: info) | No |
| `ENABLE_TLS` | Enable HTTPS (default: false) | No |
| `TLS_CERT_PATH` | Path to TLS certificate | Required if ENABLE_TLS=true |
| `TLS_KEY_PATH` | Path to TLS private key | Required if ENABLE_TLS=true |

### Security Considerations

1. **API Keys**: Generate strong API keys and rotate them regularly
2. **Network Security**: Restrict access to database and Redis to trusted sources only
3. **Data Encryption**: Enable TLS for all external communications
4. **Access Control**: Implement network policies to limit access to the API

### Monitoring

The system exposes metrics in Prometheus format at `/metrics`. Configure your monitoring system to scrape these metrics.

Key metrics to monitor:
- API response times
- Database query performance
- Workflow execution success rates
- System resource utilization

### Backup and Recovery

1. **Database Backup**:
```bash
pg_dump -h db-host -U user orchestration > backup-$(date +%F).sql
```

2. **Configuration Backup**: Store all environment variables and configuration files in a secure location

3. **Recovery Process**: Restore database from backup and redeploy with backed-up configuration

## Scaling

### Horizontal Scaling
- Increase API server replicas based on load
- Use a load balancer to distribute requests
- Ensure database can handle increased load

### Vertical Scaling
- Increase CPU and memory allocation for API servers
- Upgrade database instance to handle more connections

## Troubleshooting

See [Troubleshooting Guide](./troubleshooting.md) for common deployment issues.
