# DevFlow Enhanced MCP Server - Usage Guide

## 🚀 Overview

Il DevFlow Enhanced MCP Server risolve il problema critico del **double token processing** introducendo capacità di **Direct File Operations** per i modelli Synthetic.new, bypassando completamente l'uso di token Claude per le modifiche ai file.

### Key Benefits

- ✅ **70-90% Riduzione Token Claude** per operazioni su file
- ✅ **Direct Code Implementation** senza intermediari
- ✅ **Batch Processing** per ottimizzare chiamate Synthetic
- ✅ **Autonomous File Operations** con backup automatici
- ✅ **Token Efficiency Monitoring** integrato

## 📋 Available Tools

### 1. `synthetic_auto_file` - Autonomous File Operations

**REVOLUTIONARY**: Genera codice E lo applica direttamente ai file, bypassando Claude.

```bash
# Comando Claude Code
/synthetic-auto-file "Add error handling to all API endpoints in packages/core/src/gateway/"
```

**Parametri:**
- `task_id`: Identificatore univoco (es. DEVFLOW-AUTO-FILE-001)
- `request`: Descrizione del task da eseguire
- `target_files`: Array di file da modificare (opzionale, auto-detect)
- `dry_run`: Preview senza applicare modifiche (default: false)
- `create_backup`: Backup automatici (default: true)

**Output Example:**
```
# 🚀 AUTONOMOUS FILE OPERATION COMPLETED - DEVFLOW-AUTO-FILE-001

## Files Modified
- packages/core/src/gateway/api-handler.ts: SUCCESS
- packages/core/src/gateway/error-handler.ts: SUCCESS

## Token Efficiency Report
- Synthetic Generation: 2,400 tokens
- Claude File Operations: 0 tokens ✅ (BYPASSED)
- Estimated Token Savings: ~1,200 tokens
- Cost Efficiency: Direct file modification without Claude processing
```

### 2. `synthetic_batch_code` - Batch Processing

**OPTIMIZATION**: Processa file correlati in una singola chiamata Synthetic.

```bash
# Modifica multipli file in batch
/synthetic-batch-code "Refactor authentication system across user management files"
```

**Vantaggi Batch:**
- **Single API Call** instead of multiple calls
- **Context Sharing** tra file correlati
- **60-80% Reduction** in total API calls
- **Consistent Patterns** across all files

### 3. `synthetic_file_analyzer` - File Analysis

**INTELLIGENCE**: Analizza file esistenti prima delle modifiche.

```bash
/synthetic-file-analyzer "Analyze TypeScript error patterns in core memory system"
```

## 💡 Usage Patterns & Best Practices

### Pattern 1: Direct File Modification (Highest Efficiency)

```bash
# Instead of:
/synthetic-code "Generate error handling for API"
# Then Claude manually applying the code...

# Use:
/synthetic-auto-file "Add comprehensive error handling to packages/core/src/api/"
```

**Token Savings**: ~800 tokens per file (70% reduction)

### Pattern 2: Batch Operations (Call Optimization)

```bash
# Instead of multiple separate calls:
/synthetic-code "Fix file1"
/synthetic-code "Fix file2"  
/synthetic-code "Fix file3"

# Use single batch:
/synthetic-batch-code "Fix TypeScript errors in authentication system files"
```

**API Call Reduction**: 3 calls → 1 call (66% reduction)

### Pattern 3: Analysis + Implementation

```bash
# Step 1: Analyze
/synthetic-file-analyzer "packages/core/src/memory/" "Find performance bottlenecks"

# Step 2: Implement fixes
/synthetic-auto-file "Optimize memory management performance based on analysis"
```

## 🔧 Configuration

### Environment Variables

```bash
# In .env or Claude Code MCP config
DEVFLOW_PROJECT_ROOT="/Users/fulvioventura/devflow"
AUTONOMOUS_FILE_OPERATIONS="true"           # Enable direct file ops
REQUIRE_APPROVAL="false"                    # Skip approval for automation
CREATE_BACKUPS="true"                       # Automatic backups
ALLOWED_FILE_EXTENSIONS=".ts,.js,.json,.md" # Security whitelist
```

### Security Settings

**Path Restrictions**: Only files within `DEVFLOW_PROJECT_ROOT` are accessible
**Extension Whitelist**: Only specified file types can be modified
**Backup System**: Automatic backups with timestamps
**Dry Run Mode**: Preview changes without applying

## 📊 Token Efficiency Monitoring

### Real-time Monitoring

```bash
# View efficiency in real-time
node scripts/token-efficiency-monitor.js report
```

### Expected Savings

| Operation Type | Token Savings | Use Case |
|----------------|---------------|----------|
| `synthetic_auto_file` | 70-90% | Direct code implementation |
| `synthetic_batch_code` | 60-80% | Multiple related files |
| `synthetic_file_analyzer` | 40-60% | Analysis before changes |

### Cost Analysis

**Traditional Workflow:**
- Synthetic generation: 1,500 tokens ($0.03)
- Claude implementation: 2,000 tokens ($0.06)
- **Total per file: $0.09**

**Enhanced Workflow:**
- Synthetic auto_file: 1,500 tokens ($0.03)
- Claude implementation: 0 tokens ($0.00)
- **Total per file: $0.03** ✅ **67% savings**

