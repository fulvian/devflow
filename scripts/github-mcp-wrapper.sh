#!/bin/bash

# GitHub MCP Server Wrapper Script
# Manages the GitHub MCP server process for DevFlow

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
GITHUB_MCP_BINARY="$SCRIPT_DIR/github-mcp-server"
PID_FILE="$PROJECT_ROOT/.github-mcp.pid"
LOG_FILE="$PROJECT_ROOT/logs/github-mcp-server.log"

# Create logs directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Function to check if GitHub PAT is set
check_github_token() {
    if [ -z "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]; then
        echo "Error: GITHUB_PERSONAL_ACCESS_TOKEN environment variable is not set" >&2
        echo "Please set your GitHub Personal Access Token:" >&2
        echo "export GITHUB_PERSONAL_ACCESS_TOKEN='your_token_here'" >&2
        exit 1
    fi
}

# Function to start the GitHub MCP server
start_server() {
    check_github_token

    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "GitHub MCP server is already running (PID: $(cat "$PID_FILE"))"
        return 0
    fi

    echo "Starting GitHub MCP server..."

    # Start the server in background with stdio mode
    nohup "$GITHUB_MCP_BINARY" stdio > "$LOG_FILE" 2>&1 &
    SERVER_PID=$!

    # Save PID
    echo "$SERVER_PID" > "$PID_FILE"

    # Wait a moment to ensure server starts
    sleep 2

    if kill -0 "$SERVER_PID" 2>/dev/null; then
        echo "GitHub MCP server started successfully (PID: $SERVER_PID)"
        echo "Logs: $LOG_FILE"
    else
        echo "Failed to start GitHub MCP server"
        rm -f "$PID_FILE"
        exit 1
    fi
}

# Function to stop the GitHub MCP server
stop_server() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo "Stopping GitHub MCP server (PID: $PID)..."
            kill "$PID"
            sleep 2

            # Force kill if still running
            if kill -0 "$PID" 2>/dev/null; then
                echo "Force killing GitHub MCP server..."
                kill -9 "$PID"
            fi
        fi
        rm -f "$PID_FILE"
        echo "GitHub MCP server stopped"
    else
        echo "GitHub MCP server is not running"
    fi
}

# Function to check server status
status_server() {
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "GitHub MCP server is running (PID: $(cat "$PID_FILE"))"
        return 0
    else
        echo "GitHub MCP server is not running"
        return 1
    fi
}

# Function to restart the server
restart_server() {
    echo "Restarting GitHub MCP server..."
    stop_server
    sleep 1
    start_server
}

# Function to show logs
show_logs() {
    if [ -f "$LOG_FILE" ]; then
        tail -f "$LOG_FILE"
    else
        echo "No log file found at $LOG_FILE"
    fi
}

# Handle stdio mode for MCP communication
if [ "${1:-}" = "stdio" ]; then
    check_github_token
    exec "$GITHUB_MCP_BINARY" stdio
fi

# Handle commands
case "${1:-}" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        restart_server
        ;;
    status)
        status_server
        ;;
    logs)
        show_logs
        ;;
    test)
        check_github_token
        echo "Testing GitHub MCP server..."
        "$GITHUB_MCP_BINARY" --help
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs|test|stdio}"
        echo ""
        echo "Commands:"
        echo "  start   - Start the GitHub MCP server"
        echo "  stop    - Stop the GitHub MCP server"
        echo "  restart - Restart the GitHub MCP server"
        echo "  status  - Check if server is running"
        echo "  logs    - Show server logs"
        echo "  test    - Test server binary"
        echo "  stdio   - Run in stdio mode (for MCP clients)"
        exit 1
        ;;
esac