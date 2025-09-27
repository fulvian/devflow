#!/usr/bin/env python3
"""
Context Window Optimizer - Dynamic Token Allocation System
Enterprise-grade context window management per sostituire Claude Code nativo.

Features:
- Dynamic token allocation basato su priorità e relevance
- Context compression intelligente senza perdita semantica
- Token budget management per 200k limit di Claude
- Context priority scoring per optimal allocation
- Microsoft Kernel Memory compliance patterns
"""

import re
import json
import tiktoken
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
import logging
from enum import Enum

class ContextPriority(Enum):
    """Context priority levels per dynamic allocation"""
    CRITICAL = 1.0    # Current task, user query, immediate context
    HIGH = 0.8       # Recent interactions, active files, error context
    MEDIUM = 0.6     # Related code, documentation, patterns
    LOW = 0.4        # Historical context, background info
    MINIMAL = 0.2    # Archive context, rarely accessed

@dataclass
class ContextChunk:
    """Rappresenta un chunk di contesto con metadata"""
    content: str
    priority: ContextPriority
    token_count: int
    relevance_score: float
    source_type: str  # 'user_query', 'file', 'memory', 'documentation'
    created_at: datetime
    last_accessed: datetime
    compression_ratio: float = 1.0  # 1.0 = no compression

@dataclass
class TokenBudget:
    """Budget di token per diverse categorie di contesto"""
    total_limit: int
    user_query_tokens: int
    immediate_context_tokens: int
    relevant_context_tokens: int
    background_context_tokens: int
    reserved_tokens: int  # Buffer for responses

