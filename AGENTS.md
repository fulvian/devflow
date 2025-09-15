# DevFlow Repository Guidelines for AI Agents

## 🎯 Project Mission & Context
**DevFlow** is a Universal Development State Manager that eliminates AI tools "digital amnesia" through persistent memory and intelligent coordination. This repository implements Phase 0: Foundation & Proof of Concept with 30% token reduction target through memory persistence and cross-platform coordination.

**Agent Roles:**
- **Claude Code**: Team Leader & Software Architect (system design, coordination, quality assurance)
- **Codex**: Senior Implementation Specialist (mass coding, pattern implementation, technical execution)
- **DevFlow Orchestrator**: Central API hub for external AI agents at `http://localhost:3005`

## 🔗 DevFlow Integration for External Agents

### Available Services via Orchestrator API
- **Synthetic Agents**: Code generation, reasoning, context analysis
- **Semantic Memory**: Vector search and knowledge persistence
- **Task Management**: Hierarchical task creation and tracking
- **Session Management**: Context persistence across interactions

### Authentication
All API endpoints require Bearer token:
```
Authorization: Bearer devflow-orchestrator-token
```

### Integration Commands for Codex/Gemini

#### Code Generation via DevFlow
```bash
curl -X POST http://localhost:3005/api/synthetic/code \
  -H "Authorization: Bearer devflow-orchestrator-token" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create TypeScript function", "context": {...}}'
```

#### Semantic Memory Access
```bash
curl -X POST http://localhost:3005/api/memory/query \
  -H "Authorization: Bearer devflow-orchestrator-token" \
  -H "Content-Type: application/json" \
  -d '{"query": "patterns", "limit": 5}'
```

#### Task Creation
```bash
curl -X POST http://localhost:3005/api/tasks \
  -H "Authorization: Bearer devflow-orchestrator-token" \
  -H "Content-Type: application/json" \
  -d '{"title": "Feature X", "priority": "high"}'
```

## 🏗️ Project Structure & Module Organization

### **Monorepo Architecture**
Root workspace managed by `pnpm` with Node 20+ and strict TypeScript configuration:

```
devflow/
├── packages/
│   ├── core/                    # @devflow/core - Memory system & coordination engine
│   │   ├── src/
│   │   │   ├── database/        # SQLite schema, migrations, queries
│   │   │   ├── memory/          # 4-layer memory management system
│   │   │   ├── routing/         # Intelligent task routing
│   │   │   └── coordination/    # Cross-platform orchestration
│   │   └── package.json
│   ├── shared/                  # @devflow/shared - Shared types & utilities
│   │   ├── src/types/          # TypeScript interfaces (memory.ts, platform.ts)
│   │   └── schemas/            # Zod validation schemas
│   └── adapters/               # Platform-specific integrations
│       ├── claude-code/        # @devflow/claude-adapter - cc-sessions integration
│       └── openrouter/         # @devflow/openrouter-gateway - API gateway
├── docs/                       # Documentation & architectural decisions
│   ├── idee_fondanti/         # Foundational vision documents
│   ├── sviluppo/              # Development plans & agent profiles
│   └── architecture/          # Technical architecture docs
├── sessions/                   # cc-sessions integration (tasks, protocols)
├── tests/                     # Integration & E2E tests
└── tools/                     # Development utilities & benchmarks
```

### **Package Dependencies Architecture**
- **core**: Database operations, memory management, coordination logic
- **shared**: Type definitions, validation schemas, common utilities
- **adapters/claude-code**: cc-sessions hooks integration, context management
- **adapters/openrouter**: API gateway, model routing, cost optimization

## 🛠️ Build, Test, and Development Commands

### **Primary Commands**
- `pnpm install` — Install all workspace dependencies
- `pnpm dev` — Run all package dev servers in parallel (watch mode)
- `pnpm build` — Build all packages to `dist/` with TypeScript compilation
- `pnpm test` — Run Vitest across all workspaces (coverage enabled, 80% threshold)
- `pnpm test:integration` — Run integration tests with mock APIs
- `pnpm test:e2e` — Run Playwright end-to-end tests
- `pnpm lint` — ESLint across all packages with DevFlow-specific rules
- `pnpm type-check` — TypeScript strict mode compilation check
- `pnpm clean` — Clean all package builds, caches, and temp files

### **Release & Quality Commands**
- `pnpm changeset` — Create semantic version changeset
- `pnpm version-packages` — Apply version changes
- `pnpm release` — Build and publish packages
- `prettier -w .` — Format all files (if not auto-formatted)

### **Development Workflow**
1. Start development: `pnpm dev` (enables watch mode for all packages)
2. Run tests continuously: `pnpm test --watch`
3. Before commit: `pnpm lint && pnpm type-check && pnpm test`
4. Quality gate: All commands must pass before PR submission