## 🎯 Real-World Examples

### Example 1: Bug Fix Implementation

**Traditional Approach:**
```bash
/synthetic-code "Fix memory leak in semantic search"
# Claude processes response, creates files (2,500 tokens)
# Manual file creation and editing
```

**Enhanced Approach:**
```bash
/synthetic-auto-file "Fix memory leak in packages/core/src/memory/semantic.ts"
# Direct implementation (1,200 tokens total) ✅
```

**Result**: 52% token reduction + zero manual intervention

### Example 2: Feature Development

**Traditional Approach:**
```bash
/synthetic-code "Add user authentication API"
/synthetic-code "Add user model"
/synthetic-code "Add auth middleware"
# 3 separate calls + manual Claude implementations (6,000+ tokens)
```

**Enhanced Approach:**
```bash
/synthetic-batch-code "Implement complete user authentication system with API, model, and middleware"
# Single batch call + direct implementation (2,800 tokens total) ✅
```

**Result**: 53% token reduction + 67% fewer API calls

### Example 3: Refactoring Project

**Traditional Approach:**
```bash
# Multiple separate operations across many files
# Heavy Claude token usage for each file modification
```

**Enhanced Approach:**
```bash
/synthetic-file-analyzer "packages/core/src/" "Identify refactoring opportunities"
/synthetic-batch-code "Apply consistent refactoring patterns across core package"
```

**Result**: Systematic refactoring with minimal Claude token usage

## 🚦 Migration Guide

### Step 1: Enable Enhanced MCP Server

Update your Claude Code configuration to use the enhanced server:

```json
{
  "mcpServers": {
    "devflow-synthetic-enhanced": {
      "command": "node",
      "args": ["/Users/fulvioventura/devflow/mcp-servers/synthetic/dist/enhanced-index.js"],
      "env": {
        "AUTONOMOUS_FILE_OPERATIONS": "true",
        "REQUIRE_APPROVAL": "false",
        "CREATE_BACKUPS": "true"
      }
    }
  }
}
```

### Step 2: Start Using New Commands

Replace existing patterns:
- `synthetic_code` → `synthetic_auto_file` (when modifying files)
- Multiple calls → `synthetic_batch_code` (for related files)
- Add `synthetic_file_analyzer` before major changes

### Step 3: Monitor Efficiency

```bash
# Track your token savings
node scripts/token-efficiency-monitor.js report
```

## ⚠️ Safety Features

### Automatic Backups
Every file modification creates timestamped backup:
```
original-file.ts → original-file.ts.backup-2025-01-15T10-30-00-000Z
```

### Dry Run Mode
Test operations without applying changes:
```bash
/synthetic-auto-file --dry-run "Preview changes to authentication system"
```

### Path Security
Only files within project root are accessible, with extension whitelisting.

### Approval Mode
Enable `REQUIRE_APPROVAL=true` for production environments.

## 🎉 Expected Results

After implementing the Enhanced MCP Server:

- **70-90% Reduction** in Claude token usage for file operations
- **60-80% Reduction** in Synthetic API calls via batching
- **Near-zero manual intervention** for code implementation
- **Consistent code quality** through automated patterns
- **Significant cost savings** on API usage
- **Faster development cycles** with direct implementation

---

*The Enhanced MCP Server transforms DevFlow from a generate-then-implement workflow to a generate-and-implement-directly system, eliminating the token waste bottleneck while maintaining full control and safety.*

## 🔗 Codex MCP Integration (Native)

### Overview

Oltre ai server Synthetic, DevFlow può integrare direttamente il Codex CLI di OpenAI come MCP server nativo. Questo elimina wrapper legacy e semplifica la configurazione in Claude Code.

### Prerequisiti

- Codex CLI installato e nel PATH:
  - `npm i -g @openai/codex` oppure `brew install codex`

### Configurazione (project-level)

Aggiungi/assicurati del seguente blocco in `.mcp.json` del progetto:

```json
{
  "mcpServers": {
    "codex-cli": {
      "command": "codex",
      "args": ["mcp"],
      "env": {}
    }
  }
}
```

Questo avvia il server MCP nativo di Codex (`codex mcp`), pienamente compatibile con Claude Code via stdio.

### Rimozione implementazione legacy (facoltativa ma consigliata)

Se in passato era presente un server “openai-codex” basato su Python/HTTP:

- Rimuovilo dall’elenco MCP di Claude: `claude mcp remove openai-codex`.
- Non è più necessario il wrapper `~/openai-codex-mcp` a meno che non serva come tool HTTP separato.

### Verifica

- In Claude Code esegui `/mcp`: dovresti vedere `codex-cli` con stato “Connected”.
- Se non appare, verifica che `codex` sia nel PATH e riavvia Claude Code.

### Utilizzo

- Il server espone strumenti MCP nativi di Codex (ad es. `codex`, `codex-reply`).
- Claude Code potrà usarli per attività di generazione/spiegazione/debug del codice come tool MCP.
- Per prove manuali avanzate, usa l’MCP Inspector con `npx @modelcontextprotocol/inspector codex mcp` (vedi documentazione Codex).

### Riferimenti Ufficiali

- Repository Codex CLI: https://github.com/openai/codex
- Sezione “Model Context Protocol (MCP)”: docs/advanced.md nel repository Codex
