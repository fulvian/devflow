#!/bin/bash
# File: start-fallback-monitoring.sh

echo "Starting DevFlow Fallback Monitoring System..."
echo "Task ID: DEVFLOW-MONITORING-001"

# Navigate to the project root
cd /Users/fulvioventura/devflow

# Ensure environment variables are set
export NODE_ENV=production
export FALLBACK_MONITORING_ENABLED=true

# Start the monitoring system
node src/core/orchestration/fallback/fallback-monitoring-bootstrap.js

echo "Fallback monitoring system deployment completed."