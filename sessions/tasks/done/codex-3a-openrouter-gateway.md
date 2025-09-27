# CODEX TASK 3A: OpenRouter Gateway Implementation

## Context & Objective
Implementare gateway per OpenRouter API con support per multiple models, context injection automatica e cost optimization. Questo componente sarà il bridge finale per completare il Claude Code ↔ OpenRouter handoff seamless, abilitando intelligent model routing e cost tracking.

**Sprint 3 Focus**: API gateway + model coordination + intelligent routing

**CRITICAL**: OpenRouter API Key available - OPEN_ROUTER_API_KEY=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

## Technical Requirements

### OpenRouter API Integration
- **API Client**: TypeScript client per OpenRouter API con full type safety
- **Model Support**: Support per multiple models (Claude, GPT-4, Gemini, etc.)
- **Context Injection**: Automatic context insertion da Claude Code adapter
- **Request/Response Handling**: Robust error handling e retry logic
- **Authentication**: Secure API key management con environment variables

### Model Routing & Selection
- **Task Classification**: Rule-based routing algorithm per model selection
- **Model Selection Criteria**: Cost, performance, capabilities-based routing
- **Cost Optimization**: Intelligent routing al modello più cost-effective
- **Performance Monitoring**: Track response times e success rates
- **Fallback Logic**: Model fallback strategies per high availability

### Cost Tracking & Analytics
- **Cost Tracking**: Real-time API cost monitoring e accumulation
- **Usage Analytics**: Track token usage, request counts, model preferences
- **Cost Optimization**: Analyze e recommend cost-saving strategies
- **Budget Management**: Optional budget limits e alerting
- **Reporting**: Cost reports e analytics dashboard ready

## Implementation Guidelines

### Code Quality Standards
- **TypeScript strict mode** compliance al 100%
- **API client patterns** con proper error handling e retries
- **Environment security** - no hardcoded API keys
- **Rate limiting** respect per OpenRouter API limits
- **Unit tests** per ogni component (target 90% coverage)
- **Integration tests** con mock API responses

### API Integration Patterns
- **Fetch API**: Modern fetch-based HTTP client con timeout management
- **Exponential Backoff**: Retry logic per transient failures
- **Rate Limiting**: Respect OpenRouter rate limits con queuing
- **Response Validation**: Zod schemas per API response validation
- **Error Categorization**: Distinguish user, system, e API errors

### Architecture Integration
- **Memory System**: Integration con Claude Code adapter per context
- **Configuration**: Environment-based model preferences e settings
- **Logging**: Structured logging per API calls e debugging
- **Metrics**: Performance metrics collection e monitoring
- **Security**: Secure API key handling e transmission

## Expected Deliverables

### Core Implementation Files
```
packages/adapters/openrouter/src/
├── gateway.ts                 # Main OpenRouter gateway class
├── client/
│   ├── api-client.ts          # HTTP client wrapper
│   ├── auth.ts                # Authentication handling
│   ├── rate-limiter.ts        # Rate limiting logic
│   └── retry.ts               # Retry logic with backoff
├── models/
│   ├── model-config.ts        # Model configurations
│   ├── model-selector.ts      # Model selection logic
│   ├── task-classifier.ts     # Task classification
│   └── capabilities.ts        # Model capabilities mapping
├── routing/
│   ├── router.ts              # Main routing logic
│   ├── cost-optimizer.ts      # Cost optimization
│   ├── performance-tracker.ts # Performance monitoring
│   └── fallback.ts            # Fallback strategies
├── analytics/
│   ├── cost-tracker.ts        # Cost tracking
│   ├── usage-tracker.ts       # Usage analytics
│   └── reporter.ts            # Analytics reporting
└── index.ts                   # Main package exports
```

### API Integration Components
- **OpenRouter Client**: Complete API client con all endpoints
- **Model Management**: Configuration e selection per available models
- **Request Pipeline**: Context injection → Model selection → API call → Response processing
- **Error Handling**: Comprehensive error scenarios con graceful degradation
- **Cost Management**: Real-time cost tracking con optimization recommendations

### Testing Suite
- **Unit Tests**: Ogni component con comprehensive coverage
- **API Integration Tests**: Mock OpenRouter API responses
- **Cost Calculation Tests**: Verify cost tracking accuracy
- **Model Selection Tests**: Validate routing logic
- **Error Scenario Tests**: Network failures, API errors, rate limits

### Configuration & Setup
- **Environment Variables**: OPEN_ROUTER_API_KEY, model preferences, budgets
- **Model Configuration**: Available models, costs, capabilities
- **Routing Rules**: Task classification rules e model selection criteria
- **Performance Targets**: Response time targets e optimization settings
- **Security Configuration**: API key rotation, secure storage

## Success Criteria

### Functional Requirements
- [x] **OpenRouter API Integration**: Successful connection e communication con OpenRouter (client con timeout+retry, validazione risposta)
- [x] **Multiple Model Support**: Support per almeno 3 modelli (Claude 3 Sonnet, GPT-4o mini, Gemini 1.5 Pro)
- [ ] **Context Injection**: Automatic context da Claude Code adapter integration (gateway pronto, wiring E2E in CODEX-4A)
- [x] **Model Routing**: Intelligent model selection basato su task type e cost (classifier+selector+fallback)
- [x] **Cost Tracking**: Real-time cost monitoring e accumulation (usage+cost tracker, reporter)
- [x] **Error Handling**: Robust handling di API errors, rate limits, network issues (retry/backoff + rate limiter)
- [ ] **Performance Optimization**: Response times <2s per API calls (da validare E2E)

