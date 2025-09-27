#!/usr/bin/env python3
"""
DocumentTaggingSystem - Enterprise Multi-Tenancy Tagging
Microsoft Kernel Memory compliant tagging system per advanced filtering

Features:
- AI-powered automatic tagging con pattern recognition
- Multi-tenant isolation con enterprise security
- Hierarchical tag categories per structured organization
- Tag-based context filtering per optimized retrieval
- Performance-optimized tag indexing e caching
"""

import json
import sqlite3
import hashlib
import re
from pathlib import Path
from typing import List, Dict, Any, Optional, Set, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum
import logging

@dataclass
class TagMetadata:
    """Metadata per ogni tag"""
    tag: str
    category: str
    confidence: float  # 0.0-1.0
    source: str  # 'auto', 'user', 'system', 'ai'
    created_at: datetime
    last_used: datetime
    usage_count: int = 0

@dataclass
class DocumentTags:
    """Rappresenta tutti i tags di un document"""
    document_id: str
    document_path: str
    tags: List[TagMetadata]
    tenant_id: str
    project_scope: str
    total_confidence: float
    tagging_timestamp: datetime

class TagCategory(Enum):
    """Categories di tag per structured organization"""
    PROJECT = "project"           # devflow, claude-code, synthetic
    LANGUAGE = "language"         # typescript, python, javascript
    COMPONENT = "component"       # memory, context, orchestrator, database
    PRIORITY = "priority"         # critical, high, medium, low
    SCOPE = "scope"              # user-query, system, documentation, api
    TEMPORAL = "temporal"         # recent, active, historical, archived
    FUNCTIONAL = "functional"     # handler, parser, utility, config
    ARCHITECTURAL = "architectural" # service, model, controller, view
    SECURITY = "security"         # auth, permissions, encryption, audit
    PERFORMANCE = "performance"   # optimization, caching, indexing

