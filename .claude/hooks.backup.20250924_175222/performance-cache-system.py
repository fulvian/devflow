#!/usr/bin/env python3
"""
DevFlow Performance Cache System v2.0
Intelligent caching layer for protocol operations and orchestrator routing

Features:
- Multi-level caching (memory, disk, database)
- Intelligent cache invalidation
- Performance metrics collection
- Context-aware cache keys
"""

import json
import sys
import os
import sqlite3
import time
import hashlib
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
from pathlib import Path
import threading
import pickle

# Configuration
CACHE_DIR = Path('/Users/fulvioventura/devflow/.claude/cache')
DB_PATH = Path('./data/devflow_unified.sqlite')
MEMORY_CACHE_SIZE = 1000  # Max items in memory
DISK_CACHE_TTL = 3600  # 1 hour in seconds
DATABASE_CACHE_TTL = 86400  # 24 hours in seconds

class CacheLevel:
    """Cache level enumeration"""
    MEMORY = 1
    DISK = 2
    DATABASE = 3

class PerformanceCache:
    """Multi-level intelligent cache system"""

    def __init__(self):
        self.memory_cache: Dict[str, Tuple[Any, float, Dict]] = {}  # key: (data, timestamp, metadata)
        self.cache_stats = {
            'hits': {'memory': 0, 'disk': 0, 'database': 0},
            'misses': 0,
            'evictions': 0,
            'invalidations': 0
        }
        self.lock = threading.RLock()

        # Ensure cache directory exists
        CACHE_DIR.mkdir(parents=True, exist_ok=True)

        # Initialize database cache tables
        self._init_database_cache()

    def _init_database_cache(self):
        """Initialize database cache tables"""
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS performance_cache (
                    cache_key TEXT PRIMARY KEY,
                    cache_data TEXT NOT NULL,
                    cache_metadata TEXT,
                    cache_level INTEGER DEFAULT 3,
                    ttl_seconds INTEGER DEFAULT 86400,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
                    access_count INTEGER DEFAULT 1
                )
            """)

            # Create index for performance
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_cache_created
                ON performance_cache(created_at)
            """)

            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_cache_accessed
                ON performance_cache(last_accessed)
            """)

            conn.commit()
            conn.close()

        except Exception as e:
            print(f"Error initializing cache database: {e}", file=sys.stderr)

    def get(self, key: str, default: Any = None) -> Optional[Any]:
        """Get item from cache with multi-level lookup"""
        with self.lock:
            # Level 1: Memory cache
            if key in self.memory_cache:
                data, timestamp, metadata = self.memory_cache[key]
                ttl = metadata.get('ttl', DISK_CACHE_TTL)

                if time.time() - timestamp < ttl:
                    self.cache_stats['hits']['memory'] += 1
                    return data
                else:
                    # Expired - remove from memory
                    del self.memory_cache[key]

            # Level 2: Disk cache
            disk_data = self._get_from_disk(key)
            if disk_data is not None:
                data, metadata = disk_data
                self.cache_stats['hits']['disk'] += 1

                # Promote to memory cache
                self._set_memory(key, data, metadata)
                return data

            # Level 3: Database cache
            db_data = self._get_from_database(key)
            if db_data is not None:
                data, metadata = db_data
                self.cache_stats['hits']['database'] += 1

                # Promote to higher levels
                self._set_memory(key, data, metadata)
                self._set_disk(key, data, metadata)
                return data

            # Cache miss
            self.cache_stats['misses'] += 1
            return default

    def set(self, key: str, data: Any, ttl: int = DISK_CACHE_TTL,
            metadata: Optional[Dict] = None, level: CacheLevel = CacheLevel.MEMORY) -> bool:
        """Set item in cache at specified level"""

        if metadata is None:
            metadata = {}

        metadata.update({
            'ttl': ttl,
            'cached_at': time.time(),
            'cache_level': level
        })

        try:
            with self.lock:
                if level >= CacheLevel.MEMORY:
                    self._set_memory(key, data, metadata)

                if level >= CacheLevel.DISK:
                    self._set_disk(key, data, metadata)

                if level >= CacheLevel.DATABASE:
                    self._set_database(key, data, metadata, ttl)

            return True

        except Exception as e:
            print(f"Error setting cache for key {key}: {e}", file=sys.stderr)
            return False

    def _set_memory(self, key: str, data: Any, metadata: Dict):
        """Set item in memory cache with LRU eviction"""
        current_time = time.time()

        # Check if memory cache is full
        if len(self.memory_cache) >= MEMORY_CACHE_SIZE and key not in self.memory_cache:
            # Evict oldest entry
            oldest_key = min(self.memory_cache.items(),
                           key=lambda x: x[1][1])  # Sort by timestamp
            del self.memory_cache[oldest_key[0]]
            self.cache_stats['evictions'] += 1

        self.memory_cache[key] = (data, current_time, metadata)

    def _set_disk(self, key: str, data: Any, metadata: Dict):
        """Set item in disk cache"""
        try:
            cache_file = CACHE_DIR / f"{key}.cache"
            cache_content = {
                'data': data,
                'metadata': metadata,
                'timestamp': time.time()
            }

            with open(cache_file, 'wb') as f:
                pickle.dump(cache_content, f)

        except Exception as e:
            print(f"Error writing disk cache: {e}", file=sys.stderr)

    def _set_database(self, key: str, data: Any, metadata: Dict, ttl: int):
        """Set item in database cache"""
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()

            cursor.execute("""
                INSERT OR REPLACE INTO performance_cache (
                    cache_key, cache_data, cache_metadata, ttl_seconds,
                    created_at, last_accessed, access_count
                ) VALUES (?, ?, ?, ?, ?, ?, 1)
            """, (
                key,
                json.dumps(data, default=str),
                json.dumps(metadata, default=str),
                ttl,
                datetime.now().isoformat(),
                datetime.now().isoformat()
            ))

            conn.commit()
            conn.close()

        except Exception as e:
            print(f"Error writing database cache: {e}", file=sys.stderr)

    def _get_from_disk(self, key: str) -> Optional[Tuple[Any, Dict]]:
        """Get item from disk cache"""
        try:
            cache_file = CACHE_DIR / f"{key}.cache"

            if not cache_file.exists():
                return None

            with open(cache_file, 'rb') as f:
                cache_content = pickle.load(f)

            timestamp = cache_content['timestamp']
            metadata = cache_content['metadata']
            ttl = metadata.get('ttl', DISK_CACHE_TTL)

            # Check if expired
            if time.time() - timestamp > ttl:
                cache_file.unlink()  # Delete expired cache
                return None

            return cache_content['data'], metadata

        except Exception:
            return None

    def _get_from_database(self, key: str) -> Optional[Tuple[Any, Dict]]:
        """Get item from database cache"""
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()

            cursor.execute("""
                SELECT cache_data, cache_metadata, created_at, ttl_seconds
                FROM performance_cache
                WHERE cache_key = ?
            """, (key,))

            result = cursor.fetchone()

            if result:
                data_json, metadata_json, created_at, ttl_seconds = result

                # Check if expired
                created_time = datetime.fromisoformat(created_at)
                if datetime.now() - created_time > timedelta(seconds=ttl_seconds):
                    # Delete expired cache
                    cursor.execute("DELETE FROM performance_cache WHERE cache_key = ?", (key,))
                    conn.commit()
                    conn.close()
                    return None

                # Update access statistics
                cursor.execute("""
                    UPDATE performance_cache
                    SET last_accessed = ?, access_count = access_count + 1
                    WHERE cache_key = ?
                """, (datetime.now().isoformat(), key))

                conn.commit()
                conn.close()

                # Parse data
                try:
                    data = json.loads(data_json)
                    metadata = json.loads(metadata_json)
                    return data, metadata
                except json.JSONDecodeError:
                    return None

            conn.close()
            return None

        except Exception:
            return None

    def invalidate(self, key: str) -> bool:
        """Invalidate cache entry across all levels"""
        try:
            with self.lock:
                # Memory cache
                if key in self.memory_cache:
                    del self.memory_cache[key]

                # Disk cache
                cache_file = CACHE_DIR / f"{key}.cache"
                if cache_file.exists():
                    cache_file.unlink()

                # Database cache
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute("DELETE FROM performance_cache WHERE cache_key = ?", (key,))
                conn.commit()
                conn.close()

                self.cache_stats['invalidations'] += 1
                return True

        except Exception as e:
            print(f"Error invalidating cache: {e}", file=sys.stderr)
            return False

    def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate all cache entries matching pattern"""
        invalidated_count = 0

        try:
            with self.lock:
                # Memory cache
                keys_to_remove = [k for k in self.memory_cache.keys() if pattern in k]
                for key in keys_to_remove:
                    del self.memory_cache[key]
                    invalidated_count += 1

                # Disk cache
                for cache_file in CACHE_DIR.glob(f"*{pattern}*.cache"):
                    cache_file.unlink()
                    invalidated_count += 1

                # Database cache
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute("DELETE FROM performance_cache WHERE cache_key LIKE ?", (f"%{pattern}%",))
                invalidated_count += cursor.rowcount
                conn.commit()
                conn.close()

                self.cache_stats['invalidations'] += invalidated_count
                return invalidated_count

        except Exception as e:
            print(f"Error invalidating pattern cache: {e}", file=sys.stderr)
            return 0

    def cleanup_expired(self) -> int:
        """Clean up expired cache entries"""
        cleaned_count = 0

        try:
            with self.lock:
                current_time = time.time()

                # Memory cache cleanup
                expired_memory_keys = []
                for key, (data, timestamp, metadata) in self.memory_cache.items():
                    ttl = metadata.get('ttl', DISK_CACHE_TTL)
                    if current_time - timestamp > ttl:
                        expired_memory_keys.append(key)

                for key in expired_memory_keys:
                    del self.memory_cache[key]
                    cleaned_count += 1

                # Disk cache cleanup
                for cache_file in CACHE_DIR.glob("*.cache"):
                    try:
                        stat = cache_file.stat()
                        if current_time - stat.st_mtime > DISK_CACHE_TTL:
                            cache_file.unlink()
                            cleaned_count += 1
                    except Exception:
                        pass

                # Database cache cleanup
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute("""
                    DELETE FROM performance_cache
                    WHERE datetime('now') > datetime(created_at, '+' || ttl_seconds || ' seconds')
                """)
                cleaned_count += cursor.rowcount
                conn.commit()
                conn.close()

                return cleaned_count

        except Exception as e:
            print(f"Error during cache cleanup: {e}", file=sys.stderr)
            return 0

    def get_stats(self) -> Dict[str, Any]:
        """Get cache performance statistics"""
        with self.lock:
            total_hits = sum(self.cache_stats['hits'].values())
            total_requests = total_hits + self.cache_stats['misses']

            hit_rate = (total_hits / total_requests * 100) if total_requests > 0 else 0

            return {
                'hit_rate_percentage': round(hit_rate, 2),
                'total_requests': total_requests,
                'hits_by_level': self.cache_stats['hits'].copy(),
                'misses': self.cache_stats['misses'],
                'evictions': self.cache_stats['evictions'],
                'invalidations': self.cache_stats['invalidations'],
                'memory_cache_size': len(self.memory_cache),
                'timestamp': datetime.now().isoformat()
            }

