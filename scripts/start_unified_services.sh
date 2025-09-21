#!/bin/bash
# Start DevFlow services with unified database

set -e

echo "🚀 Starting DevFlow services with unified database..."

# Export unified database path
export DEVFLOW_DB_PATH=./data/devflow_unified.sqlite
export DATABASE_URL=sqlite:./data/devflow_unified.sqlite

# Verify unified database exists
if [ ! -f "./data/devflow_unified.sqlite" ]; then
    echo "❌ Error: Unified database not found!"
    exit 1
fi

echo "✅ Using unified database: $DEVFLOW_DB_PATH"

# Start services in dependency order
echo "📡 Starting Database Daemon..."
DEVFLOW_DB_PATH=$DEVFLOW_DB_PATH DB_MANAGER_PORT=3002 node -r ts-node/register src/core/database/database-daemon.ts &
DB_DAEMON_PID=$!
sleep 3

echo "🎯 Starting Model Registry..."
MODEL_REGISTRY_PORT=3004 node -r ts-node/register src/core/services/model-registry-daemon.ts &
MODEL_REGISTRY_PID=$!
sleep 2

echo "🧠 Starting Vector Memory Service..."
VECTOR_MEMORY_PORT=3008 DEVFLOW_DB_PATH=$DEVFLOW_DB_PATH node packages/core/dist/services/vector-memory-service.cjs &
VECTOR_MEMORY_PID=$!
sleep 2

echo "🔧 Starting Project Lifecycle API..."
DEVFLOW_DB_PATH=$DEVFLOW_DB_PATH node src/api/project-lifecycle-api.js &
API_PID=$!
sleep 3

echo "✅ All services started!"

# Save PIDs for cleanup
echo "DB_DAEMON_PID=$DB_DAEMON_PID" > .services.pid
echo "MODEL_REGISTRY_PID=$MODEL_REGISTRY_PID" >> .services.pid
echo "VECTOR_MEMORY_PID=$VECTOR_MEMORY_PID" >> .services.pid
echo "API_PID=$API_PID" >> .services.pid

# Test connectivity
echo "🧪 Testing service connectivity..."
sleep 5

# Test Database Daemon
if pgrep -f "database-daemon" > /dev/null; then
    echo "✅ Database Daemon: ACTIVE"
else
    echo "❌ Database Daemon: NOT ACTIVE"
fi

# Test Vector Memory Service
if curl -s http://localhost:3008/health > /dev/null 2>&1; then
    echo "✅ Vector Memory Service: ACTIVE"
else
    echo "⚠️ Vector Memory Service: NOT RESPONDING"
fi

# Test Project API
if curl -s http://localhost:3003/health > /dev/null 2>&1; then
    echo "✅ Project Lifecycle API: ACTIVE"
else
    echo "❌ Project Lifecycle API: NOT ACTIVE"
fi

echo ""
echo "🎉 DevFlow unified database migration completed!"
echo "📊 Database: ./data/devflow_unified.sqlite"
echo "📝 Logs: check individual service outputs"
echo "🔍 Test commands:"
echo "  curl http://localhost:3003/health"
echo "  echo 'crea progetto Test' | python3 .claude/hooks/project-lifecycle-automation.py"