class AIPatternRecognizer:
    """AI-powered pattern recognition per automatic tagging"""

    def __init__(self):
        # Technical patterns per automatic detection
        self.patterns = {
            TagCategory.LANGUAGE: {
                'typescript': [r'\.tsx?$', r'interface\s+\w+', r'type\s+\w+\s*=', r'import.*from'],
                'python': [r'\.py$', r'def\s+\w+', r'class\s+\w+', r'import\s+\w+'],
                'javascript': [r'\.jsx?$', r'function\s+\w+', r'const\s+\w+\s*=', r'require\('],
                'json': [r'\.json$', r'^\s*\{', r'^\s*\['],
                'yaml': [r'\.ya?ml$', r'^\s*\w+\s*:', r'^\s*-\s+']
            },

            TagCategory.COMPONENT: {
                'memory': [r'memory', r'context', r'cache', r'storage', r'embedding'],
                'orchestrator': [r'orchestrat', r'coordinat', r'dispatch', r'route'],
                'database': [r'database', r'sqlite', r'query', r'table', r'schema'],
                'handler': [r'handler', r'processor', r'parse', r'extract'],
                'parser': [r'parse', r'ast', r'syntax', r'lexer', r'token'],
                'api': [r'api', r'endpoint', r'route', r'request', r'response'],
                'hook': [r'hook', r'trigger', r'event', r'callback', r'listener']
            },

            TagCategory.FUNCTIONAL: {
                'configuration': [r'config', r'settings', r'options', r'parameters'],
                'utility': [r'util', r'helper', r'tool', r'common', r'shared'],
                'service': [r'service', r'manager', r'client', r'provider'],
                'model': [r'model', r'schema', r'entity', r'data'],
                'controller': [r'controller', r'handler', r'processor', r'worker'],
                'middleware': [r'middleware', r'filter', r'interceptor', r'guard']
            },

            TagCategory.ARCHITECTURAL: {
                'microservice': [r'service', r'micro', r'distributed', r'api'],
                'monolithic': [r'monolith', r'single', r'unified', r'centralized'],
                'event-driven': [r'event', r'message', r'queue', r'broker'],
                'layered': [r'layer', r'tier', r'level', r'abstraction'],
                'mvc': [r'model', r'view', r'controller', r'mvc'],
                'repository': [r'repository', r'dao', r'persistence', r'storage']
            },

            TagCategory.SECURITY: {
                'authentication': [r'auth', r'login', r'credential', r'token', r'jwt'],
                'authorization': [r'permission', r'role', r'access', r'privilege'],
                'encryption': [r'encrypt', r'decrypt', r'crypto', r'hash', r'secure'],
                'audit': [r'audit', r'log', r'track', r'monitor', r'compliance']
            },

            TagCategory.PERFORMANCE: {
                'caching': [r'cache', r'redis', r'memory', r'store', r'buffer'],
                'optimization': [r'optimi', r'performance', r'efficient', r'fast'],
                'indexing': [r'index', r'search', r'query', r'lookup'],
                'scaling': [r'scale', r'load', r'balance', r'distribute']
            }
        }

        # Project-specific patterns
        self.project_patterns = {
            'devflow': [r'devflow', r'orchestrat', r'synthetic', r'agent'],
            'claude-code': [r'claude', r'context', r'memory', r'injection'],
            'synthetic': [r'synthetic', r'ai', r'model', r'generation'],
            'memory-integration': [r'memory', r'integration', r'context', r'window'],
            'vector-embeddings': [r'vector', r'embedding', r'semantic', r'similarity']
        }

        # Confidence scoring weights
        self.confidence_weights = {
            'file_extension': 0.9,
            'filename_match': 0.8,
            'content_pattern': 0.7,
            'import_statements': 0.6,
            'comment_analysis': 0.5,
            'variable_names': 0.4
        }

    def analyze_content(self, content: str, file_path: str) -> Dict[TagCategory, List[Tuple[str, float]]]:
        """Analyze content e return detected tags con confidence scores"""
        results = {category: [] for category in TagCategory}

        # File extension analysis
        file_ext_tags = self._analyze_file_extension(file_path)
        for tag, confidence in file_ext_tags:
            results[TagCategory.LANGUAGE].append((tag, confidence))

        # Content pattern analysis
        for category, patterns in self.patterns.items():
            content_tags = self._analyze_content_patterns(content, patterns)
            results[category].extend(content_tags)

        # Project scope analysis
        project_tags = self._analyze_project_scope(content, file_path)
        results[TagCategory.PROJECT].extend(project_tags)

        # Priority analysis
        priority_tags = self._analyze_priority(content, file_path)
        results[TagCategory.PRIORITY].extend(priority_tags)

        # Temporal analysis
        temporal_tags = self._analyze_temporal_context(file_path)
        results[TagCategory.TEMPORAL].extend(temporal_tags)

        return results

    def _analyze_file_extension(self, file_path: str) -> List[Tuple[str, float]]:
        """Analyze file extension per language detection"""
        path = Path(file_path)
        extension = path.suffix.lower()

        extension_map = {
            '.py': ('python', 0.95),
            '.ts': ('typescript', 0.95),
            '.tsx': ('typescript', 0.90),
            '.js': ('javascript', 0.95),
            '.jsx': ('javascript', 0.90),
            '.json': ('json', 0.95),
            '.yaml': ('yaml', 0.95),
            '.yml': ('yaml', 0.95),
            '.md': ('markdown', 0.95)
        }

        if extension in extension_map:
            return [extension_map[extension]]

        return []

    def _analyze_content_patterns(self, content: str, patterns: Dict[str, List[str]]) -> List[Tuple[str, float]]:
        """Analyze content using regex patterns"""
        results = []

        for tag, pattern_list in patterns.items():
            confidence = 0.0
            matches = 0

            for pattern in pattern_list:
                try:
                    if re.search(pattern, content, re.IGNORECASE | re.MULTILINE):
                        matches += 1
                        confidence += 0.2  # Each pattern match adds confidence
                except re.error:
                    continue

            if matches > 0:
                # Normalize confidence (max 1.0)
                final_confidence = min(confidence, 1.0)
                results.append((tag, final_confidence))

        return results

    def _analyze_project_scope(self, content: str, file_path: str) -> List[Tuple[str, float]]:
        """Analyze project scope"""
        results = []

        for project, patterns in self.project_patterns.items():
            confidence = 0.0

            # Check file path
            if any(pattern in file_path.lower() for pattern in patterns):
                confidence += 0.5

            # Check content
            for pattern in patterns:
                if re.search(pattern, content, re.IGNORECASE):
                    confidence += 0.3

            if confidence > 0:
                results.append((project, min(confidence, 1.0)))

        return results

    def _analyze_priority(self, content: str, file_path: str) -> List[Tuple[str, float]]:
        """Analyze priority based on indicators"""
        priority_indicators = {
            'critical': [r'critical', r'urgent', r'emergency', r'blocker'],
            'high': [r'important', r'priority', r'main', r'core'],
            'medium': [r'feature', r'enhancement', r'improvement'],
            'low': [r'todo', r'minor', r'cleanup', r'refactor']
        }

        results = []

        for priority, indicators in priority_indicators.items():
            confidence = 0.0

            for indicator in indicators:
                if re.search(indicator, content, re.IGNORECASE):
                    confidence += 0.3

            if confidence > 0:
                results.append((priority, min(confidence, 1.0)))

        # Default medium priority se nessuno trovato
        if not results:
            results.append(('medium', 0.5))

        return results

    def _analyze_temporal_context(self, file_path: str) -> List[Tuple[str, float]]:
        """Analyze temporal context basato su file metadata"""
        try:
            path = Path(file_path)
            if not path.exists():
                return [('unknown', 0.0)]

            # Get file modification time
            mtime = datetime.fromtimestamp(path.stat().st_mtime)
            now = datetime.now()
            days_old = (now - mtime).days

            if days_old <= 1:
                return [('recent', 0.9)]
            elif days_old <= 7:
                return [('active', 0.8)]
            elif days_old <= 30:
                return [('current', 0.6)]
            elif days_old <= 90:
                return [('historical', 0.4)]
            else:
                return [('archived', 0.2)]

        except Exception:
            return [('unknown', 0.0)]

