# CLAUDE.md - Comprehensive DevFlow Enforcement Protocol

## Table of Contents
0. [Database Architecture - CRITICAL](#database-architecture---critical)
1. [Collaboration Philosophy](#collaboration-philosophy)
2. [Task Management Framework](#task-management-framework)
3. [Synthetic Delegation Protocol](#synthetic-delegation-protocol)
4. [MCP Integration Standards](#mcp-integration-standards)
5. [Enforcement Rules](#enforcement-rules)
6. [Verification Mechanisms](#verification-mechanisms)
7. [Database Management Requirements](#database-management-requirements)
8. [Anti-Circumvention Measures](#anti-circumvention-measures)
9. [DevFlow Architecture Alignment](#devflow-architecture-alignment)
10. [Penalty System](#penalty-system)

---

## Database Architecture - CRITICAL

### ✅ CURRENT DATABASE (Use This ONLY)
- **Database**: `./data/devflow_unified.sqlite`
- **Environment**: `DEVFLOW_DB_PATH=./data/devflow_unified.sqlite`
- **Migration Completed**: 2025-09-22
- **Records Migrated**: 161 total records from 3 legacy databases

### ❌ DEPRECATED DATABASES (Do NOT Use - BLOCKED)
- `./devflow.sqlite.DEPRECATED` - Migrated to unified DB
- `./data/devflow.sqlite.DEPRECATED` - Migrated to unified DB
- `./data/vector.sqlite.DEPRECATED` - Migrated to unified DB

### 🔒 ENFORCEMENT MECHANISMS
1. **Pre-commit Hook**: `.claude/hooks/pre-commit-legacy-db-check.sh` - BLOCKS commits with legacy DB references
2. **Validation Script**: `scripts/validate_no_legacy_db.sh` - Detects legacy references in codebase
3. **Deprecation Markers**: `*.DEPRECATED.txt` files - Clear warning documentation
4. **Environment Protection**: All services configured for unified database only

### 📊 UNIFIED DATABASE BENEFITS
- **Single Source of Truth**: No database fragmentation
- **Context7 Compliant**: Data organized in `data/` folder
- **Referential Integrity**: Full foreign key enforcement
- **Performance Optimized**: Strategic indexes and audit triggers
- **Vector Integration**: Unified embeddings with project contexts

**ANY CODE REFERENCING DEPRECATED DATABASES WILL BE BLOCKED AT COMMIT**

For rollback information: `./backups/20250922_010603/`

---

## Collaboration Philosophy

### Core Principles
1. **Transparency First**: All interactions must be fully documented and accessible to authorized stakeholders
2. **Synthetic Augmentation**: Human-AI collaboration must leverage AI capabilities to enhance human creativity
3. **Iterative Refinement**: Continuous improvement through structured feedback loops
4. **Context Preservation**: Complete historical context must be maintained for all development activities
5. **Autonomous Compliance**: Systems must self-enforce protocols without external oversight

### Collaboration Requirements
- All communication must occur through designated channels with automatic logging
- Context switching must be explicitly documented with state preservation
- Knowledge transfer must be bidirectional between human and AI participants
- Decision-making processes must be traceable to specific inputs and reasoning paths
- All stakeholders must acknowledge and accept these principles before engagement

---

## Task Management Framework

### Hierarchical Task Structure
1. **Projects** (Highest level strategic initiatives)
2. **Plans** (Multi-phase execution strategies)
3. **Roadmaps** (Timeline-based implementation sequences)
4. **Macrotasks** (Major functional components)
5. **Microtasks** (Atomic development units)
6. **Sessions** (Time-bound work periods)

### Task Lifecycle Management
- All tasks must progress through defined states: CREATED → ASSIGNED → IN_PROGRESS → REVIEW → COMPLETED
- State transitions must be explicitly triggered with justification documentation
- Task dependencies must be declared and validated before execution
- Resource allocation must be automatically optimized based on capability matching
- Completion criteria must be measurable and verifiable through automated means

### Task Assignment Protocols
- Synthetic delegation is mandatory for all coding activities
- Human participants may only provide specifications, not direct implementation
- Task ownership must be clearly assigned with accountability tracking
- Cross-task dependencies must be resolved through automated coordination
- Task prioritization must align with project-level strategic objectives

---

## Unified Orchestrator Protocol (UPDATED 2025-09-22)

### Orchestration Hierarchy (MANDATORY)
1. **Claude Sonnet**: Supremo orchestratore - unico responsabile di tutte le decisioni strategiche
2. **Unified Orchestrator**: Sistema centrale di routing e coordinamento agenti
3. **CLI Agents (Primary)**: Codex, Gemini, Qwen Code - esecuzione diretta task
4. **Synthetic Agents (Fallback)**: Qwen3 Coder, Kimi K2, GLM 4.5 - solo se CLI fallisce
5. **Cross-Verification**: Nessun agente può verificare il proprio lavoro

### Mandatory Task Flow
1. **Claude Sonnet** riceve task e specifica requisiti
2. **Unified Orchestrator** analizza task e seleziona CLI Agent ottimale
3. **CLI Agent** esegue task (Codex/Gemini/Qwen) con timeout dinamico
4. **Fallback automatico** a Synthetic specifico se CLI fallisce:
   - Codex CLI → Qwen3 Coder (Synthetic)
   - Gemini CLI → Kimi K2 (Synthetic)
   - Qwen CLI → GLM 4.5 (Synthetic)
5. **Cross-Verification** da agente diverso (no auto-verifica)

### Delegation Process

The delegation process defines how tasks are assigned and tracked within the CLAUDE system. All delegation must follow these strict procedures:

1. **Task Assignment Hierarchy**:
   - All microtasks must be assigned through the central delegation engine
   - Manual task assignment is prohibited and will trigger immediate penalties
   - Each microtask must have a single responsible agent with clear completion criteria
   - Task dependencies must be explicitly declared in the task metadata

2. **Delegation Validation**:
   - All delegations are validated against the project roadmap before execution
   - Invalid delegations (conflicting priorities, missing dependencies) are automatically rejected
   - Delegation chains must not exceed 5 levels to prevent accountability diffusion
   - Cross-project delegations require explicit approval from both project leads

3. **Delegation Tracking**:
   - All delegations are logged with timestamp, delegator, delegatee, and task context
   - Delegation modifications require cryptographic signatures from both parties
   - Failed delegation acceptance triggers automatic reassignment to backup agents
   - Delegation completion must be confirmed through the verification system

---

## MCP Integration Standards (UPDATED 2025-09-24 - CRITICAL PROTOCOL CONSOLIDATION)

### Required Orchestrator Usage (BREAKING CHANGES)
1. **MANDATORY Unified Orchestrator**: ALL coding tasks MUST use POST http://localhost:3005/api/tasks
2. **NO DIRECT AGENT CALLS**: Complete prohibition of direct CLI/Synthetic calls - SECURITY VIOLATION
3. **Task ID Standard**: DEVFLOW-[COMPONENT]-[SEQUENCE]-[TIMESTAMP] (e.g., DEVFLOW-AUTH-001-20250924)
4. **Orchestrator Flow**: Task submission → Agent selection → Execution → Cross-verification → Integration
5. **Verification Required**: MANDATORY cross-verification by different agent type before integration

### Critical Security Requirements (NEW)
- **Hook Bridge Enforcement**: All tool calls intercepted by .claude/hooks/unified-orchestrator-bridge.py
- **Direct Edit/Write/Bash Prohibition**: Must route through orchestrator for >50 lines or security-sensitive operations
- **Agent Authentication**: All orchestrator requests require DEVFLOW_API_TOKEN validation
- **Audit Trail**: Every orchestrator interaction logged with cryptographic integrity

### Operational Mode Compliance (ENHANCED)
- **all-mode**: Full stack (CLI → Synthetic fallback → Cross-verification → Claude emergency)
- **claude-only**: Solo Claude (bypass enforcement 100 righe) - DEVELOPMENT ONLY
- **cli-only**: CLI → Claude emergency (no Synthetic) - LIMITED USE CASES
- **synthetic-only**: Synthetic → Claude emergency (no CLI) - FALLBACK MODE

### Unified Orchestrator Endpoints (Port 3005) - MANDATORY INTEGRATION
- **Task Submission**: POST `http://localhost:3005/api/tasks` with authentication header
- **Mode Management**: POST `http://localhost:3005/api/mode/:modeName` for runtime mode switching
- **Performance Monitoring**: GET `http://localhost:3005/api/metrics` for real-time system health
- **Protocol Health**: GET `http://localhost:3005/api/protocols/health` for protocol consistency validation

### Anti-Circumvention for MCP
- Using Task tool to bypass line limits is PROHIBITED
- Manual file creation to avoid delegation is PROHIBITED
- Splitting large files to circumvent enforcement is PROHIBITED
- All violations trigger immediate escalation to Level 2 penalties

---

## Enforcement Rules

### 100-Line Limit Enforcement (MANDATORY)
1. **Hard Limit**: No file may exceed 100 lines - NO EXCEPTIONS without MCP approval
2. **Anti-Splitting**: Files artificially split to bypass limits trigger automatic consolidation
3. **Lexical Analysis**: Automated detection of circumvention through import patterns
4. **Enforcement Tools**: Pre-commit hooks BLOCK violations immediately
5. **Penalties**: Violations result in automatic commit rejection + Level 1 penalty

### Unified Orchestrator Enforcement (MANDATORY)
1. **ALL CODING TASKS**: Must be submitted to Unified Orchestrator system
2. **NO MANUAL CODING**: Direct code writing by humans is PROHIBITED
3. **NO DIRECT AGENT CALLS**: Bypassing orchestrator via direct CLI/Synthetic calls is PROHIBITED
4. **Operational Mode Compliance**: Must respect current mode (all-mode, claude-only, cli-only, synthetic-only)
5. **Verification Required**: All agent outputs must pass cross-verification
6. **Enforcement**: Violations trigger immediate access suspension

### Generic Task Verification Enforcement (MANDATORY - NEW)
1. **Universal Verification**: ALL task completions MUST trigger Generic Task Verification Protocol
2. **Verification Bypass Prohibition**: Disabling, skipping, or circumventing verification is PROHIBITED
3. **Resolution Plan Compliance**: User MUST approve generated resolution plans before implementation
4. **Context7 Pattern Adherence**: All verification methods MUST follow AI Dev Tasks and Weaver patterns
5. **Cross-Agent Verification**: No agent may verify its own work - different agent types required
6. **Audit Trail Maintenance**: All verification results MUST be stored with cryptographic integrity
7. **Hook Integration Mandatory**: Stop-hook MUST call Generic Task Verification Protocol
8. **Enforcement**: Verification bypass triggers immediate Level 3 penalties + task reopening

### Database Management Enforcement (MANDATORY)
1. **Automatic Tracking**: All projects-plans-roadmaps-macrotasks-microtasks-sessions MUST be auto-logged
2. **State Persistence**: Task state changes MUST update database immediately
3. **Audit Trails**: All database changes MUST have immutable audit logs
4. **Manual Intervention**: Direct database modification is PROHIBITED
5. **Enforcement**: Violations trigger automatic data restoration + penalties

---

## Verification Mechanisms

### Generic Task Verification Protocol (MANDATORY - NEW)
1. **Universal Application**: Protocol applies to ALL tasks, not specific implementations
2. **Dynamic Criteria Extraction**: Automatically reads requirements from task markdown files
3. **Context7 Integration**: Uses /snarktank/ai-dev-tasks and /typelevel/weaver-test patterns
4. **Resolution Plan Generation**: Creates structured plans requiring user approval
5. **Cross-Verification**: Different agent types verify each other's work
6. **Enforcement**: All task completions MUST pass generic verification

### Generic Protocol Components (MANDATORY)
1. **GenericTaskVerifier Class**:
   - Reads current task from `.claude/state/current_task.json`
   - Dynamically extracts verification criteria from task content
   - Performs Context7-based structured verification
   - Generates detailed findings with issues and suggestions
2. **ResolutionPlanGenerator Class**:
   - Analyzes verification results using Weaver failure reporting patterns
   - Creates time-estimated resolution plans with risk assessment
   - Presents plans for mandatory user approval before execution
   - Stores results in Cometa Brain database for audit trails
3. **Automatic Hook Integration**:
   - Triggered via `.claude/hooks/stop-hook.js` when verification enabled
   - Controlled by `.devflow/verification-trigger.json` configuration
   - 2-minute timeout for comprehensive verification
   - Fallback mechanisms for error handling

### Continuous Verification (MANDATORY)
1. **Real-time Monitoring**: All code changes trigger immediate verification
2. **Quality Gates**: Code must pass AST analysis, security scanning, and style checks
3. **Integration Testing**: All changes must pass existing test suites
4. **Performance Validation**: No performance regressions allowed
5. **Enforcement**: Verification failures BLOCK merge/deployment

### Meta-Verification (MANDATORY)
1. **User Requirement Adherence**: Verify implementation matches user specifications
2. **Architecture Compliance**: Verify alignment with DevFlow principles
3. **Plan Adherence**: Verify implementation follows project roadmaps
4. **Cross-Reference Validation**: Verify consistency across related components
5. **Enforcement**: Meta-verification failures trigger task reopening

### Verification Hooks (MANDATORY)
- **.claude/hooks/stop-hook.js**: Triggers Generic Task Verification Protocol on session completion
- **.claude/hooks/enhanced-stop-hook-with-verification.js**: Main Generic Task Verification Protocol implementation
- **.claude/hooks/subagent-stop-hook.js**: Triggers verification on subagent completion
- **.claude/hooks/intelligent-save-hook.js**: Triggers verification on code changes
- **Trigger File**: `.devflow/verification-trigger.json` activates real-time verification
- **Response Time**: Generic verification must complete within 120 seconds (2 minutes)

---

## Database Management Requirements

### Automatic Database Management (MANDATORY)
1. **Project Hierarchy**: Projects → Plans → Roadmaps → Macrotasks → Microtasks → Sessions
2. **State Tracking**: All entity state changes automatically logged with timestamps
3. **Dependency Management**: Cross-entity dependencies automatically validated
4. **Performance Metrics**: Task completion times and success rates continuously tracked
5. **Data Integrity**: Cryptographic hashes ensure data cannot be tampered with

### Session Management (MANDATORY)
1. **Session Logging**: All Claude Code sessions logged with full context
2. **Progress Tracking**: Session progress updated in real-time
3. **Context Preservation**: Session context automatically saved and restored
4. **Performance Analytics**: Session efficiency metrics continuously collected
5. **Audit Compliance**: All session data immutable and auditable

---

## Anti-Circumvention Measures

### File Splitting Detection (MANDATORY)
1. **Pattern Recognition**: Detect artificially split files through semantic analysis
2. **Import Analysis**: Flag suspicious import patterns indicating circumvention
3. **Automatic Consolidation**: Force merge of detected split files
4. **Penalty Escalation**: File splitting triggers Level 2 penalties immediately

### Manual Override Prevention (MANDATORY)
1. **Tool Restrictions**: Task tool cannot be used to bypass line limits
2. **Direct File Access**: Manual file creation/editing outside MCP tools PROHIBITED
3. **Enforcement Bypass**: Attempting to circumvent hooks triggers access suspension
4. **Security Monitoring**: All system access logged and monitored for violations

### Process Bypass Detection (MANDATORY)
1. **Hook Bypass**: Attempting to disable/modify hooks triggers immediate lockdown
2. **Verification Bypass**: Skipping verification processes triggers automatic rollback
3. **Database Bypass**: Direct database access outside approved APIs PROHIBITED
4. **Access Pattern Analysis**: Anomalous access patterns trigger security investigations

---

## DevFlow Architecture Alignment

### Architecture Compliance (MANDATORY)
1. **Component Integration**: All components must integrate with existing DevFlow services
2. **API Consistency**: All APIs must follow DevFlow patterns and conventions
3. **Data Flow**: All data transformations must align with DevFlow pipeline architecture
4. **Service Discovery**: All services must register with DevFlow service registry
5. **Configuration Management**: All configuration must use DevFlow config system

### Philosophy Alignment (MANDATORY)
1. **Collaboration First**: All implementations must enhance team collaboration
2. **Automation Priority**: Manual processes must be automated wherever possible
3. **Quality Assurance**: Quality checks must be integrated, not added as afterthoughts
4. **Security by Design**: Security must be integral to all implementations
5. **Scalability Focus**: All implementations must support horizontal scaling

---

## Penalty System

### Level 1 Penalties (Minor Violations)
- **Violations**: Line limit exceeded, minor process deviation, first-time verification failure
- **First Offense**: Automated warning + mandatory training module
- **Second Offense**: 24-hour access restriction + supervisor notification
- **Third Offense**: 7-day access restriction + mandatory compliance review

### Level 2 Penalties (Moderate Violations)
- **Violations**: Attempting Task tool bypass, file splitting, manual coding, hook tampering
- **First Offense**: 7-day access suspension + mandatory security training
- **Second Offense**: 30-day suspension + performance improvement plan
- **Third Offense**: Permanent access revocation + leadership review

### Level 3 Penalties (Severe Violations)
- **Violations**: Database tampering, security bypass, malicious circumvention, data corruption, Generic Task Verification Protocol bypass
- **Immediate Actions**: Complete access revocation + forensic investigation
- **Review Process**: Leadership review + legal assessment + organizational consequences
- **Recovery**: Requires unanimous management approval for any access restoration

### Escalation Triggers (AUTOMATIC)
- **Pattern Recognition**: Multiple Level 1 violations trigger Level 2 review
- **Cross-Category**: Violations across multiple rule categories trigger escalation
- **Impact Assessment**: Violations affecting project delivery trigger immediate escalation
- **Repeated Offenses**: Any repeated violation after penalty completion triggers escalation

---

## Important Instruction Reminders

### Non-Negotiable Requirements
- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary for achieving goals
- ALWAYS prefer editing existing files to creating new ones
- NEVER proactively create documentation files unless explicitly requested
- ALWAYS use Synthetic delegation for ALL coding tasks - NO EXCEPTIONS

### Final Authority
This CLAUDE.md file represents the FINAL AUTHORITY on all development processes, enforcement rules, and compliance requirements for the DevFlow project. All participants must acknowledge and adhere to these rules without exception.