## 📝 Coding Style & Standards

### **Language & Framework Standards**
- **Language**: TypeScript 5.0+ with ES2022 target and strict mode
- **Modules**: ES modules (`type: "module"` in all package.json)
- **Runtime**: Node.js 20+ with modern async/await patterns
- **Database**: SQLite with JSON1, FTS5 extensions for production-ready features

### **Code Formatting (Prettier)**
- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes for strings
- **Semicolons**: Always required
- **Line width**: 80 characters (100 for markdown)
- **Trailing commas**: ES5 compatibility

### **Linting Rules (ESLint + TypeScript)**
**Strict DevFlow Rules:**
- `@typescript-eslint/no-explicit-any: error` — Never use `any` type
- `@typescript-eslint/explicit-function-return-type: warn` — Explicit return types
- `@typescript-eslint/no-unused-vars: error` — No unused variables
- `@typescript-eslint/prefer-readonly: warn` — Immutable by default
- `no-console: warn` — No console.log in production code
- `prefer-const: error` — Use const when possible
- `no-var: error` — No var declarations

### **Naming Conventions**
- **Variables/Functions**: `camelCase` (e.g., `memoryManager`, `extractContext`)
- **Types/Interfaces/Classes**: `PascalCase` (e.g., `MemoryBlock`, `TaskRouter`)
- **Files**: `kebab-case.ts` (e.g., `memory-manager.ts`, `task-router.ts`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_TIMEOUT`, `MAX_RETRIES`)
- **Test files**: `*.test.ts` or `*.spec.ts` (e.g., `memory-manager.test.ts`)

### **Import/Export Standards**
- **Named exports preferred**: `export { MemoryManager }` over `export default`
- **Import organization**: External deps → Internal deps → Types
- **Path aliases**: Use `@devflow/core`, `@devflow/shared` for cross-package imports

## 🧪 Testing Guidelines & Requirements

### **Testing Framework & Structure**
- **Primary**: Vitest (node environment) with coverage reporting
- **E2E**: Playwright for integration workflows
- **Location**: Tests live under `packages/**/src/**/*.{test,spec}.ts`
- **Mocks**: Mock APIs and external services in `tests/mocks/`

### **Coverage Requirements**
- **Global thresholds**: 80% minimum (branches, functions, lines, statements)
- **Critical paths**: 90% coverage for memory management and coordination
- **New features**: Must include comprehensive tests before PR approval

### **Testing Patterns**
```typescript
// Example test structure
describe('MemoryManager', () => {
  let memoryManager: MemoryManager;
  
  beforeEach(async () => {
    memoryManager = new MemoryManager(testConfig);
    await memoryManager.initialize();
  });
  
  afterEach(async () => {
    await memoryManager.cleanup();
  });
  
  it('should store and retrieve memory blocks', async () => {
    // Test implementation with proper assertions
  });
});
```

### **Test Commands**
- `pnpm test` — All tests with coverage
- `vitest -t "pattern"` — Focused test execution
- `pnpm test:e2e` — End-to-end workflow testing
- `npx playwright install` — Install browser dependencies (first time only)

## 📋 Agent-Specific Implementation Guidelines

### **For Codex (Senior Implementation Specialist)**

#### **Primary Responsibilities**
1. **Foundation Setup**: Implement project structure, dependencies, build configuration
2. **Core Implementation**: Database operations, memory management, business logic
3. **API Development**: Platform adapters, external integrations, error handling
4. **Testing Implementation**: Unit tests, integration tests, mock services
5. **Utility Development**: Helper functions, shared components, development tools

#### **Implementation Standards**
- **Always follow specifications**: Implement exactly what Claude Code specifies
- **Type safety first**: Use TypeScript strict mode, no `any` types
- **Error handling**: Comprehensive try/catch with structured logging
- **Performance awareness**: Use prepared statements, connection pooling, lazy loading
- **Test coverage**: Write tests alongside implementation (not after)

#### **Code Quality Checklist**
- [ ] TypeScript strict mode compliance
- [ ] ESLint passes without warnings
- [ ] Prettier formatting applied
- [ ] JSDoc comments for public APIs
- [ ] Error handling for all async operations
- [ ] Unit tests with >80% coverage
- [ ] Integration tests for external APIs
- [ ] Performance considerations documented

#### **Communication Format**
Always provide structured reports using this format:

```markdown
# CODEX IMPLEMENTATION REPORT - [TASK-ID]

## Summary
- Task: [Brief description]
- Files Created/Modified: [List with purposes]
- Dependencies Added: [List with versions]

## Implementation Details
- [Key technical decisions and rationale]
- [Challenges encountered and solutions]
- [Performance optimizations applied]

## Code Structure
[Code snippets with explanations of key components]

## Testing
- Tests implemented: [count and types]
- Coverage achieved: [percentage]
- Integration points validated: [list]

## Next Steps Recommendations
- [Suggested follow-up tasks]
- [Integration requirements]
- [Optimization opportunities]

## Memory Context for Persistence
[JSON object with implementation context for cc-sessions memory]
```

### **Database Implementation Standards**
- **Use prepared statements**: Always for performance and security
- **Transaction support**: Wrap multiple operations in transactions
- **Connection management**: Proper connection pooling and cleanup
- **Error handling**: Catch and categorize database errors appropriately
- **Query optimization**: Use EXPLAIN QUERY PLAN for complex queries

### **API Integration Standards**
- **Timeout handling**: Set reasonable timeouts for all external calls
- **Retry logic**: Implement exponential backoff for transient failures
- **Rate limiting**: Respect API rate limits with proper queuing
- **Authentication**: Secure handling of API keys and tokens
- **Response validation**: Validate API responses with Zod schemas

## 📦 Dependency Management & Security

### **Approved Dependencies**
**Core Dependencies:**
- `better-sqlite3` — SQLite database operations
- `@modelcontextprotocol/sdk` — MCP protocol implementation
- `zod` — Runtime type validation
- `@types/node` — Node.js type definitions

**Development Dependencies:**
- `vitest` — Testing framework
- `@playwright/test` — E2E testing
- `eslint` + `@typescript-eslint/*` — Code linting
- `prettier` — Code formatting
- `typescript` — Language compiler

### **Security Guidelines**
- **No secrets in code**: Use environment variables for all API keys
- **Environment variables**: Document in `docs/development/environment.md`
- **Dependency auditing**: Run `pnpm audit` regularly
- **Minimal dependencies**: Only add dependencies that are essential

## 🔄 Git Workflow & Commit Standards

### **Branch Strategy**
- **Main branch**: `main` (production-ready code)
- **Feature branches**: `feature/task-name` (following cc-sessions protocol)
- **Hotfix branches**: `hotfix/issue-description`
- **Release branches**: `release/version-number`

### **Commit Message Format (Conventional Commits)**
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature implementation
- `fix`: Bug fixes
- `docs`: Documentation changes
- `refactor`: Code refactoring without feature changes
- `test`: Adding or updating tests
- `chore`: Build process, dependency updates
- `perf`: Performance improvements

**Examples:**
- `feat(core): implement memory block storage with SQLite`
- `fix(adapters/claude-code): resolve context injection timing issue`
- `test(memory): add integration tests for context compaction`
- `docs(architecture): update database schema documentation`

### **Pull Request Requirements**
1. **Branch up to date**: Rebase on latest main
2. **Quality gates passed**: `pnpm lint && pnpm type-check && pnpm test`
3. **Tests included**: Coverage maintained or improved
4. **Documentation updated**: For API changes or new features
5. **Clear description**: What, why, and how of the changes

## 📊 Performance & Monitoring Guidelines

### **Performance Targets**
- **Database queries**: <50ms for simple queries, <200ms for complex
- **Memory operations**: <100ms for context injection/extraction
- **API responses**: <2s for cross-platform handoffs
- **Build time**: <30s for full workspace build
- **Test execution**: <10s for unit tests, <60s for integration tests

### **Monitoring & Logging**
- **Structured logging**: Use consistent log format with levels
- **Performance tracking**: Measure and log operation durations
- **Error categorization**: Distinguish between user, system, and external errors
- **Memory usage**: Track memory consumption for large operations

### **Optimization Guidelines**
- **Database**: Use indexes, prepared statements, connection pooling
- **Memory**: Lazy loading, cleanup unused objects, avoid memory leaks
- **Network**: Connection reuse, request batching, proper timeouts
- **Build**: Incremental compilation, parallel processing

## 🎯 Success Metrics & Quality Gates

### **Code Quality Metrics**
- **TypeScript strict compliance**: 100%
- **ESLint compliance**: 0 errors, minimal warnings
- **Test coverage**: >80% overall, >90% for critical paths
- **Documentation coverage**: All public APIs documented
- **Performance benchmarks**: Meet established targets

### **Project Success Criteria**
- **Token usage reduction**: 30% improvement over baseline
- **Context handoff success**: >95% preservation accuracy
- **Cross-platform coordination**: Seamless handoffs between platforms
- **Memory persistence**: Zero loss of architectural decisions
- **Development velocity**: 40%+ faster task completion

---

**This document serves as the comprehensive guide for all AI agents contributing to the DevFlow repository. All code must meet these standards before integration.**