class ContextAwareCacheKeyGenerator:
    """Generates intelligent cache keys based on context"""

    @staticmethod
    def generate_orchestrator_key(tool_name: str, tool_input: Dict, context: Dict = None) -> str:
        """Generate cache key for orchestrator routing decisions"""

        # Create deterministic content hash
        content_components = [
            tool_name,
            json.dumps(tool_input, sort_keys=True),
        ]

        if context:
            # Include relevant context elements
            relevant_context = {
                'project_id': context.get('project_id'),
                'complexity_score': context.get('complexity_score'),
                'operation_type': context.get('operation_type')
            }
            content_components.append(json.dumps(relevant_context, sort_keys=True))

        combined_content = '|'.join(content_components)
        content_hash = hashlib.sha256(combined_content.encode()).hexdigest()[:16]

        return f"orchestrator_{tool_name}_{content_hash}"

    @staticmethod
    def generate_verification_key(agent: str, operation_type: str, complexity: float) -> str:
        """Generate cache key for verification results"""
        key_components = [agent, operation_type, f"complexity_{int(complexity)}"]
        combined = '_'.join(key_components)
        return f"verification_{combined}"

    @staticmethod
    def generate_cometa_key(intent_category: str, context_hash: str) -> str:
        """Generate cache key for Cometa Brain results"""
        return f"cometa_{intent_category}_{context_hash[:8]}"

