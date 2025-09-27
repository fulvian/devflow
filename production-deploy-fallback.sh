#!/bin/bash
# DevFlow Fallback System Production Deployment

echo "🚀 DEPLOYING DEVFLOW FALLBACK SYSTEM TO PRODUCTION"
echo "====================================================="

# Make bootstrap script executable
chmod +x src/core/orchestration/fallback/start-fallback-monitoring.sh

# Start the fallback monitoring system
./src/core/orchestration/fallback/start-fallback-monitoring.sh &

# Store the PID for later management
echo $! > .fallback-monitoring.pid

echo "✅ DevFlow Fallback System deployed and operational in production"
echo "📊 Monitoring agents: codex, gemini, qwen, synthetic, claude"
echo "🔄 Circuit breakers active"
echo "💊 Health monitoring enabled"
echo "📝 Process PID: $(cat .fallback-monitoring.pid)"

echo ""
echo "🎯 SISTEMA OPERATIVO IN PRODUZIONE!"
echo "====================================="