# GitHub MCP Server Configurations (Static STDIO)

This document defines the static (no Docker) configuration for the official GitHub MCP server across Claude Code, Codex, Gemini, and Qwen.

Important: The Docker-based setup is deprecated in this repository. Use the static binary with stdio.

## Install Binary

Install the github-mcp-server binary and ensure it is in your PATH.

- macOS arm64 example (adjust for your OS/arch):
  curl -L -o /usr/local/bin/github-mcp-server \
    https://github.com/github/github-mcp-server/releases/latest/download/github-mcp-server-darwin-arm64 && \
  chmod +x /usr/local/bin/github-mcp-server

Set the token (PAT with required scopes):
  export GITHUB_PERSONAL_ACCESS_TOKEN="your_actual_github_token_here"

Optional envs respected by the server:
- GITHUB_HOST (GitHub Enterprise URL)
- GITHUB_TOOLSETS
- GITHUB_READ_ONLY

## Project Wrapper (recommended)

Use the provided stdio wrapper to auto-load env from config and invoke the binary:
  /Users/fulvioventura/devflow/scripts/github-mcp-wrapper.sh stdio

## Platform Configurations

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

## Troubleshooting
- Binary not found: Ensure github-mcp-server is on PATH.
- Auth: Confirm GITHUB_PERSONAL_ACCESS_TOKEN is set and has required scopes (repo, read:org, read:user, read:project).
- Timeouts: Increase timeout to 600000 if discovery is slow.
- Name consistency: Use the server name "github" across all CLIs.