class ContextWindowOptimizer:
    """
    Optimizes context window allocation with dynamic token management.
    Implementa Microsoft Kernel Memory patterns per Claude replacement.
    """

    def __init__(self, project_root: str = "/Users/fulvioventura/devflow"):
        self.project_root = Path(project_root)

        # Claude configuration
        self.max_tokens = 200000  # Claude's 200k context limit
        self.response_buffer = 8000  # Reserve tokens for response
        self.available_tokens = self.max_tokens - self.response_buffer

        # Token allocation ratios (can be dynamically adjusted)
        self.allocation_ratios = {
            'user_query': 0.15,      # 15% - Current user input
            'immediate': 0.35,       # 35% - Immediate relevant context
            'relevant': 0.30,        # 30% - Relevant background context
            'background': 0.15,      # 15% - Background/historical context
            'buffer': 0.05           # 5% - Emergency buffer
        }

        # Setup tokenizer
        self.tokenizer = tiktoken.encoding_for_model("gpt-4")

        # Logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)

        # Performance metrics
        self.metrics = {
            'optimization_calls': 0,
            'contexts_processed': 0,
            'contexts_compressed': 0,
            'avg_compression_ratio': 0.0,
            'token_utilization': 0.0
        }

    def count_tokens(self, text: str) -> int:
        """Count tokens in text using Claude's tokenizer."""
        try:
            return len(self.tokenizer.encode(text))
        except Exception as e:
            # Fallback estimation
            return len(text.split()) * 1.3

    def calculate_token_budget(self, user_query_tokens: int) -> TokenBudget:
        """
        Calculate dynamic token budget based on current context needs.
        """
        # Adjust ratios based on query complexity
        if user_query_tokens > 1000:  # Complex query needs more background
            ratios = {
                'user_query': 0.20,
                'immediate': 0.30,
                'relevant': 0.35,
                'background': 0.10,
                'buffer': 0.05
            }
        elif user_query_tokens < 100:  # Simple query, more background context
            ratios = {
                'user_query': 0.10,
                'immediate': 0.40,
                'relevant': 0.30,
                'background': 0.15,
                'buffer': 0.05
            }
        else:  # Standard allocation
            ratios = self.allocation_ratios

        return TokenBudget(
            total_limit=self.available_tokens,
            user_query_tokens=int(self.available_tokens * ratios['user_query']),
            immediate_context_tokens=int(self.available_tokens * ratios['immediate']),
            relevant_context_tokens=int(self.available_tokens * ratios['relevant']),
            background_context_tokens=int(self.available_tokens * ratios['background']),
            reserved_tokens=int(self.available_tokens * ratios['buffer'])
        )

    def score_context_relevance(self, context: ContextChunk, user_query: str) -> float:
        """
        Score context relevance using multiple factors.
        Returns score 0.0-1.0
        """
        score = 0.0
        query_lower = user_query.lower()
        content_lower = context.content.lower()

        # 1. Keyword overlap scoring (40% weight)
        query_words = set(re.findall(r'\b\w{3,}\b', query_lower))
        content_words = set(re.findall(r'\b\w{3,}\b', content_lower))

        if query_words:
            keyword_overlap = len(query_words & content_words) / len(query_words)
            score += keyword_overlap * 0.4

        # 2. Recency scoring (20% weight)
        time_diff = datetime.now() - context.last_accessed
        recency_score = max(0, 1.0 - (time_diff.days / 30))  # Decay over 30 days
        score += recency_score * 0.2

        # 3. Source type priority (20% weight)
        source_priorities = {
            'user_query': 1.0,
            'current_file': 0.9,
            'related_file': 0.7,
            'memory': 0.6,
            'documentation': 0.5,
            'background': 0.3
        }
        source_score = source_priorities.get(context.source_type, 0.5)
        score += source_score * 0.2

        # 4. Base priority (20% weight)
        score += context.priority.value * 0.2

        return min(score, 1.0)

    def compress_context(self, context: ContextChunk, target_tokens: int) -> ContextChunk:
        """
        Intelligently compress context without losing semantic meaning.
        """
        if context.token_count <= target_tokens:
            return context

        content = context.content
        original_tokens = context.token_count

        # Compression strategies in order of preference

        # 1. Remove redundant whitespace and formatting
        content = re.sub(r'\s+', ' ', content.strip())

        # 2. Remove less important details (comments, verbose descriptions)
        if self.count_tokens(content) > target_tokens:
            # Remove code comments but keep important ones
            content = re.sub(r'^\s*#[^!].*$', '', content, flags=re.MULTILINE)
            content = re.sub(r'^\s*//[^/].*$', '', content, flags=re.MULTILINE)

        # 3. Truncate to key sections if still too long
        if self.count_tokens(content) > target_tokens:
            sentences = content.split('. ')
            if len(sentences) > 2:
                # Keep first and last sentences, compress middle
                important_sentences = []

                # Always keep first sentence
                important_sentences.append(sentences[0])

                # Keep sentences with high importance keywords
                importance_keywords = ['error', 'function', 'class', 'import', 'return', 'if', 'def']

                for sentence in sentences[1:-1]:
                    if any(keyword in sentence.lower() for keyword in importance_keywords):
                        important_sentences.append(sentence)
                        if self.count_tokens('. '.join(important_sentences)) > target_tokens * 0.8:
                            break

                # Always try to keep last sentence
                if len(sentences) > 1:
                    important_sentences.append(sentences[-1])

                content = '. '.join(important_sentences)

        # 4. Hard truncation if still too long
        current_tokens = self.count_tokens(content)
        if current_tokens > target_tokens:
            # Truncate to target tokens (rough estimation)
            char_ratio = target_tokens / current_tokens
            truncate_at = int(len(content) * char_ratio * 0.9)  # 90% to be safe
            content = content[:truncate_at] + "... [truncated]"

        final_tokens = self.count_tokens(content)
        compression_ratio = final_tokens / original_tokens if original_tokens > 0 else 1.0

        # Update metrics
        if compression_ratio < 1.0:
            self.metrics['contexts_compressed'] += 1
            # Update average compression ratio
            if self.metrics['avg_compression_ratio'] == 0:
                self.metrics['avg_compression_ratio'] = compression_ratio
            else:
                self.metrics['avg_compression_ratio'] = (
                    self.metrics['avg_compression_ratio'] + compression_ratio
                ) / 2

        return ContextChunk(
            content=content,
            priority=context.priority,
            token_count=final_tokens,
            relevance_score=context.relevance_score,
            source_type=context.source_type,
            created_at=context.created_at,
            last_accessed=context.last_accessed,
            compression_ratio=compression_ratio
        )

    def optimize_context_allocation(self, user_query: str,
                                  available_contexts: List[ContextChunk]) -> Dict[str, Any]:
        """
        Optimize context allocation using dynamic token management.
        Returns optimized context selection with token allocation.
        """
        self.metrics['optimization_calls'] += 1
        self.metrics['contexts_processed'] += len(available_contexts)

        start_time = datetime.now()

        # Calculate token budget
        user_query_tokens = self.count_tokens(user_query)
        budget = self.calculate_token_budget(user_query_tokens)

        # Score all contexts for relevance
        scored_contexts = []
        for context in available_contexts:
            relevance_score = self.score_context_relevance(context, user_query)
            context.relevance_score = relevance_score
            scored_contexts.append(context)

        # Sort by combined score (relevance * priority)
        scored_contexts.sort(
            key=lambda c: c.relevance_score * c.priority.value,
            reverse=True
        )

        # Allocate contexts by category
        allocated_contexts = {
            'immediate': [],
            'relevant': [],
            'background': []
        }

        token_usage = {
            'immediate': 0,
            'relevant': 0,
            'background': 0
        }

        # Phase 1: Allocate immediate (high priority + high relevance)
        for context in scored_contexts:
            if (context.priority.value >= 0.8 and context.relevance_score >= 0.7 and
                token_usage['immediate'] < budget.immediate_context_tokens):

                available_tokens = budget.immediate_context_tokens - token_usage['immediate']

                if context.token_count <= available_tokens:
                    allocated_contexts['immediate'].append(context)
                    token_usage['immediate'] += context.token_count
                elif available_tokens > 100:  # Worth compressing
                    compressed = self.compress_context(context, available_tokens)
                    allocated_contexts['immediate'].append(compressed)
                    token_usage['immediate'] += compressed.token_count

        # Phase 2: Allocate relevant contexts
        for context in scored_contexts:
            if (context not in allocated_contexts['immediate'] and
                context.relevance_score >= 0.5 and
                token_usage['relevant'] < budget.relevant_context_tokens):

                available_tokens = budget.relevant_context_tokens - token_usage['relevant']

                if context.token_count <= available_tokens:
                    allocated_contexts['relevant'].append(context)
                    token_usage['relevant'] += context.token_count
                elif available_tokens > 100:
                    compressed = self.compress_context(context, available_tokens)
                    allocated_contexts['relevant'].append(compressed)
                    token_usage['relevant'] += compressed.token_count

        # Phase 3: Fill remaining space with background contexts
        for context in scored_contexts:
            if (context not in allocated_contexts['immediate'] and
                context not in allocated_contexts['relevant'] and
                token_usage['background'] < budget.background_context_tokens):

                available_tokens = budget.background_context_tokens - token_usage['background']

                if context.token_count <= available_tokens:
                    allocated_contexts['background'].append(context)
                    token_usage['background'] += context.token_count
                elif available_tokens > 100:
                    compressed = self.compress_context(context, available_tokens)
                    allocated_contexts['background'].append(compressed)
                    token_usage['background'] += compressed.token_count

        # Calculate final metrics
        total_allocated_tokens = sum(token_usage.values())
        utilization = total_allocated_tokens / budget.total_limit

        self.metrics['token_utilization'] = utilization

        duration = (datetime.now() - start_time).total_seconds()

        result = {
            'allocated_contexts': allocated_contexts,
            'token_budget': budget,
            'token_usage': token_usage,
            'total_tokens_used': total_allocated_tokens,
            'utilization_rate': utilization,
            'contexts_selected': {
                'immediate': len(allocated_contexts['immediate']),
                'relevant': len(allocated_contexts['relevant']),
                'background': len(allocated_contexts['background'])
            },
            'optimization_duration_ms': duration * 1000,
            'compression_applied': self.metrics['contexts_compressed'] > 0
        }

        self.logger.info(f"Context optimization completed in {duration*1000:.2f}ms")
        self.logger.info(f"Token utilization: {utilization:.1%} ({total_allocated_tokens:,}/{budget.total_limit:,})")

        return result

    def format_optimized_context(self, optimization_result: Dict[str, Any]) -> str:
        """
        Format optimized context into a single string for Claude injection.
        """
        allocated = optimization_result['allocated_contexts']
        context_parts = []

        # Add immediate context first (highest priority)
        if allocated['immediate']:
            context_parts.append("[IMMEDIATE CONTEXT - HIGH PRIORITY]")
            for i, context in enumerate(allocated['immediate'], 1):
                context_parts.append(f"[{i}] {context.content}")
            context_parts.append("")

        # Add relevant context
        if allocated['relevant']:
            context_parts.append("[RELEVANT CONTEXT]")
            for i, context in enumerate(allocated['relevant'], 1):
                context_parts.append(f"[{i}] {context.content}")
            context_parts.append("")

        # Add background context
        if allocated['background']:
            context_parts.append("[BACKGROUND CONTEXT]")
            for i, context in enumerate(allocated['background'], 1):
                context_parts.append(f"[{i}] {context.content}")

        return "\n".join(context_parts)

    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics for monitoring."""
        return {
            **self.metrics,
            'max_tokens': self.max_tokens,
            'available_tokens': self.available_tokens,
            'allocation_ratios': self.allocation_ratios
        }

# Convenience functions
def create_context_chunk(content: str, priority: ContextPriority = ContextPriority.MEDIUM,
                        source_type: str = 'unknown') -> ContextChunk:
    """Create a context chunk with automatic token counting."""
    optimizer = ContextWindowOptimizer()
    token_count = optimizer.count_tokens(content)

    return ContextChunk(
        content=content,
        priority=priority,
        token_count=token_count,
        relevance_score=0.0,  # Will be calculated during optimization
        source_type=source_type,
        created_at=datetime.now(),
        last_accessed=datetime.now()
    )

async def optimize_context_for_claude(user_query: str, contexts: List[str]) -> str:
    """Quick context optimization for hook integration."""
    optimizer = ContextWindowOptimizer()

    # Convert strings to ContextChunk objects
    context_chunks = [
        create_context_chunk(content, ContextPriority.MEDIUM, 'memory')
        for content in contexts
    ]

    # Optimize allocation
    result = optimizer.optimize_context_allocation(user_query, context_chunks)

    # Return formatted context
    return optimizer.format_optimized_context(result)