# Global cache instance
performance_cache = PerformanceCache()

def cache_orchestrator_result(tool_name: str, tool_input: Dict, result: Dict,
                             context: Dict = None, ttl: int = 1800) -> bool:
    """Cache orchestrator routing result"""
    cache_key = ContextAwareCacheKeyGenerator.generate_orchestrator_key(
        tool_name, tool_input, context
    )

    metadata = {
        'type': 'orchestrator_result',
        'tool_name': tool_name,
        'agent_used': result.get('agent_used'),
        'success': result.get('success', False)
    }

    return performance_cache.set(cache_key, result, ttl, metadata, CacheLevel.DISK)

def get_cached_orchestrator_result(tool_name: str, tool_input: Dict,
                                  context: Dict = None) -> Optional[Dict]:
    """Get cached orchestrator routing result"""
    cache_key = ContextAwareCacheKeyGenerator.generate_orchestrator_key(
        tool_name, tool_input, context
    )
    return performance_cache.get(cache_key)

def cache_verification_result(agent: str, operation_type: str, complexity: float,
                            result: Dict, ttl: int = 3600) -> bool:
    """Cache verification result"""
    cache_key = ContextAwareCacheKeyGenerator.generate_verification_key(
        agent, operation_type, complexity
    )

    metadata = {
        'type': 'verification_result',
        'agent': agent,
        'operation_type': operation_type,
        'complexity': complexity
    }

    return performance_cache.set(cache_key, result, ttl, metadata, CacheLevel.DATABASE)

