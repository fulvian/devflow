#!/bin/bash

# Start the progress tracking daemon
echo "Starting Progress Tracking Daemon..."
node -r ts-node/register src/daemon/progress-tracking-daemon.ts &
echo $! > .progress-daemon.pid
echo "Progress Tracking Daemon started with PID $(cat .progress-daemon.pid)"