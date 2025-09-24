# 🧠 Cometa Brain - Critical Issues Tracking System
## Implementation Plan (DRAFT - For Discussion)

Basandomi sulla ricerca di best practices 2025 e sull'analisi del Context7, ho preparato un piano di implementazione per un sistema di tracciamento criticità a lungo termine integrato con Cometa Brain.

## 📊 **Research Summary & Best Practices Found**

### **Key Insights from 2025 Research:**
1. **Action-oriented tasks**: Start with verbs for clarity
2. **Separation of concerns**: Long-term vs. immediate tasks
3. **Automated categorization**: Pattern-based classification
4. **Natural language processing**: Contextual task understanding
5. **AI-powered prediction**: Complexity and duration estimation

### **From Context7 Analysis (Claude Task Master, Super Productivity, Todoist):**
- **Dependency mapping**: Tasks reference related tasks automatically
- **Contextual awareness**: System learns from patterns
- **Multi-level categorization**: Purpose, domain, priority
- **Historical analysis**: Success rate tracking
- **Semantic search**: Vector-based task retrieval

## 🏗️ **Proposed Database Schema**

Propongo di aggiungere queste tabelle al `devflow_unified.sqlite`:

```sql
-- Critical Issues & Long-term TODOs
CREATE TABLE critical_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    issue_type TEXT DEFAULT 'technical' CHECK (issue_type IN (
        'technical', 'architectural', 'security', 'performance',
        'usability', 'business', 'strategic', 'operational'
    )),
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    impact_scope TEXT DEFAULT 'local' CHECK (impact_scope IN ('local', 'module', 'system', 'enterprise')),
    effort_estimate_hours INTEGER,
    business_value_score INTEGER DEFAULT 5 CHECK (business_value_score >= 1 AND business_value_score <= 10),
    technical_risk_score INTEGER DEFAULT 5 CHECK (technical_risk_score >= 1 AND technical_risk_score <= 10),

    -- Tracking & Status
    status TEXT DEFAULT 'identified' CHECK (status IN (
        'identified', 'analyzing', 'planned', 'in-progress',
        'blocked', 'resolved', 'rejected', 'deferred'
    )),
    priority_score REAL, -- Auto-calculated from severity + impact + value
    auto_detected BOOLEAN DEFAULT FALSE, -- Hook-generated vs manual

    -- Context & Dependencies
    project_id INTEGER,
    related_task_ids TEXT, -- JSON array of related tasks
    triggered_by_session TEXT, -- Cometa session that identified it
    code_paths TEXT, -- JSON array of affected files/paths
    dependencies TEXT, -- JSON: upstream/downstream dependencies

    -- AI Enhancement
    semantic_embedding BLOB, -- For similarity search
    pattern_category TEXT, -- Auto-classified pattern type
    predicted_complexity REAL, -- AI prediction 1-10
    suggested_approach TEXT, -- AI-generated approach suggestions

    -- Timeline
    discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    target_resolution_date DATETIME,
    resolved_at DATETIME,
    last_reviewed DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (triggered_by_session) REFERENCES cometa_sessions(id) ON DELETE SET NULL
);

-- Historical tracking of issue evolution
CREATE TABLE critical_issue_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER NOT NULL,
    change_type TEXT NOT NULL, -- 'status', 'priority', 'scope', 'estimate'
    old_value TEXT,
    new_value TEXT,
    change_reason TEXT,
    changed_by TEXT, -- 'human', 'hook', 'ai', 'system'
    session_id TEXT, -- Context of change
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (issue_id) REFERENCES critical_issues(id) ON DELETE CASCADE
);

-- Auto-detection patterns & rules
CREATE TABLE issue_detection_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_name TEXT UNIQUE NOT NULL,
    pattern_type TEXT NOT NULL, -- 'regex', 'semantic', 'frequency', 'anomaly'
    detection_rule TEXT NOT NULL, -- Rule definition (regex, query, etc.)
    target_scope TEXT NOT NULL, -- 'code', 'logs', 'session', 'performance'
    auto_severity TEXT DEFAULT 'medium',
    trigger_threshold REAL DEFAULT 0.7, -- Confidence threshold
    is_active BOOLEAN DEFAULT TRUE,
    success_rate REAL DEFAULT 0.0, -- Historical accuracy
    false_positive_rate REAL DEFAULT 0.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🔧 **Technical Implementation Components**

### **1. Hook Integration System**
- **File Watcher Hooks**: Detect patterns in code changes
- **Session Analysis Hooks**: Extract issues from Claude sessions
- **Error Pattern Hooks**: Auto-detect recurring problems
- **Performance Monitor Hooks**: Identify bottlenecks

### **2. Cometa Brain Integration**
- **Semantic Analysis**: Vector embeddings for issue similarity
- **Pattern Recognition**: Learn from historical resolutions
- **Prediction Engine**: Complexity & timeline estimation
- **Context Injection**: Relevant issues in new tasks

### **3. API Endpoints** (Port 3005 integration)
```javascript
// Unified Orchestrator endpoints
POST /api/issues - Create new critical issue
GET  /api/issues/active - List active issues by priority
GET  /api/issues/predict/:taskId - Get related issues for task
POST /api/issues/auto-detect - Trigger pattern detection
PUT  /api/issues/:id/resolve - Mark issue resolved
GET  /api/issues/analytics - Issue trends & patterns
```

### **4. Natural Language Interface**
Integration with Cometa `/cometa` command:
- `"identify critical issues in auth module"`
- `"show issues blocking deployment"`
- `"predict issues for new feature X"`
- `"auto-detect performance problems"`

## 🎯 **Implementation Phases**

### **Phase 1: Core Infrastructure** (2-3 days)
- ✅ Database tables creation
- ✅ Basic CRUD operations
- ✅ Unified Orchestrator API endpoints
- ✅ Simple hook for manual issue detection

### **Phase 2: Hook Automation** (3-4 days)
- Auto-detection patterns for common issues
- Session analysis hooks (extract from Claude logs)
- Code pattern recognition (regex + AST analysis)
- Integration with existing `.claude/hooks/` system

### **Phase 3: AI Enhancement** (4-5 days)
- Semantic embeddings for issue clustering
- Predictive complexity scoring
- Contextual issue suggestions in task creation
- Learning from resolution outcomes

### **Phase 4: Analytics & Optimization** (2-3 days)
- Issue trend analysis dashboard
- Pattern effectiveness scoring
- False positive reduction algorithms
- Performance metrics & reporting

## 🤖 **Cometa Brain Learning Integration**

The system will learn from:
- **Resolution patterns**: How similar issues were solved
- **Context effectiveness**: Which issues actually impacted delivery
- **Prediction accuracy**: Improving complexity estimates
- **Detection patterns**: Refining auto-identification rules

## 💡 **Example Usage Scenarios**

1. **Auto-Detection**: Hook detects repeated DB timeout → Creates "Database Performance" critical issue
2. **Session Learning**: Claude session mentions "auth vulnerabilities" → Auto-creates security issue
3. **Predictive**: New auth task created → System suggests related critical security issues
4. **Priority Ranking**: Business value + technical risk → Auto-calculated priority scores

## 🔍 **Discussion Points**

Prima di procedere all'implementazione, vorrei discutere:

1. **Scope Priority**: Quale fase implementare per prima?
2. **Hook Integration**: Preferisci pattern detection automatico o trigger manuali inizialmente?
3. **AI Complexity**: Livello di sophistication per il predictive scoring?
4. **User Interface**: Dashboard web o solo CLI/cometa integration?
5. **Data Migration**: Come gestire le issue esistenti/legacy?

**Il piano di implementazione è pronto per la discussione!**

Ho analizzato le best practice 2025, studiato i pattern da Context7 (Task Master, Super Productivity, Todoist API), e progettato un sistema che si integra perfettamente con:

- ✅ **All-mode orchestrator** attivato
- ✅ **Database schema** ottimizzato per devflow_unified.sqlite
- ✅ **Hook automation** per detection automatica
- ✅ **Cometa Brain learning** con semantic embeddings
- ✅ **4-phase implementation** plan graduato

**Punti chiave del design:**
- Sistema parallelo ai task di Claude Code (non interferenza)
- Auto-detection via hooks + pattern recognition
- AI-powered priority scoring & complexity prediction
- Full integration con Cometa Brain per context injection
- Scalable da semplice TODO a enterprise issue tracking

Cosa ne pensi? Su quale aspetto vorresti che ci focalizziamo prima - l'infrastruttura core, l'automazione hook, o l'integrazione AI?