def get_cached_verification_result(agent: str, operation_type: str,
                                 complexity: float) -> Optional[Dict]:
    """Get cached verification result"""
    cache_key = ContextAwareCacheKeyGenerator.generate_verification_key(
        agent, operation_type, complexity
    )
    return performance_cache.get(cache_key)

def invalidate_agent_cache(agent: str):
    """Invalidate all cache entries for specific agent"""
    return performance_cache.invalidate_pattern(agent)

def cleanup_cache():
    """Clean up expired cache entries"""
    return performance_cache.cleanup_expired()

def get_cache_stats() -> Dict[str, Any]:
    """Get cache performance statistics"""
    return performance_cache.get_stats()

if __name__ == "__main__":
    # Cache management CLI
    import argparse

    parser = argparse.ArgumentParser(description="DevFlow Performance Cache Management")
    parser.add_argument('action', choices=['stats', 'cleanup', 'invalidate'])
    parser.add_argument('--pattern', help="Pattern to invalidate (for invalidate action)")

    args = parser.parse_args()

    if args.action == 'stats':
        stats = get_cache_stats()
        print(json.dumps(stats, indent=2))
    elif args.action == 'cleanup':
        cleaned = cleanup_cache()
        print(f"Cleaned up {cleaned} expired cache entries")
    elif args.action == 'invalidate':
        if args.pattern:
            invalidated = performance_cache.invalidate_pattern(args.pattern)
            print(f"Invalidated {invalidated} cache entries matching '{args.pattern}'")
        else:
            print("Error: --pattern is required for invalidate action")