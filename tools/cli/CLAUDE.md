# CLI Integration Tools CLAUDE.md

## Purpose
Provides command-line interface wrappers for external AI services with enhanced authentication handling and error management.

## Narrative Summary
The CLI Integration Tools provide robust command-line wrappers for external AI services including Gemini, Codex, and Qwen. The tools implement sophisticated authentication detection, error handling, and fallback strategies. The Gemini CLI wrapper features comprehensive OAuth token management, interactive authentication flows, and environment harmonization for seamless integration with DevFlow orchestration systems.

## Key Files
- `devflow-gemini.mjs:1-250` - Comprehensive Gemini CLI wrapper with authentication management
- `gemini-auth-diagnose.mjs:1-60` - Gemini authentication diagnostic tool
- `devflow-codex.mjs:1-50` - Codex CLI integration wrapper
- `devflow-qwen.mjs:1-50` - Qwen CLI integration wrapper

## Core Components

### DevFlow Gemini CLI (devflow-gemini.mjs:1-250)
- **Purpose**: Comprehensive Gemini CLI wrapper with advanced authentication handling
- **Key Features**:
  - Multi-method authentication detection (API key, Google ADC, OAuth personal)
  - Environment variable harmonization (GEMINI_API_KEY ↔ GOOGLE_API_KEY)
  - OAuth token discovery across multiple config directories
  - Interactive authentication flow with automatic token management
  - Comprehensive error handling and diagnostic output
  - Fallback strategies for authentication failures
- **Authentication Methods**: API key, Google Application Default Credentials, OAuth personal tokens

### Gemini Auth Diagnostics (gemini-auth-diagnose.mjs:1-60)
- **Purpose**: Authentication diagnostic and troubleshooting tool
- **Key Features**:
  - Environment variable validation
  - OAuth token file discovery and validation
  - Configuration directory scanning
  - Authentication method recommendation
  - Detailed diagnostic reporting
- **Integration**: Used for troubleshooting authentication issues

### DevFlow Codex CLI (devflow-codex.mjs:1-50)
- **Purpose**: OpenAI Codex CLI integration wrapper
- **Key Features**:
  - API key authentication
  - Error handling and status reporting
  - Input validation and formatting
- **Integration**: Direct integration with MCP Codex services

### DevFlow Qwen CLI (devflow-qwen.mjs:1-50)
- **Purpose**: Qwen model CLI integration wrapper
- **Key Features**:
  - Model endpoint configuration
  - Request formatting and response handling
  - Error management and fallback
- **Integration**: Integration with Qwen QA specialist role

## Authentication Flow (Gemini)

### Detection Priority
1. **API Key**: GEMINI_API_KEY or GOOGLE_API_KEY environment variables
2. **Google ADC**: GOOGLE_APPLICATION_CREDENTIALS file path
3. **OAuth Personal**: Interactive OAuth flow with token persistence

### Config Directory Discovery
- `$GEMINI_CONFIG_DIR`
- `$XDG_CONFIG_HOME/gemini`
- `$HOME/.config/gemini`
- `$HOME/.gemini`

### OAuth Token Files
- `oauth_creds.json`
- `auth.json`
- `settings.json`
- `auth/tokens.json`

## API Integration
- Input validation and sanitization
- Response formatting and error handling
- Status code management (0=success, 1=auth error, 2=usage error, 3=runtime error)
- Environment variable harmonization
- Interactive authentication flows

## Integration Points
### Consumes
- External AI service APIs (Gemini, Codex, Qwen)
- Authentication credentials and tokens
- Environment configuration

### Provides
- Standardized CLI interfaces for AI services
- Authentication management and diagnostics
- Error handling and status reporting
- Integration endpoints for MCP orchestration
- Fallback strategies for service unavailability

## Configuration
Required environment variables:
- `GEMINI_API_KEY` / `GOOGLE_API_KEY` - Gemini API authentication
- `GOOGLE_APPLICATION_CREDENTIALS` - Google ADC credentials file
- `GEMINI_CONFIG_DIR` - Custom config directory
- `GEMINI_CLI_CMD` - Gemini CLI command (default: gemini)
- `GEMINI_CLI_ARGS` - Additional CLI arguments
- Service-specific API keys and endpoints for Codex and Qwen

## Key Patterns
- Multi-method authentication with priority detection
- Environment variable harmonization for compatibility
- Interactive authentication flows with token persistence
- Comprehensive error handling with diagnostic output
- Standardized exit codes for integration
- Config directory discovery with fallback strategies

## Related Documentation
- Gemini CLI authentication setup
- OAuth flow configuration
- MCP integration patterns
- Authentication troubleshooting guides