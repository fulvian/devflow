"""
Context Store - Persistent Memory System for Orchestrator Agent
Implements knowledge artifacts pattern for compound intelligence
"""

import json
import sqlite3
import uuid
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum
from pathlib import Path

class ContextType(Enum):
    """Types of context artifacts"""
    CODE_ANALYSIS = "code_analysis"
    ARCHITECTURAL_DECISION = "architectural_decision"
    BUG_REPORT = "bug_report"
    IMPLEMENTATION_PATTERN = "implementation_pattern"
    DEPENDENCY_MAP = "dependency_map"
    SYSTEM_STATE = "system_state"
    DISCOVERY = "discovery"
    SOLUTION_ARTIFACT = "solution_artifact"
    KNOWLEDGE_SYNTHESIS = "knowledge_synthesis"

class ContextScope(Enum):
    """Scope of context applicability"""
    GLOBAL = "global"  # Applies across all tasks
    PROJECT = "project"  # Applies to specific project
    TASK = "task"  # Applies to specific task
    SESSION = "session"  # Applies to current session only

@dataclass
class ContextArtifact:
    """Discrete, reusable knowledge artifact"""
    id: str
    type: ContextType
    scope: ContextScope
    title: str
    content: str
    metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    created_by: str  # Agent or orchestrator that created it
    relevance_score: float = 1.0  # 0.0-1.0
    access_count: int = 0
    related_artifacts: List[str] = None  # IDs of related artifacts
    tags: List[str] = None
    
    def __post_init__(self):
        if self.related_artifacts is None:
            self.related_artifacts = []
        if self.tags is None:
            self.tags = []

@dataclass
class ContextQuery:
    """Query for retrieving context artifacts"""
    types: Optional[List[ContextType]] = None
    scopes: Optional[List[ContextScope]] = None
    tags: Optional[List[str]] = None
    task_id: Optional[str] = None
    min_relevance: float = 0.0
    max_results: int = 50
    search_text: Optional[str] = None

