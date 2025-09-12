# Synthetic API Integration Service

## Purpose
Provides production-ready integration with Synthetic.new multi-agent platform, handling OAuth2 authentication, rate limiting, and batch optimization for cost-effective API usage.

## Narrative Summary
This service implements DevFlow's connection to the Synthetic.new platform, enabling seamless delegation of specialized tasks to different AI agents (Code Agent, Reasoning Agent, Context Agent, Auto Agent). The implementation focuses on production readiness with comprehensive error handling, token management, and rate limiting compliance (135 requests per 5-hour window).

## Key Files
- `synthetic-api-client.ts` - Main client with OAuth2, rate limiting, batch processing
- `synthetic-embedding-integration.ts` - Production embedding model for semantic memory
- `../config/synthetic-api-config.ts` - Configuration management
- `../tests/integration/synthetic-api-integration.test.ts` - Integration tests

## API Integration Points
### Consumes
- Synthetic.new OAuth2 endpoints: `/oauth/token`
- Synthetic.new task delegation endpoints
- Rate limit compliance: 135 requests/5h

### Provides
- `SyntheticApiClient` class: Authenticated API client with batch processing
- `SyntheticEmbeddingModel` class: Cost-optimized embedding generation
- OAuth2 token management with automatic refresh
- Request batching and retry logic with exponential backoff

## Configuration
Required environment variables:
- `SYNTHETIC_API_URL` - Base API URL
- `SYNTHETIC_API_KEY` - API authentication key
- `SYNTHETIC_CLIENT_ID` - OAuth2 client identifier
- `SYNTHETIC_CLIENT_SECRET` - OAuth2 client secret

## Key Patterns
- OAuth2 client credentials flow (synthetic-api-client.ts:174-215)
- Rate limiting with sliding window (synthetic-api-client.ts:460-510)
- Batch processing for cost optimization (synthetic-api-client.ts:515-634)
- Production error handling with custom error types (synthetic-api-client.ts:62-91)
- Embedding batch processing with retry logic (synthetic-embedding-integration.ts:50-123)

## Related Documentation
- `../memory-bridge/CLAUDE.md` - Memory bridge protocols
- `../semantic-memory/CLAUDE.md` - Vector embedding integration
- `../../cognitive/CLAUDE.md` - Cognitive engine interfaces