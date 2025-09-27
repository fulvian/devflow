# 🗺️ Cometa Brain - Critical Issues System Roadmap
## Detailed Implementation Plan with Technical References

Based on 2025 best practices research and Context7 analysis (Claude Task Master, Super Productivity, Todoist API), this roadmap provides a comprehensive implementation strategy for the critical issues tracking system.

---

## 📋 **Project Overview**

### **Strategic Goals**
- Build enterprise-grade critical issues tracking system
- Integrate seamlessly with Cometa Brain's 4-layer intelligence architecture
- Provide predictive issue identification using AI pattern recognition
- Enable long-term technical debt management parallel to Claude Code tasks

### **Technology Stack**
- **Database**: SQLite 3.44.2+ with JSON1 extension
- **Runtime**: Node.js with sqlite3 npm package
- **AI Engine**: Cometa Brain v2.0 semantic embeddings
- **API**: Unified Orchestrator (Port 3005)
- **Hooks**: .claude/hooks/ integration system

---

## 🎯 **Phase 1: Core Infrastructure** (2-3 days)
**Timeline**: Days 1-3 | **Priority**: CRITICAL

### **Macro Task 1.1: Database Schema Implementation**
**Estimated Effort**: 8 hours

#### **Micro Task 1.1.1: Create core tables** (3 hours)
**Technical Reference**: SQLite CREATE TABLE patterns from Context7

