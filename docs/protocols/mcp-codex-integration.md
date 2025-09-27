# MCP Codex Integration Protocol

## Overview
Protocollo per l'integrazione completa del server MCP OpenAI Codex nel workflow DevFlow Foundation, sostituendo la comunicazione manuale con task delegation strutturata.

## MCP Tools Available
- `mcp__openai_codex__codex_completion`: General prompt-based generation
- `mcp__openai_codex__write_code`: Generate code in specific languages  
- `mcp__openai_codex__explain_code`: Provide detailed code explanations
- `mcp__openai_codex__debug_code`: Identify and fix code issues

## Task Delegation Protocol

### 1. Task Classification
Prima di delegare, classificare il task:
```typescript
enum CodexTaskType {
  FOUNDATION_SETUP = 'foundation_setup',     // CODEX-1A type tasks
  CORE_IMPLEMENTATION = 'core_implementation', // CODEX-1B type tasks  
  INTEGRATION = 'integration',               // CODEX-2A type tasks
  TESTING = 'testing',                      // CODEX-4A type tasks
  DEBUGGING = 'debugging'                   // Any debug/fix tasks
}
```

### 2. MCP Task Execution Template
```typescript
// Standard execution pattern
async function executeCodexTask(taskSpec: CodexTaskSpec) {
  // 1. Prepare structured context
  const context = {
    task_id: taskSpec.id, // Format: CODEX-[SPRINT][PHASE]
    objective: taskSpec.objective,
    technical_requirements: taskSpec.requirements,
    implementation_guidelines: taskSpec.guidelines,
    expected_deliverables: taskSpec.deliverables
  };
  
  // 2. Select appropriate MCP tool
  const tool = selectMCPTool(taskSpec.type);
  
  // 3. Execute via MCP
  const result = await tool.execute(context);
  
  // 4. Validate output
  const validation = await validateCodexOutput(result);
  
  // 5. Persist to memory system
  await persistToDevFlowMemory(result, validation);
  
  return result;
}
```

### 3. Tool Selection Matrix
| Task Type | Primary Tool | Secondary Tool | Use Case |
|-----------|--------------|----------------|----------|
| Foundation Setup | `write_code` | `codex_completion` | Package.json, tsconfig, setup files |
| Core Implementation | `write_code` | `explain_code` | Business logic, algorithms |
| Integration | `codex_completion` | `debug_code` | API integration, glue code |
| Testing | `write_code` | `debug_code` | Test suites, validation |
| Debugging | `debug_code` | `explain_code` | Error analysis, fixes |

### 4. Context Structure Standards
```typescript
interface MCPCodexContext {
  task_id: string;                    // CODEX-[SPRINT][PHASE]
  objective: string;                  // Clear, concise goal
  technical_requirements: string[];   // Specific technical constraints
  implementation_guidelines: string[]; // Best practices, patterns
  expected_deliverables: string[];    // Specific files/functions
  
  // Optional context-specific fields
  existing_code?: string;             // For debug/explain tasks
  language?: string;                  // For write_code tasks
  framework?: string;                 // Framework-specific requirements
  dependencies?: string[];            // Required dependencies
}
```

## DevFlow Foundation Sprint Integration

### Sprint 1 - Foundation Setup
**CODEX-1A: Project Foundation Setup**
```typescript
const codex1A: CodexTaskSpec = {
  id: "CODEX-1A",
  type: CodexTaskType.FOUNDATION_SETUP,
  objective: "Setup complete DevFlow monorepo foundation with TypeScript, pnpm workspaces, and tooling",
  requirements: [
    "pnpm workspaces configuration",
    "TypeScript strict mode with project references",
    "ESLint v9 + @typescript-eslint v8 compatibility",
    "Vitest testing framework setup",
    "Build scripts for all packages"
  ],
  deliverables: [
    "package.json with workspace configuration",
    "Root tsconfig.json with project references", 
    "eslint.config.js with v9 flat config",
    "vitest.config.ts for testing",
    "packages/core/package.json",
    "packages/claude-adapter/package.json",
    "packages/openrouter-gateway/package.json"
  ]
};
```

**CODEX-1B: Memory System Core Implementation**
```typescript
const codex1B: CodexTaskSpec = {
  id: "CODEX-1B", 
  type: CodexTaskType.CORE_IMPLEMENTATION,
  objective: "Implement core memory system with SQLite, better-sqlite3, and 4-layer architecture",
  requirements: [
    "SQLite database with JSON1 and FTS5 extensions",
    "Type-safe query builders with better-sqlite3", 
    "4-layer memory hierarchy implementation",
    "Vector embedding support for semantic search",
    "Database migrations system"
  ],
  deliverables: [
    "packages/core/src/memory/database.ts",
    "packages/core/src/memory/schema.sql", 
    "packages/core/src/memory/queries.ts",
    "packages/core/src/memory/types.ts",
    "packages/core/migrations/001_initial_schema.sql"
  ]
};
```

### Execution Workflow
1. **Task Preparation**: Claude Code analizza requirements e prepara context
2. **MCP Delegation**: Task delegato via MCP tool appropriato
3. **Output Validation**: Claude Code verifica completezza e correttezza
4. **Integration**: Files integrati nel progetto con testing
5. **Memory Persistence**: Risultati salvati nel DevFlow memory system
6. **Progress Update**: Work log e current_task.json aggiornati

## Error Handling & Fallbacks
```typescript
interface CodexExecutionResult {
  success: boolean;
  output?: string;
  error?: {
    type: 'mcp_error' | 'validation_error' | 'integration_error';
    message: string;
    recovery_action: string;
  };
}

// Fallback strategies
const fallbackStrategies = {
  mcp_error: 'Retry with simplified context',
  validation_error: 'Request explanation and correction',
  integration_error: 'Manual integration with Claude Code guidance'
};
```

## Success Metrics
- **Task Completion Rate**: % task successfully delegated and integrated
- **Output Quality**: Code quality, adherence to requirements
- **Integration Speed**: Time from MCP execution to working integration
- **Error Resolution**: Success rate of error handling and recovery

## Next Phase Preparation
Questo protocollo sarà esteso per:
- Sprint 2: Claude Code Integration (CODEX-2A, CODEX-2B, CODEX-2C)
- Sprint 3: OpenRouter Integration (CODEX-3A, CODEX-3B, CODEX-3C) 
- Sprint 4: Integration & Testing (CODEX-4A, CODEX-4B, CODEX-4C)