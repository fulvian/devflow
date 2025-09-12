# Core Utilities Service

## Purpose
Provides shared utility functions and services for the DevFlow system, including logging, error handling, and common helper functions.

## Narrative Summary
This service contains foundational utilities used across all DevFlow services. The logger implementation provides structured logging with context separation, enabling better debugging and monitoring across the distributed cognitive system.

## Key Files
- `logger.ts` - Context-aware logging utility with structured output (core/utils/logger.ts:1-27)

## Core Components
### Logger Utility
- Context-based logging with service identification
- Structured log output with timestamps and metadata
- Multiple log levels: info, warn, error, debug
- Console-based output with ISO timestamp formatting

## Integration Points
### Provides
- Logger class: Context-aware logging service
- Structured log formatting with timestamps
- Service-specific log context identification

### Used By
- All DevFlow services for consistent logging
- Error handling and debugging workflows
- Performance monitoring and troubleshooting

## Configuration
- Log context: Service-specific identification
- Output format: ISO timestamp with structured metadata
- Log levels: Standard info/warn/error/debug hierarchy

## Key Patterns
- Context-based logger instantiation (logger.ts:8-10)
- Structured metadata support for all log levels
- Consistent timestamp formatting across services
- Simple console-based output for development

## Usage Example
```typescript
import { Logger } from '../utils/logger';
const logger = new Logger('ServiceName');
logger.info('Operation completed', { duration: 150, items: 5 });
```

## Related Documentation
- Used across all service CLAUDE.md files
- Essential for debugging and monitoring DevFlow operations