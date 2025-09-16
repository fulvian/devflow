# GitHub MCP Server Setup Guide (Static STDIO)

## Overview
Switch to the official GitHub MCP server static binary over stdio (no Docker). This replaces the prior Docker approach.

## Prerequisites
1. github-mcp-server binary installed and on PATH
2. GitHub Personal Access Token with scopes: repo, read:org, read:user, read:project

## Install
- macOS arm64 example:
  curl -L -o /usr/local/bin/github-mcp-server \
    https://github.com/github/github-mcp-server/releases/latest/download/github-mcp-server-darwin-arm64 && \
  chmod +x /usr/local/bin/github-mcp-server

## Configure Token
Option A (shell):
  export GITHUB_PERSONAL_ACCESS_TOKEN="your_token_here"

Option B (file):
- Create config/github-mcp-env with:
  GITHUB_PERSONAL_ACCESS_TOKEN=your_token_here
- Or use ~/.config/devflow/github-mcp-env and source it.

## Project Wrapper
Use the stdio wrapper to start the server for MCP hosts:
  /Users/fulvioventura/devflow/scripts/github-mcp-wrapper.sh stdio

## CLI Configurations

### Claude Code (~/.config/claude-desktop/claude_desktop_config.json)
{
  "mcpServers": {
    "github": {
      "command": "/Users/fulvioventura/devflow/scripts/github-mcp-wrapper.sh",
      "args": ["stdio"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}" },
      "timeout": 600000,
      "trust": false
    }
  }
}

### Codex (~/.codex/config.toml)
[mcp_servers.github]
command = "/Users/fulvioventura/devflow/scripts/github-mcp-wrapper.sh"
args = ["stdio"]
env = { GITHUB_PERSONAL_ACCESS_TOKEN = "${GITHUB_PERSONAL_ACCESS_TOKEN}" }

### Gemini (~/.gemini/settings.json)
{
  "mcpServers": {
    "github": {
      "command": "/Users/fulvioventura/devflow/scripts/github-mcp-wrapper.sh",
      "args": ["stdio"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}" },
      "timeout": 600000,
      "trust": false
    }
  }
}

### Qwen (~/.qwen/settings.json)
{
  "mcpServers": {
    "github": {
      "command": "/Users/fulvioventura/devflow/scripts/github-mcp-wrapper.sh",
      "args": ["stdio"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}" },
      "timeout": 600000,
      "trust": false
    }
  }
}

## Test
Run the wrapper directly (should stay idle awaiting MCP stdio):
  GITHUB_PERSONAL_ACCESS_TOKEN="$GITHUB_PERSONAL_ACCESS_TOKEN" \
    /Users/fulvioventura/devflow/scripts/github-mcp-wrapper.sh stdio

Then start your MCP host (Claude Code, Codex, Gemini, Qwen) and run /mcp to verify.

## Notes
- Docker-based scripts are deprecated and removed.
- Keep server name consistent: use "github" everywhere to avoid discovery mismatches.
