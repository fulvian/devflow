#!/bin/bash

# GitHub MCP Server Wrapper (STDIO, no Docker)
# Uses the locally installed github-mcp-server binary (Go) via stdio.

set -euo pipefail

# Colors if stderr is a TTY
if [ -t 2 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; NC=''
fi

err() { echo -e "${RED}[ERROR]${NC} $1" >&2; }
info() { echo -e "${GREEN}[INFO]${NC} $1" >&2; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1" >&2; }

# Best-effort: load token from common locations if not set
maybe_load_env() {
  if [ -z "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]; then
    # Project-scoped config
    if [ -f "$(dirname "$0")/../config/github-mcp-env" ]; then
      # shellcheck source=/dev/null
      source "$(dirname "$0")/../config/github-mcp-env" || true
    fi
  fi
  if [ -z "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ] && [ -f "$HOME/.config/devflow/github-mcp-env" ]; then
    # shellcheck source=/dev/null
    source "$HOME/.config/devflow/github-mcp-env" || true
  fi
}

check_requirements() {
  if ! command -v github-mcp-server >/dev/null 2>&1; then
    err "'github-mcp-server' binary not found in PATH."
    err "Install the static binary and ensure it's in PATH, then retry."
    echo >&2
    echo >&2 "Quick install (example):"
    echo >&2 "  # macOS arm64 example (adjust for your OS/arch)"
    echo >&2 "  curl -L -o /usr/local/bin/github-mcp-server \\
    https://github.com/github/github-mcp-server/releases/latest/download/github-mcp-server-darwin-arm64 && \\
  chmod +x /usr/local/bin/github-mcp-server"
    exit 127
  fi

  if [ -z "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]; then
    err "GITHUB_PERSONAL_ACCESS_TOKEN is not set."
    warn "Set it in your shell profile or create config/github-mcp-env (or ~/.config/devflow/github-mcp-env)."
    echo >&2 "Example: export GITHUB_PERSONAL_ACCESS_TOKEN='ghp_xxx'"
    exit 2
  fi
}

main() {
  maybe_load_env
  check_requirements
  # Exec stdio server; pass through any args (e.g., toolset flags)
  exec github-mcp-server stdio "$@"
}

main "$@"

