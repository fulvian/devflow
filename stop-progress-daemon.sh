#!/bin/bash

# Stop the progress tracking daemon
if [ -f .progress-daemon.pid ]; then
  PID=$(cat .progress-daemon.pid)
  echo "Stopping Progress Tracking Daemon (PID: $PID)..."
  kill $PID
  rm .progress-daemon.pid
  echo "Progress Tracking Daemon stopped"
else
  echo "Progress Tracking Daemon is not running"
fi