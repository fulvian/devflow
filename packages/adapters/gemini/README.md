# Gemini CLI Adapter for DevFlow

This package provides an MCP (Model Context Protocol) adapter for the Gemini CLI, enabling integration with the DevFlow orchestration system.

## Features

- OAuth2 authentication with token refresh
- Secure credential storage
- Error handling for authentication failures
- MCP tools for interacting with Gemini CLI
- Integration with DevFlow patterns

## Installation

```bash
npm install @devflow/gemini-adapter
```

## Configuration

1. Set up your environment variables in `.env`:

```env
GEMINI_CLIENT_ID=your_client_id
GEMINI_CLIENT_SECRET=your_client_secret
```

2. Authenticate with Gemini CLI:

```bash
gemini auth login
```

## Usage

### Starting the MCP Server

```bash
npx gemini-mcp
```

Or programmatically:

```typescript
import { GeminiMCPServer } from '@devflow/gemini-adapter';

const server = new GeminiMCPServer();
server.run();
```

### Using the Authentication Service

```typescript
import { GeminiAuthService } from '@devflow/gemini-adapter';

const authService = GeminiAuthService.getInstance();

// Check if we have a valid access token
if (!authService.hasValidAccessToken()) {
  await authService.refreshTokenIfNeeded();
}

// Get the current access token
const token = authService.getAccessToken();
```

## MCP Tools

### ask-gemini

Ask questions to Gemini CLI with OAuth authentication.

**Parameters:**
- `prompt` (string, required): Question or prompt to send to Gemini CLI
- `model` (string, optional): Model to use (e.g., gemini-pro, gemini-ultra)
- `sandbox` (boolean, optional): Use sandbox mode for safe execution
- `changeMode` (boolean, optional): Enable structured change mode for code modifications

### brainstorm

Generate ideas with Gemini CLI using structured brainstorming techniques.

**Parameters:**
- `prompt` (string, required): Primary brainstorming challenge or question to explore
- `domain` (string, optional): Domain context for specialized brainstorming
- `methodology` (string, optional): Brainstorming framework to use (divergent, convergent, scamper, design-thinking, lateral, auto)
- `ideaCount` (integer, optional): Target number of ideas to generate
- `constraints` (string, optional): Known limitations, requirements, or boundaries
- `includeAnalysis` (boolean, optional): Include feasibility and implementation analysis

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

## License

MIT