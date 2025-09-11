#!/bin/bash
# DevFlow Complete System Shutdown Script

echo "🛑 Stopping all DevFlow services..."
echo "=================================="

PID_FILE=".devflow_pids"

if [ -f "$PID_FILE" ]; then
  PIDS=$(cat $PID_FILE)
  if [ -n "$PIDS" ]; then
    echo "Killing processes with PIDs: $PIDS"
    kill -9 $PIDS 2>/dev/null || true
    rm $PID_FILE
    echo "✅ All DevFlow services have been stopped."
  else
    echo "⚠️  PID file is empty. No processes to stop."
  fi
else
  echo "⚠️  PID file not found. Cannot stop services."
fi

echo "=================================="