### Technical Validation
- [~] **Build Success**: Pacchetto `@devflow/openrouter` builda isolato; build monorepo ok con gating test nativi (`SKIP_NATIVE=1`)
- [ ] **Type Check**: `pnpm type-check` completo (da eseguire e sanare globalmente)
- [ ] **Lint Check**: `pnpm lint` zero errori (da eseguire globalmente)
- [ ] **Unit Tests**: >90% coverage (unit pronti; coverage da misurare)
- [x] **API Integration Tests**: Mock OpenRouter responses (gateway happy-path test)
- [ ] **Cost Accuracy**: Validazione con real API calls (non eseguibile in sandbox)

### Integration Readiness
- [ ] **Claude Code Integration**: Seamless handoff da Claude Code adapter (next: CODEX-4A)
- [ ] **End-to-End Workflow**: Complete Claude Code → context save → OpenRouter handoff
- [ ] **Cost Optimization**: Demonstrable cost savings through intelligent routing
- [ ] **Performance Targets**: API response times meet <2s target
- [ ] **Production Ready**: Error handling, logging, monitoring complete

---

## Progress Update (2025-09-09)
- Implementati gateway, client HTTP, routing intelligente, fallback, rate limiting, analytics (costi/uso/perf), reporter.
- Test unitari verdi su gateway; test DB nativi skippati in sandbox con `SKIP_NATIVE=1`.
- Sicurezza: chiavi solo via env; nessuna esposizione in codice.
- Prossimo step: collegamento E2E con Claude Adapter e test d’integrazione (CODEX‑4A).

## Technical Context

### OpenRouter API Details
- **Base URL**: https://openrouter.ai/api/v1
- **Authentication**: Bearer token con API key
- **Models Available**: Claude-3, GPT-4, Gemini-Pro, etc.
- **Rate Limits**: Respect per-model rate limits
- **Cost Structure**: Variable pricing per model e token usage

### Model Selection Criteria
```typescript
interface ModelSelectionCriteria {
  taskType: TaskType;           // 'coding' | 'analysis' | 'creative' | 'reasoning'
  complexity: 'low' | 'medium' | 'high';
  costPriority: number;         // 0-1 scale, higher = more cost sensitive
  performancePriority: number;  // 0-1 scale, higher = need faster response
  contextSize: number;          // Token count for context
}
```

### Integration Flow
```
Claude Code Session Start
       ↓
Context Extracted (Claude Adapter)
       ↓
Task Classified (OpenRouter Gateway)
       ↓
Model Selected (Cost + Performance optimization)
       ↓
Context Injected + API Call
       ↓
Response Processed + Cost Tracked
       ↓
Results Returned to Claude Code
```

## Performance Requirements

### API Response Targets
- **Model Selection**: <50ms per selection decision
- **Context Injection**: <100ms per context preparation
- **API Call Latency**: <2s per OpenRouter API call
- **Cost Calculation**: <10ms per cost update
- **Error Recovery**: <500ms per retry attempt

### Resource Efficiency
- **Memory Usage**: <100MB additional memory for gateway
- **Network Optimization**: Request batching where possible
- **Cache Strategy**: Response caching per repeated queries
- **Rate Limit Respect**: Queue management per avoid API throttling

## Security & Environment Setup

### Environment Variables Required
```bash
# Required
OPEN_ROUTER_API_KEY=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

# Optional
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MAX_RETRIES=3
OPENROUTER_TIMEOUT_MS=30000
OPENROUTER_COST_BUDGET_USD=100
OPENROUTER_PREFERRED_MODELS=claude-3-sonnet,gpt-4,gemini-pro
```

### Security Considerations
- **API Key Security**: Environment variables only, no hardcoding
- **Request Validation**: Validate all inputs before API calls
- **Error Information**: Don't expose API keys in error messages
- **Logging Security**: Sanitize logs from sensitive information

## Report Template

Al completamento, fornire report strutturato con:

### Implementation Summary
- OpenRouter API integration results
- Model support e selection logic implemented
- Context injection pipeline working
- Cost tracking e analytics capabilities

### API Integration Results
- OpenRouter API connection validation
- Model availability e response testing
- Context injection success rates
- Cost calculation accuracy verification

### Performance Benchmarks
- API response times measured
- Model selection performance
- Cost optimization effectiveness
- Error handling resilience testing

### Next Steps Recommendations
- End-to-end integration testing (CODEX-4A preparation)
- Performance optimization opportunities
- Additional models che potrebbero essere beneficial
- Cost optimization refinements needed

### Memory Context for Persistence
```json
{
  "task": "CODEX-3A",
  "component": "openrouter-gateway",
  "integration_points": ["claude-adapter", "openrouter-api"],
  "key_features": ["model-routing", "cost-tracking", "context-injection"],
  "api_integration": "openrouter",
  "next_milestone": "end-to-end-testing"
}
```

---

**Target Completion**: 3-4 giorni di focused implementation  
**Dependencies**: CODEX-2A Claude Code Adapter (✅ Complete)
**API Key**: OPEN_ROUTER_API_KEY provided e ready for integration
**Next Task**: CODEX-4A End-to-End Integration Testing