```sql
-- Critical Issues core table with Context7-compliant schema
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
    auto_detected BOOLEAN DEFAULT FALSE,

    -- Context & Dependencies
    project_id INTEGER,
    related_task_ids TEXT, -- JSON array
    triggered_by_session TEXT,
    code_paths TEXT, -- JSON array
    dependencies TEXT, -- JSON object

    -- AI Enhancement
    semantic_embedding BLOB,
    pattern_category TEXT,
    predicted_complexity REAL,
    suggested_approach TEXT,

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

-- Historical tracking with audit trail
CREATE TABLE critical_issue_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER NOT NULL,
    change_type TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    change_reason TEXT,
    changed_by TEXT,
    session_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (issue_id) REFERENCES critical_issues(id) ON DELETE CASCADE
);

-- Pattern detection rules engine
CREATE TABLE issue_detection_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_name TEXT UNIQUE NOT NULL,
    pattern_type TEXT NOT NULL, -- 'regex', 'semantic', 'frequency', 'anomaly'
    detection_rule TEXT NOT NULL,
    target_scope TEXT NOT NULL, -- 'code', 'logs', 'session', 'performance'
    auto_severity TEXT DEFAULT 'medium',
    trigger_threshold REAL DEFAULT 0.7,
    is_active BOOLEAN DEFAULT TRUE,
    success_rate REAL DEFAULT 0.0,
    false_positive_rate REAL DEFAULT 0.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### **Micro Task 1.1.2: Create indexes for performance** (1 hour)
```sql
-- Performance optimization indexes
CREATE INDEX idx_critical_issues_status ON critical_issues(status);
CREATE INDEX idx_critical_issues_priority ON critical_issues(priority_score DESC);
CREATE INDEX idx_critical_issues_type_severity ON critical_issues(issue_type, severity);
CREATE INDEX idx_critical_issues_project ON critical_issues(project_id);
CREATE INDEX idx_critical_issues_discovered ON critical_issues(discovered_at);
CREATE INDEX idx_history_issue_id ON critical_issue_history(issue_id);
CREATE INDEX idx_patterns_active ON issue_detection_patterns(is_active, pattern_type);
```

#### **Micro Task 1.1.3: Database migration script** (2 hours)
```javascript
// Database migration using Context7 sqlite3 patterns
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class CriticalIssuesMigration {
    constructor(dbPath = './data/devflow_unified.sqlite') {
        this.dbPath = dbPath;
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async runMigration() {
        const migrations = [
            this.createCriticalIssuesTable.bind(this),
            this.createHistoryTable.bind(this),
            this.createPatternsTable.bind(this),
            this.createIndexes.bind(this)
        ];

        for (const migration of migrations) {
            await migration();
        }
    }

    async createCriticalIssuesTable() {
        return new Promise((resolve, reject) => {
            this.db.run(`-- SQL from above --`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = CriticalIssuesMigration;
```

#### **Micro Task 1.1.4: Data validation and constraints** (2 hours)
```sql
-- Triggers for auto-calculation and validation
CREATE TRIGGER calculate_priority_score
AFTER INSERT ON critical_issues
WHEN NEW.priority_score IS NULL
BEGIN
    UPDATE critical_issues
    SET priority_score = (
        CASE NEW.severity
            WHEN 'critical' THEN 10
            WHEN 'high' THEN 7.5
            WHEN 'medium' THEN 5
            WHEN 'low' THEN 2.5
        END +
        CASE NEW.impact_scope
            WHEN 'enterprise' THEN 5
            WHEN 'system' THEN 3
            WHEN 'module' THEN 2
            WHEN 'local' THEN 1
        END +
        (NEW.business_value_score * 0.3) +
        (NEW.technical_risk_score * 0.2)
    )
    WHERE id = NEW.id;
END;

-- Audit trigger for history tracking
CREATE TRIGGER track_issue_changes
AFTER UPDATE ON critical_issues
BEGIN
    INSERT INTO critical_issue_history (
        issue_id, change_type, old_value, new_value,
        change_reason, changed_by, session_id
    ) VALUES (
        NEW.id, 'status_change', OLD.status, NEW.status,
        'System update', 'system', NEW.triggered_by_session
    );
END;
```

### **Macro Task 1.2: Basic CRUD Operations**
**Estimated Effort**: 6 hours

#### **Micro Task 1.2.1: Database service layer** (3 hours)
```javascript
// Context7-compliant database service
class CriticalIssuesService {
    constructor(dbPath) {
        this.db = new sqlite3.Database(dbPath);
    }

    async createIssue(issueData) {
        const stmt = this.db.prepare(`
            INSERT INTO critical_issues (
                title, description, issue_type, severity, impact_scope,
                effort_estimate_hours, business_value_score, technical_risk_score,
                project_id, code_paths, dependencies
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        return new Promise((resolve, reject) => {
            stmt.run([
                issueData.title,
                issueData.description,
                issueData.issue_type || 'technical',
                issueData.severity || 'medium',
                issueData.impact_scope || 'local',
                issueData.effort_estimate_hours,
                issueData.business_value_score || 5,
                issueData.technical_risk_score || 5,
                issueData.project_id,
                JSON.stringify(issueData.code_paths || []),
                JSON.stringify(issueData.dependencies || {})
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    async getActiveIssues() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT * FROM critical_issues
                WHERE status NOT IN ('resolved', 'rejected')
                ORDER BY priority_score DESC, created_at DESC
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(this.parseJsonFields.bind(this)));
            });
        });
    }

    parseJsonFields(row) {
        try {
            row.code_paths = JSON.parse(row.code_paths || '[]');
            row.dependencies = JSON.parse(row.dependencies || '{}');
            row.related_task_ids = JSON.parse(row.related_task_ids || '[]');
        } catch (e) {
            console.warn('JSON parsing error for issue:', row.id);
        }
        return row;
    }
}

module.exports = CriticalIssuesService;
```

#### **Micro Task 1.2.2: API endpoints integration** (3 hours)
```javascript
// Unified Orchestrator API endpoints (Port 3005)
const express = require('express');
const CriticalIssuesService = require('./CriticalIssuesService');

const router = express.Router();
const issuesService = new CriticalIssuesService('./data/devflow_unified.sqlite');

// POST /api/issues - Create new critical issue
router.post('/issues', async (req, res) => {
    try {
        const issueId = await issuesService.createIssue(req.body);
        res.json({ success: true, issueId, message: 'Critical issue created' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/issues/active - List active issues by priority
router.get('/issues/active', async (req, res) => {
    try {
        const issues = await issuesService.getActiveIssues();
        res.json({ issues, count: issues.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/issues/predict/:taskId - Get related issues for task
router.get('/issues/predict/:taskId', async (req, res) => {
    try {
        const relatedIssues = await issuesService.getPredictedIssues(req.params.taskId);
        res.json({ predicted_issues: relatedIssues });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
```

### **Macro Task 1.3: Basic Hook Integration**
**Estimated Effort**: 4 hours

#### **Micro Task 1.3.1: Manual issue creation hook** (4 hours)
```javascript
// .claude/hooks/critical-issue-detector.js
const CriticalIssuesService = require('../../src/services/CriticalIssuesService');

class CriticalIssueHook {
    constructor() {
        this.issuesService = new CriticalIssuesService();
        this.patterns = [
            { regex: /TODO.*CRITICAL/i, severity: 'high', type: 'technical' },
            { regex: /FIXME.*URGENT/i, severity: 'critical', type: 'technical' },
            { regex: /security.*vulnerability/i, severity: 'high', type: 'security' },
            { regex: /performance.*bottleneck/i, severity: 'medium', type: 'performance' }
        ];
    }

    async detectIssuesInContent(content, filePath) {
        const detectedIssues = [];

        for (const pattern of this.patterns) {
            const matches = content.match(pattern.regex);
            if (matches) {
                detectedIssues.push({
                    title: `Auto-detected ${pattern.type} issue in ${filePath}`,
                    description: matches[0],
                    issue_type: pattern.type,
                    severity: pattern.severity,
                    code_paths: [filePath],
                    auto_detected: true
                });
            }
        }

        return detectedIssues;
    }

    async processDetectedIssues(issues) {
        for (const issue of issues) {
            await this.issuesService.createIssue(issue);
        }
    }
}

module.exports = CriticalIssueHook;
```

---

## 🤖 **Phase 2: Hook Automation** (3-4 days)
**Timeline**: Days 4-7 | **Priority**: HIGH

### **Macro Task 2.1: Advanced Pattern Detection**
**Estimated Effort**: 12 hours

#### **Micro Task 2.1.1: Session analysis hooks** (4 hours)
```javascript
// Extract issues from Claude session logs
class SessionAnalysisHook {
    constructor() {
        this.nlpPatterns = [
            { trigger: 'security concern', type: 'security', confidence: 0.8 },
            { trigger: 'performance issue', type: 'performance', confidence: 0.7 },
            { trigger: 'architectural problem', type: 'architectural', confidence: 0.9 },
            { trigger: 'technical debt', type: 'technical', confidence: 0.6 }
        ];
    }

    async analyzeSession(sessionData) {
        const extractedIssues = [];
        const content = sessionData.messages.join(' ').toLowerCase();

        for (const pattern of this.nlpPatterns) {
            if (content.includes(pattern.trigger)) {
                extractedIssues.push({
                    title: `Session-identified ${pattern.type} concern`,
                    description: this.extractContext(content, pattern.trigger),
                    issue_type: pattern.type,
                    severity: this.calculateSeverity(pattern.confidence),
                    triggered_by_session: sessionData.sessionId,
                    auto_detected: true
                });
            }
        }

        return extractedIssues;
    }

    calculateSeverity(confidence) {
        if (confidence >= 0.9) return 'high';
        if (confidence >= 0.7) return 'medium';
        return 'low';
    }
}
```

#### **Micro Task 2.1.2: Code pattern recognition** (4 hours)
```javascript
// AST-based code analysis for issue detection
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

class CodePatternAnalyzer {
    constructor() {
        this.antiPatterns = [
            {
                name: 'nested_callbacks',
                detector: this.detectCallbackHell.bind(this),
                severity: 'medium',
                type: 'technical'
            },
            {
                name: 'large_functions',
                detector: this.detectLargeFunctions.bind(this),
                severity: 'low',
                type: 'technical'
            },
            {
                name: 'sql_injection_risk',
                detector: this.detectSQLInjection.bind(this),
                severity: 'critical',
                type: 'security'
            }
        ];
    }

    async analyzeFile(filePath, content) {
        const issues = [];

        try {
            const ast = parser.parse(content, {
                sourceType: 'module',
                plugins: ['typescript', 'jsx']
            });

            for (const antiPattern of this.antiPatterns) {
                const detectedIssues = await antiPattern.detector(ast, filePath);
                issues.push(...detectedIssues);
            }
        } catch (error) {
            console.warn(`AST parsing failed for ${filePath}:`, error.message);
        }

        return issues;
    }

    detectCallbackHell(ast, filePath) {
        const issues = [];
        let callbackDepth = 0;

        traverse(ast, {
            Function(path) {
                callbackDepth++;
                if (callbackDepth > 3) {
                    issues.push({
                        title: `Callback hell detected in ${filePath}`,
                        description: 'Nested callbacks exceed recommended depth',
                        issue_type: 'technical',
                        severity: 'medium',
                        code_paths: [filePath]
                    });
                }
            }
        });

        return issues;
    }
}
```

#### **Micro Task 2.1.3: Performance monitoring hooks** (4 hours)
```javascript
// Performance bottleneck detection
class PerformanceMonitorHook {
    constructor() {
        this.thresholds = {
            responseTime: 1000, // ms
            memoryUsage: 100 * 1024 * 1024, // 100MB
            cpuUsage: 80 // %
        };
    }

    async monitorPerformance() {
        const metrics = await this.collectMetrics();
        const issues = [];

        if (metrics.responseTime > this.thresholds.responseTime) {
            issues.push({
                title: 'High response time detected',
                description: `Average response time: ${metrics.responseTime}ms`,
                issue_type: 'performance',
                severity: 'high',
                auto_detected: true
            });
        }

        if (metrics.memoryUsage > this.thresholds.memoryUsage) {
            issues.push({
                title: 'High memory usage detected',
                description: `Memory usage: ${metrics.memoryUsage / 1024 / 1024}MB`,
                issue_type: 'performance',
                severity: 'medium',
                auto_detected: true
            });
        }

        return issues;
    }
}
```

### **Macro Task 2.2: Integration with .claude/hooks/ System**
**Estimated Effort**: 8 hours

---

## 🧠 **Phase 3: AI Enhancement** (4-5 days)
**Timeline**: Days 8-12 | **Priority**: HIGH

### **Macro Task 3.1: Semantic Embeddings Integration**
**Estimated Effort**: 16 hours

#### **Micro Task 3.1.1: Vector embedding generation** (6 hours)
```javascript
// Cometa Brain semantic embeddings integration
const { EmbeddingService } = require('../../src/core/embeddings/ollama-embedding-model');

class IssueEmbeddingService {
    constructor() {
        this.embeddingModel = new EmbeddingService();
        this.embeddingDimension = 384; // Ollama all-minilm dimension
    }

    async generateEmbedding(issueData) {
        const text = `${issueData.title} ${issueData.description} ${issueData.issue_type}`;
        const embedding = await this.embeddingModel.generateEmbedding(text);
        return Buffer.from(new Float32Array(embedding).buffer);
    }

    async findSimilarIssues(targetEmbedding, threshold = 0.8) {
        // Vector similarity search using cosine similarity
        const query = `
            SELECT id, title, description, issue_type, severity,
                   (semantic_embedding) as embedding
            FROM critical_issues
            WHERE semantic_embedding IS NOT NULL
        `;

        const issues = await this.db.all(query);
        const similarities = [];

        for (const issue of issues) {
            const similarity = this.cosineSimilarity(targetEmbedding, issue.embedding);
            if (similarity >= threshold) {
                similarities.push({ ...issue, similarity });
            }
        }

        return similarities.sort((a, b) => b.similarity - a.similarity);
    }

    cosineSimilarity(vecA, vecB) {
        const a = new Float32Array(vecA);
        const b = new Float32Array(vecB);

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
```

#### **Micro Task 3.1.2: Predictive complexity scoring** (5 hours)
```javascript
// AI-powered complexity prediction
class ComplexityPredictor {
    constructor() {
        this.features = [
            'code_paths_count',
            'dependencies_count',
            'issue_type_weight',
            'severity_weight',
            'historical_resolution_time'
        ];
    }

    async predictComplexity(issueData) {
        const features = this.extractFeatures(issueData);
        const historicalData = await this.getHistoricalData(issueData.issue_type);

        // Simple weighted scoring (can be replaced with ML model)
        let complexity = 0;

        complexity += features.code_paths_count * 0.3;
        complexity += features.dependencies_count * 0.4;
        complexity += features.issue_type_weight * 0.2;
        complexity += features.severity_weight * 0.1;

        // Normalize to 1-10 scale
        return Math.min(Math.max(complexity, 1), 10);
    }

    extractFeatures(issueData) {
        return {
            code_paths_count: (issueData.code_paths || []).length,
            dependencies_count: Object.keys(issueData.dependencies || {}).length,
            issue_type_weight: this.getTypeWeight(issueData.issue_type),
            severity_weight: this.getSeverityWeight(issueData.severity)
        };
    }

    getTypeWeight(type) {
        const weights = {
            'architectural': 8,
            'security': 7,
            'performance': 6,
            'technical': 5,
            'business': 4,
            'usability': 3,
            'operational': 4,
            'strategic': 6
        };
        return weights[type] || 5;
    }
}
```

#### **Micro Task 3.1.3: Contextual suggestion engine** (5 hours)
```javascript
// Context-aware issue suggestions
class IssueSuggestionEngine {
    async suggestRelatedIssues(taskContext) {
        const suggestions = [];

        // Semantic similarity search
        const semanticMatches = await this.findSemanticMatches(taskContext);
        suggestions.push(...semanticMatches);

        // Pattern-based suggestions
        const patternMatches = await this.findPatternMatches(taskContext);
        suggestions.push(...patternMatches);

        // Historical correlation
        const historicalMatches = await this.findHistoricalCorrelations(taskContext);
        suggestions.push(...historicalMatches);

        return this.rankSuggestions(suggestions);
    }

    async findSemanticMatches(taskContext) {
        const embedding = await this.embeddingService.generateEmbedding(
            `${taskContext.title} ${taskContext.description}`
        );

        return await this.embeddingService.findSimilarIssues(embedding, 0.7);
    }

    rankSuggestions(suggestions) {
        return suggestions
            .sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0))
            .slice(0, 10); // Top 10 suggestions
    }
}
```

---

## 📊 **Phase 4: Analytics & Optimization** (2-3 days)
**Timeline**: Days 13-15 | **Priority**: MEDIUM

### **Macro Task 4.1: Analytics Dashboard**
**Estimated Effort**: 12 hours

#### **Micro Task 4.1.1: Issue trend analysis** (4 hours)
```sql
-- Analytics queries for issue trends
CREATE VIEW issue_trends AS
SELECT
    issue_type,
    severity,
    DATE(discovered_at) as discovery_date,
    COUNT(*) as issue_count,
    AVG(priority_score) as avg_priority,
    AVG(predicted_complexity) as avg_complexity
FROM critical_issues
WHERE discovered_at >= date('now', '-30 days')
GROUP BY issue_type, severity, DATE(discovered_at)
ORDER BY discovery_date DESC;

-- Resolution time analytics
CREATE VIEW resolution_analytics AS
SELECT
    issue_type,
    severity,
    AVG(
        JULIANDAY(resolved_at) - JULIANDAY(discovered_at)
    ) * 24 as avg_resolution_hours,
    COUNT(*) as resolved_count
FROM critical_issues
WHERE resolved_at IS NOT NULL
GROUP BY issue_type, severity;
```

#### **Micro Task 4.1.2: Pattern effectiveness scoring** (4 hours)
```javascript
// Pattern effectiveness analysis
class PatternEffectivenessAnalyzer {
    async analyzePatternPerformance() {
        const patterns = await this.getActivePatterns();
        const effectiveness = [];

        for (const pattern of patterns) {
            const metrics = await this.calculatePatternMetrics(pattern);
            effectiveness.push({
                pattern_name: pattern.pattern_name,
                success_rate: metrics.success_rate,
                false_positive_rate: metrics.false_positive_rate,
                avg_issue_severity: metrics.avg_severity,
                total_detections: metrics.total_detections,
                recommendation: this.getRecommendation(metrics)
            });
        }

        return effectiveness.sort((a, b) => b.success_rate - a.success_rate);
    }

    getRecommendation(metrics) {
        if (metrics.success_rate > 0.8 && metrics.false_positive_rate < 0.2) {
            return 'EXCELLENT - Keep active';
        } else if (metrics.success_rate > 0.6) {
            return 'GOOD - Monitor closely';
        } else {
            return 'POOR - Consider tuning or disabling';
        }
    }
}
```

#### **Micro Task 4.1.3: Performance metrics dashboard** (4 hours)
```javascript
// Real-time metrics API endpoint
router.get('/api/issues/analytics', async (req, res) => {
    try {
        const analytics = {
            overview: await this.getOverviewMetrics(),
            trends: await this.getTrendData(),
            patterns: await this.getPatternEffectiveness(),
            predictions: await this.getPredictionAccuracy()
        };

        res.json(analytics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

async getOverviewMetrics() {
    const query = `
        SELECT
            COUNT(*) as total_issues,
            COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_issues,
            COUNT(CASE WHEN auto_detected = 1 THEN 1 END) as auto_detected_issues,
            AVG(priority_score) as avg_priority,
            MAX(priority_score) as max_priority
        FROM critical_issues
        WHERE discovered_at >= date('now', '-30 days')
    `;

    return await this.db.get(query);
}
```

---

## 🔗 **Integration Points**

### **Cometa Brain Integration**
1. **Memory Stream**: Store issue context in `cometa_memory_stream` table
2. **Session Correlation**: Link issues to specific Cometa sessions
3. **Semantic Search**: Use existing embedding infrastructure
4. **NLP Processing**: Leverage Cometa's natural language understanding

### **Unified Orchestrator Integration**
1. **Port 3005 API**: All endpoints follow existing REST patterns
2. **Task Correlation**: Link issues to active tasks and projects
3. **Agent Coordination**: Issues inform task delegation decisions
4. **Cross-verification**: Issues validated by multiple agents

### **Claude Code Integration**
1. **Parallel System**: No interference with existing task management
2. **Context Injection**: Surface relevant issues during task creation
3. **Hook System**: Seamless integration with `.claude/hooks/`
4. **Protocol Compliance**: Follows CLAUDE.md enforcement rules

---

## 🧪 **Testing Strategy**

### **Unit Tests** (Phase 1)
- Database schema validation
- CRUD operations integrity
- API endpoint functionality
- Hook trigger mechanisms

### **Integration Tests** (Phase 2)
- Cross-service communication
- Database transaction handling
- Real-time pattern detection
- Performance under load

### **AI Model Tests** (Phase 3)
- Embedding generation accuracy
- Similarity search precision
- Prediction model validation
- Suggestion relevance scoring

### **End-to-End Tests** (Phase 4)
- Complete issue lifecycle
- Multi-user scenarios
- Analytics accuracy
- Performance benchmarks

---

## 📈 **Success Metrics**

### **Technical Metrics**
- **Issue Detection Rate**: > 85% of critical issues auto-detected
- **False Positive Rate**: < 15% for pattern-based detection
- **Response Time**: < 200ms for API queries
- **Prediction Accuracy**: > 70% for complexity estimates

### **Business Metrics**
- **Resolution Time**: 25% reduction in average resolution time
- **Issue Prevention**: 30% reduction in critical production issues
- **Developer Productivity**: 20% improvement in task completion rates
- **Technical Debt**: Measurable reduction in accumulated debt

---

## 🚀 **Deployment Strategy**

### **Phase 1 Deployment** (Week 1)
- Database migration in development
- Basic API endpoints
- Simple manual detection hooks
- Limited user testing

### **Phase 2 Deployment** (Week 2)
- Advanced pattern detection
- Session analysis integration
- Code scanning automation
- Beta user feedback

### **Phase 3 Deployment** (Week 3)
- AI enhancement features
- Semantic search capabilities
- Predictive analytics
- Production-ready testing

### **Phase 4 Deployment** (Week 4)
- Analytics dashboard
- Performance optimization
- Full system integration
- Production deployment

---

## 🎯 **Next Actions**

1. **Approve roadmap** and select starting phase
2. **Assign technical resources** for Phase 1 implementation
3. **Set up development environment** with Context7 libraries
4. **Begin database schema implementation** using provided SQL scripts
5. **Schedule regular progress reviews** and stakeholder check-ins

**Implementation begins immediately upon approval!**