class ContextStore:
    """Persistent memory system for knowledge artifacts"""
    
    def __init__(self, db_path: str = "/Users/fulvioventura/devflow/.claude/state/context_store.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_database()
    
    def _init_database(self):
        """Initialize SQLite database for context storage"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS context_artifacts (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    scope TEXT NOT NULL,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    metadata TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    created_by TEXT NOT NULL,
                    relevance_score REAL DEFAULT 1.0,
                    access_count INTEGER DEFAULT 0,
                    related_artifacts TEXT DEFAULT '[]',
                    tags TEXT DEFAULT '[]'
                )
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_context_type ON context_artifacts(type)
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_context_scope ON context_artifacts(scope)
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_context_relevance ON context_artifacts(relevance_score)
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_context_created ON context_artifacts(created_at)
            """)
            
            # Full-text search table
            conn.execute("""
                CREATE VIRTUAL TABLE IF NOT EXISTS context_fts USING fts5(
                    artifact_id,
                    title,
                    content,
                    tags
                )
            """)
            
            conn.commit()
    
    def store_artifact(self, artifact: ContextArtifact) -> str:
        """Store a knowledge artifact"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT OR REPLACE INTO context_artifacts 
                (id, type, scope, title, content, metadata, created_at, updated_at, 
                 created_by, relevance_score, access_count, related_artifacts, tags)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                artifact.id,
                artifact.type.value,
                artifact.scope.value,
                artifact.title,
                artifact.content,
                json.dumps(artifact.metadata),
                artifact.created_at.isoformat(),
                artifact.updated_at.isoformat(),
                artifact.created_by,
                artifact.relevance_score,
                artifact.access_count,
                json.dumps(artifact.related_artifacts),
                json.dumps(artifact.tags)
            ))
            
            # Update FTS index
            conn.execute("""
                INSERT OR REPLACE INTO context_fts 
                (artifact_id, title, content, tags)
                VALUES (?, ?, ?, ?)
            """, (
                artifact.id,
                artifact.title,
                artifact.content,
                ' '.join(artifact.tags)
            ))
            
            conn.commit()
        
        return artifact.id
    
    def create_artifact(self, 
                       type: ContextType,
                       scope: ContextScope,
                       title: str,
                       content: str,
                       created_by: str,
                       metadata: Dict[str, Any] = None,
                       tags: List[str] = None,
                       relevance_score: float = 1.0) -> ContextArtifact:
        """Create and store a new knowledge artifact"""
        artifact = ContextArtifact(
            id=str(uuid.uuid4()),
            type=type,
            scope=scope,
            title=title,
            content=content,
            metadata=metadata or {},
            created_at=datetime.now(),
            updated_at=datetime.now(),
            created_by=created_by,
            relevance_score=relevance_score,
            tags=tags or []
        )
        
        self.store_artifact(artifact)
        return artifact
    
    def get_artifact(self, artifact_id: str) -> Optional[ContextArtifact]:
        """Retrieve a specific artifact by ID"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            result = conn.execute("""
                SELECT * FROM context_artifacts WHERE id = ?
            """, (artifact_id,)).fetchone()
            
            if result:
                # Update access count
                conn.execute("""
                    UPDATE context_artifacts SET access_count = access_count + 1 WHERE id = ?
                """, (artifact_id,))
                conn.commit()
                
                return self._row_to_artifact(result)
        
        return None
    
    def query_artifacts(self, query: ContextQuery) -> List[ContextArtifact]:
        """Query artifacts based on criteria"""
        conditions = []
        params = []
        
        if query.types:
            type_placeholders = ','.join('?' * len(query.types))
            conditions.append(f"type IN ({type_placeholders})")
            params.extend([t.value for t in query.types])
        
        if query.scopes:
            scope_placeholders = ','.join('?' * len(query.scopes))
            conditions.append(f"scope IN ({scope_placeholders})")
            params.extend([s.value for s in query.scopes])
        
        if query.min_relevance > 0:
            conditions.append("relevance_score >= ?")
            params.append(query.min_relevance)
        
        # Build SQL query
        sql = "SELECT * FROM context_artifacts"
        if conditions:
            sql += " WHERE " + " AND ".join(conditions)
        
        sql += " ORDER BY relevance_score DESC, created_at DESC"
        
        if query.max_results:
            sql += f" LIMIT {query.max_results}"
        
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            results = conn.execute(sql, params).fetchall()
            artifacts = [self._row_to_artifact(row) for row in results]
        
        # Apply text search if specified
        if query.search_text:
            artifacts = self._filter_by_text_search(artifacts, query.search_text)
        
        # Apply tag filtering if specified
        if query.tags:
            artifacts = self._filter_by_tags(artifacts, query.tags)
        
        return artifacts[:query.max_results]
    
    def search_artifacts(self, search_text: str, max_results: int = 20) -> List[ContextArtifact]:
        """Full-text search across artifacts"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            results = conn.execute("""
                SELECT ca.* FROM context_artifacts ca
                JOIN context_fts cf ON ca.id = cf.artifact_id
                WHERE context_fts MATCH ?
                ORDER BY ca.relevance_score DESC, ca.created_at DESC
                LIMIT ?
            """, (search_text, max_results)).fetchall()
            
            return [self._row_to_artifact(row) for row in results]
    
    def get_related_artifacts(self, artifact_id: str, max_depth: int = 2) -> List[ContextArtifact]:
        """Get artifacts related to a specific artifact"""
        visited = set()
        queue = [(artifact_id, 0)]
        related = []
        
        while queue and len(related) < 50:  # Limit results
            current_id, depth = queue.pop(0)
            
            if current_id in visited or depth > max_depth:
                continue
            
            visited.add(current_id)
            artifact = self.get_artifact(current_id)
            
            if artifact and artifact.id != artifact_id:  # Don't include the original artifact
                related.append(artifact)
                
                # Add related artifacts to queue
                for related_id in artifact.related_artifacts:
                    if related_id not in visited:
                        queue.append((related_id, depth + 1))
        
        return related
    
    def link_artifacts(self, artifact_id1: str, artifact_id2: str) -> bool:
        """Create bidirectional link between artifacts"""
        with sqlite3.connect(self.db_path) as conn:
            # Get current related artifacts
            result1 = conn.execute("SELECT related_artifacts FROM context_artifacts WHERE id = ?", 
                                 (artifact_id1,)).fetchone()
            result2 = conn.execute("SELECT related_artifacts FROM context_artifacts WHERE id = ?", 
                                 (artifact_id2,)).fetchone()
            
            if not result1 or not result2:
                return False
            
            # Update related artifacts
            related1 = json.loads(result1[0])
            related2 = json.loads(result2[0])
            
            if artifact_id2 not in related1:
                related1.append(artifact_id2)
            if artifact_id1 not in related2:
                related2.append(artifact_id1)
            
            # Save updates
            conn.execute("UPDATE context_artifacts SET related_artifacts = ? WHERE id = ?",
                        (json.dumps(related1), artifact_id1))
            conn.execute("UPDATE context_artifacts SET related_artifacts = ? WHERE id = ?", 
                        (json.dumps(related2), artifact_id2))
            
            conn.commit()
            return True
    
    def update_artifact_relevance(self, artifact_id: str, relevance_score: float) -> bool:
        """Update artifact relevance score"""
        with sqlite3.connect(self.db_path) as conn:
            result = conn.execute("""
                UPDATE context_artifacts SET relevance_score = ?, updated_at = ? 
                WHERE id = ?
            """, (relevance_score, datetime.now().isoformat(), artifact_id))
            
            conn.commit()
            return result.rowcount > 0
    
    def get_context_for_orchestrator(self, task_id: str, context_types: List[ContextType] = None) -> Dict[str, Any]:
        """Get contextualized information for orchestrator decision making"""
        query = ContextQuery(
            types=context_types,
            scopes=[ContextScope.GLOBAL, ContextScope.PROJECT, ContextScope.TASK],
            task_id=task_id,
            min_relevance=0.3,
            max_results=10
        )
        
        artifacts = self.query_artifacts(query)
        
        # Group by type for structured context
        context = {
            "total_artifacts": len(artifacts),
            "by_type": {},
            "high_relevance": [],
            "recent_discoveries": []
        }
        
        for artifact in artifacts:
            type_key = artifact.type.value
            if type_key not in context["by_type"]:
                context["by_type"][type_key] = []
            
            context["by_type"][type_key].append({
                "id": artifact.id,
                "title": artifact.title,
                "relevance": artifact.relevance_score,
                "created_by": artifact.created_by
            })
            
            if artifact.relevance_score >= 0.8:
                context["high_relevance"].append(artifact.title)
            
            # Recent discoveries (last 24 hours)
            if (datetime.now() - artifact.created_at).days == 0:
                context["recent_discoveries"].append(artifact.title)
        
        return context
    
    def _row_to_artifact(self, row: sqlite3.Row) -> ContextArtifact:
        """Convert database row to ContextArtifact"""
        return ContextArtifact(
            id=row['id'],
            type=ContextType(row['type']),
            scope=ContextScope(row['scope']),
            title=row['title'],
            content=row['content'],
            metadata=json.loads(row['metadata']),
            created_at=datetime.fromisoformat(row['created_at']),
            updated_at=datetime.fromisoformat(row['updated_at']),
            created_by=row['created_by'],
            relevance_score=row['relevance_score'],
            access_count=row['access_count'],
            related_artifacts=json.loads(row['related_artifacts']),
            tags=json.loads(row['tags'])
        )
    
    def _filter_by_text_search(self, artifacts: List[ContextArtifact], search_text: str) -> List[ContextArtifact]:
        """Filter artifacts by text search"""
        search_lower = search_text.lower()
        filtered = []
        
        for artifact in artifacts:
            if (search_lower in artifact.title.lower() or 
                search_lower in artifact.content.lower() or
                any(search_lower in tag.lower() for tag in artifact.tags)):
                filtered.append(artifact)
        
        return filtered
    
    def _filter_by_tags(self, artifacts: List[ContextArtifact], required_tags: List[str]) -> List[ContextArtifact]:
        """Filter artifacts by tags"""
        filtered = []
        required_lower = [tag.lower() for tag in required_tags]
        
        for artifact in artifacts:
            artifact_tags_lower = [tag.lower() for tag in artifact.tags]
            if any(req_tag in artifact_tags_lower for req_tag in required_lower):
                filtered.append(artifact)
        
        return filtered
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get context store statistics"""
        with sqlite3.connect(self.db_path) as conn:
            stats = {}
            
            # Total artifacts
            result = conn.execute("SELECT COUNT(*) FROM context_artifacts").fetchone()
            stats["total_artifacts"] = result[0]
            
            # By type
            results = conn.execute("""
                SELECT type, COUNT(*) FROM context_artifacts GROUP BY type
            """).fetchall()
            stats["by_type"] = {row[0]: row[1] for row in results}
            
            # By scope
            results = conn.execute("""
                SELECT scope, COUNT(*) FROM context_artifacts GROUP BY scope
            """).fetchall()
            stats["by_scope"] = {row[0]: row[1] for row in results}
            
            # Average relevance
            result = conn.execute("SELECT AVG(relevance_score) FROM context_artifacts").fetchone()
            stats["average_relevance"] = result[0] or 0.0
            
            # Most accessed
            results = conn.execute("""
                SELECT title, access_count FROM context_artifacts 
                ORDER BY access_count DESC LIMIT 5
            """).fetchall()
            stats["most_accessed"] = [{"title": row[0], "count": row[1]} for row in results]
            
            return stats

# Integration functions for Orchestrator
def create_orchestrator_context_store() -> ContextStore:
    """Create context store instance for orchestrator use"""
    return ContextStore()

def store_discovery(context_store: ContextStore, title: str, content: str, 
                   created_by: str, task_id: str = None) -> str:
    """Convenience function to store a discovery artifact"""
    metadata = {}
    if task_id:
        metadata["task_id"] = task_id
    
    artifact = context_store.create_artifact(
        type=ContextType.DISCOVERY,
        scope=ContextScope.PROJECT if task_id else ContextScope.GLOBAL,
        title=title,
        content=content,
        created_by=created_by,
        metadata=metadata,
        tags=["discovery", "orchestrator"]
    )
    
    return artifact.id

def store_architectural_decision(context_store: ContextStore, title: str, content: str,
                               created_by: str, rationale: str = "") -> str:
    """Convenience function to store architectural decision"""
    artifact = context_store.create_artifact(
        type=ContextType.ARCHITECTURAL_DECISION,
        scope=ContextScope.PROJECT,
        title=title,
        content=content,
        created_by=created_by,
        metadata={"rationale": rationale},
        tags=["architecture", "decision"],
        relevance_score=0.9  # High relevance for architectural decisions
    )
    
    return artifact.id