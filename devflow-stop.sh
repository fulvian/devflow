#!/bin/bash
echo "🛑 Stopping DevFlow services..."

if [ -f .devflow_pids ]; then
    PIDS=$(cat .devflow_pids)
    for pid in $PIDS; do
        if kill -0 $pid 2>/dev/null; then
            echo "   Stopping PID $pid..."
            kill -TERM $pid 2>/dev/null
            sleep 2
            kill -9 $pid 2>/dev/null || true
        fi
    done
    rm .devflow_pids
fi

# Kill by process name as backup
pkill -f "synthetic" 2>/dev/null || true
pkill -f "devflow" 2>/dev/null || true
pkill -f "ccr" 2>/dev/null || true

# Stop CCR Services
if [ -f "scripts/ccr-services.sh" ]; then
    ./scripts/ccr-services.sh stop 2>/dev/null || true
fi

# Stop Emergency CCR if running
node emergency-ccr-cli.mjs stop 2>/dev/null || true

echo "✅ All DevFlow services stopped"