class DocumentTaggingSystem:
    """
    Main DocumentTaggingSystem - Enterprise Multi-Tenancy
    Microsoft Kernel Memory compliant tagging system
    """

    def __init__(self, project_root: str = "/Users/fulvioventura/devflow"):
        self.project_root = Path(project_root)
        self.db_path = self.project_root / "data/devflow_unified.sqlite"

        # Initialize AI pattern recognizer
        self.pattern_recognizer = AIPatternRecognizer()

        # Tag categories configuration
        self.tag_categories = {
            TagCategory.PROJECT: {
                'devflow', 'claude-code', 'synthetic', 'memory-integration',
                'vector-embeddings', 'orchestrator', 'context-optimization'
            },
            TagCategory.LANGUAGE: {
                'typescript', 'python', 'javascript', 'json', 'yaml', 'markdown'
            },
            TagCategory.COMPONENT: {
                'memory', 'context', 'orchestrator', 'database', 'handler',
                'parser', 'api', 'hook', 'service', 'utility'
            },
            TagCategory.PRIORITY: {
                'critical', 'high', 'medium', 'low'
            },
            TagCategory.SCOPE: {
                'user-query', 'system', 'documentation', 'api', 'internal', 'external'
            },
            TagCategory.TEMPORAL: {
                'recent', 'active', 'current', 'historical', 'archived'
            }
        }

        # Performance configuration
        self.max_tags_per_document = 20
        self.min_confidence_threshold = 0.3
        self.cache_ttl_hours = 24

        # Initialize database
        self._init_database()

        # Performance metrics
        self.metrics = {
            'documents_tagged': 0,
            'tags_generated': 0,
            'ai_analysis_calls': 0,
            'cache_hits': 0,
            'cache_misses': 0
        }

        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)

    def _init_database(self):
        """Initialize database tables per tag storage"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Document tags table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS document_tags (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    document_id TEXT NOT NULL,
                    document_path TEXT NOT NULL,
                    tag TEXT NOT NULL,
                    category TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    source TEXT NOT NULL,
                    tenant_id TEXT NOT NULL,
                    project_scope TEXT NOT NULL,
                    created_at TIMESTAMP NOT NULL,
                    last_used TIMESTAMP NOT NULL,
                    usage_count INTEGER DEFAULT 0,
                    UNIQUE(document_id, tag, category)
                )
            """)

            # Tag metadata table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tag_metadata (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tag TEXT NOT NULL,
                    category TEXT NOT NULL,
                    global_usage_count INTEGER DEFAULT 0,
                    avg_confidence REAL DEFAULT 0.0,
                    first_seen TIMESTAMP NOT NULL,
                    last_seen TIMESTAMP NOT NULL,
                    tenant_counts TEXT DEFAULT '{}',
                    UNIQUE(tag, category)
                )
            """)

            # Create indexes per performance
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_document_tags_doc_id ON document_tags(document_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_document_tags_tenant ON document_tags(tenant_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_document_tags_category ON document_tags(category)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_document_tags_tag ON document_tags(tag)")

            conn.commit()
            conn.close()

        except Exception as e:
            self.logger.error(f"Database initialization failed: {e}")
            raise

    def generate_smart_tags(self, content: str, file_path: str,
                          tenant_id: str = "default",
                          project_scope: str = "devflow") -> DocumentTags:
        """Generate smart tags per document usando AI pattern recognition"""

        start_time = datetime.now()
        self.metrics['ai_analysis_calls'] += 1

        # Generate document ID
        document_id = hashlib.sha256(f"{file_path}:{content[:100]}".encode()).hexdigest()[:16]

        # Check cache first
        cached_tags = self._get_cached_tags(document_id)
        if cached_tags:
            self.metrics['cache_hits'] += 1
            return cached_tags

        self.metrics['cache_misses'] += 1

        # AI pattern analysis
        detected_patterns = self.pattern_recognizer.analyze_content(content, file_path)

        # Convert to TagMetadata objects
        tag_metadata_list = []
        total_confidence = 0.0

        for category, tags in detected_patterns.items():
            for tag, confidence in tags:
                if confidence >= self.min_confidence_threshold:
                    tag_meta = TagMetadata(
                        tag=tag,
                        category=category.value,
                        confidence=confidence,
                        source='ai',
                        created_at=start_time,
                        last_used=start_time,
                        usage_count=1
                    )
                    tag_metadata_list.append(tag_meta)
                    total_confidence += confidence

        # Limit number of tags
        tag_metadata_list.sort(key=lambda t: t.confidence, reverse=True)
        tag_metadata_list = tag_metadata_list[:self.max_tags_per_document]

        # Create DocumentTags
        document_tags = DocumentTags(
            document_id=document_id,
            document_path=file_path,
            tags=tag_metadata_list,
            tenant_id=tenant_id,
            project_scope=project_scope,
            total_confidence=total_confidence,
            tagging_timestamp=start_time
        )

        # Store in database
        self._store_document_tags(document_tags)

        # Update metrics
        self.metrics['documents_tagged'] += 1
        self.metrics['tags_generated'] += len(tag_metadata_list)

        duration = (datetime.now() - start_time).total_seconds()
        self.logger.info(f"Tagged document {file_path} in {duration:.3f}s - {len(tag_metadata_list)} tags")

        return document_tags

    def _get_cached_tags(self, document_id: str) -> Optional[DocumentTags]:
        """Get cached tags from database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute("""
                SELECT document_path, tag, category, confidence, source, tenant_id,
                       project_scope, created_at, last_used, usage_count
                FROM document_tags
                WHERE document_id = ?
                AND datetime(last_used) > datetime('now', '-24 hours')
            """, (document_id,))

            rows = cursor.fetchall()
            conn.close()

            if not rows:
                return None

            # Reconstruct DocumentTags
            first_row = rows[0]
            document_path = first_row[0]
            tenant_id = first_row[5]
            project_scope = first_row[6]

            tags = []
            total_confidence = 0.0

            for row in rows:
                tag_meta = TagMetadata(
                    tag=row[1],
                    category=row[2],
                    confidence=row[3],
                    source=row[4],
                    created_at=datetime.fromisoformat(row[7]),
                    last_used=datetime.fromisoformat(row[8]),
                    usage_count=row[9]
                )
                tags.append(tag_meta)
                total_confidence += tag_meta.confidence

            return DocumentTags(
                document_id=document_id,
                document_path=document_path,
                tags=tags,
                tenant_id=tenant_id,
                project_scope=project_scope,
                total_confidence=total_confidence,
                tagging_timestamp=datetime.now()
            )

        except Exception as e:
            self.logger.error(f"Error retrieving cached tags: {e}")
            return None

    def _store_document_tags(self, document_tags: DocumentTags):
        """Store document tags in database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Store document tags
            for tag_meta in document_tags.tags:
                cursor.execute("""
                    INSERT OR REPLACE INTO document_tags
                    (document_id, document_path, tag, category, confidence, source,
                     tenant_id, project_scope, created_at, last_used, usage_count)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    document_tags.document_id,
                    document_tags.document_path,
                    tag_meta.tag,
                    tag_meta.category,
                    tag_meta.confidence,
                    tag_meta.source,
                    document_tags.tenant_id,
                    document_tags.project_scope,
                    tag_meta.created_at.isoformat(),
                    tag_meta.last_used.isoformat(),
                    tag_meta.usage_count
                ))

                # Update global tag metadata
                cursor.execute("""
                    INSERT OR IGNORE INTO tag_metadata (tag, category, first_seen, last_seen)
                    VALUES (?, ?, ?, ?)
                """, (tag_meta.tag, tag_meta.category, tag_meta.created_at.isoformat(), tag_meta.last_used.isoformat()))

                cursor.execute("""
                    UPDATE tag_metadata
                    SET global_usage_count = global_usage_count + 1,
                        last_seen = ?,
                        avg_confidence = (avg_confidence + ?) / 2
                    WHERE tag = ? AND category = ?
                """, (tag_meta.last_used.isoformat(), tag_meta.confidence, tag_meta.tag, tag_meta.category))

            conn.commit()
            conn.close()

        except Exception as e:
            self.logger.error(f"Error storing document tags: {e}")
            raise

    def filter_by_tags(self, tags: List[str], tenant_id: str = "default",
                      project_scope: Optional[str] = None,
                      min_confidence: float = 0.5) -> List[DocumentTags]:
        """Filter documents by tags con enterprise multi-tenancy"""

        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Build query con tag filtering
            tag_placeholders = ','.join(['?' for _ in tags])
            base_query = f"""
                SELECT DISTINCT document_id, document_path, tenant_id, project_scope
                FROM document_tags
                WHERE tag IN ({tag_placeholders})
                AND tenant_id = ?
                AND confidence >= ?
            """

            params = tags + [tenant_id, min_confidence]

            if project_scope:
                base_query += " AND project_scope = ?"
                params.append(project_scope)

            cursor.execute(base_query, params)
            document_rows = cursor.fetchall()

            # Fetch full tag data per each document
            results = []
            for doc_id, doc_path, tenant, project in document_rows:
                cursor.execute("""
                    SELECT tag, category, confidence, source, created_at, last_used, usage_count
                    FROM document_tags
                    WHERE document_id = ?
                """, (doc_id,))

                tag_rows = cursor.fetchall()
                tags = []
                total_confidence = 0.0

                for row in tag_rows:
                    tag_meta = TagMetadata(
                        tag=row[0],
                        category=row[1],
                        confidence=row[2],
                        source=row[3],
                        created_at=datetime.fromisoformat(row[4]),
                        last_used=datetime.fromisoformat(row[5]),
                        usage_count=row[6]
                    )
                    tags.append(tag_meta)
                    total_confidence += tag_meta.confidence

                results.append(DocumentTags(
                    document_id=doc_id,
                    document_path=doc_path,
                    tags=tags,
                    tenant_id=tenant,
                    project_scope=project,
                    total_confidence=total_confidence,
                    tagging_timestamp=datetime.now()
                ))

            conn.close()
            return results

        except Exception as e:
            self.logger.error(f"Error filtering by tags: {e}")
            return []

    def get_tag_suggestions(self, partial_tag: str, category: Optional[str] = None,
                           tenant_id: str = "default") -> List[Tuple[str, float, int]]:
        """Get tag suggestions per auto-completion"""

        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            base_query = """
                SELECT DISTINCT dt.tag, AVG(dt.confidence) as avg_conf, COUNT(*) as usage
                FROM document_tags dt
                WHERE dt.tag LIKE ?
                AND dt.tenant_id = ?
            """

            params = [f"{partial_tag}%", tenant_id]

            if category:
                base_query += " AND dt.category = ?"
                params.append(category)

            base_query += """
                GROUP BY dt.tag
                ORDER BY usage DESC, avg_conf DESC
                LIMIT 10
            """

            cursor.execute(base_query, params)
            results = cursor.fetchall()
            conn.close()

            return [(tag, confidence, usage) for tag, confidence, usage in results]

        except Exception as e:
            self.logger.error(f"Error getting tag suggestions: {e}")
            return []

    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute("SELECT COUNT(*) FROM document_tags")
            total_document_tags = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(DISTINCT document_id) FROM document_tags")
            unique_documents = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(DISTINCT tag) FROM document_tags")
            unique_tags = cursor.fetchone()[0]

            conn.close()

            return {
                **self.metrics,
                'total_document_tags': total_document_tags,
                'unique_documents_tagged': unique_documents,
                'unique_tags_in_system': unique_tags,
                'avg_tags_per_document': total_document_tags / max(unique_documents, 1),
                'cache_hit_ratio': self.metrics['cache_hits'] / max(
                    self.metrics['cache_hits'] + self.metrics['cache_misses'], 1
                )
            }

        except Exception as e:
            self.logger.error(f"Error getting performance metrics: {e}")
            return self.metrics

# Convenience functions
async def tag_single_document(file_path: str, tenant_id: str = "default") -> DocumentTags:
    """Quick tagging di single document"""
    tagging_system = DocumentTaggingSystem()

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    return tagging_system.generate_smart_tags(content, file_path, tenant_id)

async def bulk_tag_documents(file_paths: List[str], tenant_id: str = "default") -> List[DocumentTags]:
    """Bulk tagging di multiple documents"""
    tagging_system = DocumentTaggingSystem()
    results = []

    for file_path in file_paths:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            document_tags = tagging_system.generate_smart_tags(content, file_path, tenant_id)
            results.append(document_tags)

        except Exception as e:
            logging.error(f"Error tagging {file_path}: {e}")

    return results