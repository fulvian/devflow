#!/usr/bin/env python3
"""
Context7 Retrieval Precision Optimizer
Hybrid retrieval system for enhanced precision using BM25 + semantic similarity

Implementa ottimizzazioni per migliorare retrieval precision da 0.67 a >0.70
usando pattern avanzati da hybrid retrieval systems e semantic search optimization.

Features:
- Hybrid BM25 + TF-IDF retrieval system
- Dynamic ranking optimization
- Precision-recall optimization
- Context relevance scoring
- Multi-stage retrieval pipeline
- Performance monitoring integration
"""

import json
import sqlite3
import numpy as np
import logging
import math
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any, Set
from dataclasses import dataclass
import re
from collections import Counter, defaultdict
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class RetrievalMetrics:
    """Structured retrieval precision metrics container"""
    # Core precision metrics
    precision_at_k: Dict[int, float]  # Precision@K for different K values
    recall_at_k: Dict[int, float]     # Recall@K for different K values
    f1_at_k: Dict[int, float]         # F1@K for different K values
    map_score: float                  # Mean Average Precision
    mrr_score: float                  # Mean Reciprocal Rank

    # Hybrid retrieval metrics
    bm25_contribution: float          # BM25 algorithm contribution weight
    tfidf_contribution: float         # TF-IDF algorithm contribution weight
    semantic_contribution: float      # Semantic similarity contribution weight
    hybrid_effectiveness: float       # Effectiveness of hybrid approach

    # Context-specific metrics
    context_relevance: float          # Average context relevance score
    query_coverage: float             # How well contexts cover query intent
    result_diversity: float           # Diversity of retrieved results
    ranking_quality: float            # Quality of result ranking

    # Meta-metrics
    composite_precision: float        # Weighted composite precision score
    precision_confidence: float       # Confidence in precision measurement
    optimization_potential: float     # Potential for further optimization

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'precision_at_k': self.precision_at_k,
            'recall_at_k': self.recall_at_k,
            'f1_at_k': self.f1_at_k,
            'map_score': self.map_score,
            'mrr_score': self.mrr_score,
            'bm25_contribution': self.bm25_contribution,
            'tfidf_contribution': self.tfidf_contribution,
            'semantic_contribution': self.semantic_contribution,
            'hybrid_effectiveness': self.hybrid_effectiveness,
            'context_relevance': self.context_relevance,
            'query_coverage': self.query_coverage,
            'result_diversity': self.result_diversity,
            'ranking_quality': self.ranking_quality,
            'composite_precision': self.composite_precision,
            'precision_confidence': self.precision_confidence,
            'optimization_potential': self.optimization_potential
        }

class BM25Ranker:
    """
    BM25 (Best Matching 25) ranking algorithm implementation
    Following hybrid retrieval system patterns
    """

    def __init__(self, k1: float = 1.2, b: float = 0.75):
        self.k1 = k1  # Term frequency saturation parameter
        self.b = b    # Length normalization parameter
        self.documents = []
        self.doc_freqs = []
        self.idf = {}
        self.doc_lengths = []
        self.avgdl = 0.0
        self.fitted = False

    def fit(self, documents: List[str]) -> None:
        """
        Fit BM25 parameters to document collection
        """
        self.documents = documents
        self.doc_lengths = []
        self.doc_freqs = []

        # Tokenize documents and calculate term frequencies
        for doc in documents:
            tokens = self._tokenize(doc)
            self.doc_lengths.append(len(tokens))

            # Calculate term frequencies for this document
            term_freqs = Counter(tokens)
            self.doc_freqs.append(term_freqs)

        # Calculate average document length
        self.avgdl = sum(self.doc_lengths) / len(self.doc_lengths) if self.doc_lengths else 0

        # Calculate IDF for each term
        self.idf = {}
        all_terms = set()
        for term_freqs in self.doc_freqs:
            all_terms.update(term_freqs.keys())

        for term in all_terms:
            # Count documents containing this term
            df = sum(1 for term_freqs in self.doc_freqs if term in term_freqs)

            # Calculate IDF: log((N - df + 0.5) / (df + 0.5))
            # Adding smoothing to avoid division by zero
            self.idf[term] = math.log((len(documents) - df + 0.5) / (df + 0.5))

        self.fitted = True

    def _tokenize(self, text: str) -> List[str]:
        """
        Simple tokenization - can be enhanced with proper NLP tokenizer
        """
        # Remove punctuation and convert to lowercase
        text = re.sub(r'[^\w\s]', '', text.lower())
        # Split into tokens
        tokens = text.split()
        return tokens

    def get_scores(self, query: str) -> np.ndarray:
        """
        Calculate BM25 scores for query against all documents
        """
        if not self.fitted:
            raise ValueError("BM25 ranker must be fitted before scoring")

        query_tokens = self._tokenize(query)
        scores = np.zeros(len(self.documents))

        for i, doc_term_freqs in enumerate(self.doc_freqs):
            score = 0.0
            doc_length = self.doc_lengths[i]

            for term in query_tokens:
                if term in doc_term_freqs:
                    # Term frequency in document
                    tf = doc_term_freqs[term]

                    # IDF component
                    idf = self.idf.get(term, 0)

                    # BM25 score component for this term
                    numerator = tf * (self.k1 + 1)
                    denominator = tf + self.k1 * (1 - self.b + self.b * (doc_length / self.avgdl))

                    score += idf * (numerator / denominator)

            scores[i] = score

        return scores

class RetrievalPrecisionOptimizer:
    """
    Advanced retrieval precision optimizer per Context7
    Implements hybrid BM25 + TF-IDF + semantic similarity approach
    """

    def __init__(self, project_root: str = "/Users/fulvioventura/devflow"):
        self.project_root = Path(project_root)
        self.db_path = self.project_root / "data" / "devflow_unified.sqlite"

        # Initialize rankers
        self.bm25_ranker = BM25Ranker()
        self.tfidf_vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            ngram_range=(1, 2),
            min_df=1,
            max_df=0.95
        )

        # Hybrid weights (tunable for optimization)
        self.hybrid_weights = {
            'bm25': 0.4,     # BM25 weight
            'tfidf': 0.4,    # TF-IDF weight
            'semantic': 0.2  # Semantic similarity weight
        }

        # Precision optimization parameters
        self.precision_target = 0.7  # Target precision score
        self.k_values = [1, 3, 5, 10]  # K values for precision@K evaluation

    def preprocess_text(self, text: str) -> str:
        """
        Enhanced text preprocessing for retrieval optimization
        """
        if not text:
            return ""

        # Convert to lowercase
        text = text.lower()

        # Remove extra whitespace
        text = ' '.join(text.split())

        return text

    def extract_query_terms(self, query: str) -> Set[str]:
        """
        Extract important terms from query for relevance assessment
        """
        preprocessed = self.preprocess_text(query)

        # Simple tokenization (can be enhanced)
        terms = set(preprocessed.split())

        # Remove common stop words manually
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'}

        terms = terms - stop_words

        return terms

    def calculate_context_relevance(self, context: Dict[str, Any], query_terms: Set[str]) -> float:
        """
        Calculate relevance score for a single context
        Based on term overlap and semantic indicators
        """
        content = context.get('content', '')
        if not content:
            return 0.0

        # Preprocess content
        preprocessed_content = self.preprocess_text(content)
        content_terms = set(preprocessed_content.split())

        if not content_terms or not query_terms:
            return 0.0

        # Calculate multiple relevance signals

        # 1. Term overlap (Jaccard similarity)
        intersection = len(query_terms.intersection(content_terms))
        union = len(query_terms.union(content_terms))
        jaccard = intersection / union if union > 0 else 0.0

        # 2. Query term coverage
        coverage = intersection / len(query_terms) if len(query_terms) > 0 else 0.0

        # 3. Content density (relevant terms density)
        density = intersection / len(content_terms) if len(content_terms) > 0 else 0.0

        # 4. Term frequency boost for important query terms
        tf_boost = 0.0
        for term in query_terms:
            if term in preprocessed_content:
                # Count occurrences and give boost based on frequency
                count = preprocessed_content.count(term)
                tf_boost += min(count * 0.1, 0.3)  # Cap boost per term

        tf_boost = min(tf_boost, 0.5)  # Cap total TF boost

        # Combine relevance signals
        relevance = (jaccard * 0.3 + coverage * 0.3 + density * 0.2 + tf_boost * 0.2)

        return min(1.0, relevance)

    def calculate_precision_at_k(self, ranked_contexts: List[Dict[str, Any]],
                                relevant_context_ids: Set[str], k: int) -> float:
        """
        Calculate Precision@K metric
        """
        if k <= 0 or not ranked_contexts:
            return 0.0

        # Get top K results
        top_k = ranked_contexts[:k]

        # Count relevant results in top K
        relevant_in_top_k = sum(1 for ctx in top_k if ctx.get('id') in relevant_context_ids)

        return relevant_in_top_k / k

    def calculate_recall_at_k(self, ranked_contexts: List[Dict[str, Any]],
                             relevant_context_ids: Set[str], k: int) -> float:
        """
        Calculate Recall@K metric
        """
        if k <= 0 or not ranked_contexts or not relevant_context_ids:
            return 0.0

        # Get top K results
        top_k = ranked_contexts[:k]

        # Count relevant results in top K
        relevant_in_top_k = sum(1 for ctx in top_k if ctx.get('id') in relevant_context_ids)

        return relevant_in_top_k / len(relevant_context_ids)

    def calculate_f1_at_k(self, precision: float, recall: float) -> float:
        """
        Calculate F1@K metric from precision and recall
        """
        if precision + recall == 0:
            return 0.0

        return 2 * (precision * recall) / (precision + recall)

    def calculate_map_score(self, ranked_contexts: List[Dict[str, Any]],
                           relevant_context_ids: Set[str]) -> float:
        """
        Calculate Mean Average Precision (MAP)
        """
        if not ranked_contexts or not relevant_context_ids:
            return 0.0

        ap_scores = []
        relevant_found = 0

        for i, context in enumerate(ranked_contexts):
            if context.get('id') in relevant_context_ids:
                relevant_found += 1
                precision_at_i = relevant_found / (i + 1)
                ap_scores.append(precision_at_i)

        if not ap_scores:
            return 0.0

        return sum(ap_scores) / len(relevant_context_ids)

    def calculate_mrr_score(self, ranked_contexts: List[Dict[str, Any]],
                           relevant_context_ids: Set[str]) -> float:
        """
        Calculate Mean Reciprocal Rank (MRR)
        """
        if not ranked_contexts or not relevant_context_ids:
            return 0.0

        for i, context in enumerate(ranked_contexts):
            if context.get('id') in relevant_context_ids:
                return 1.0 / (i + 1)

        return 0.0

    def calculate_result_diversity(self, ranked_contexts: List[Dict[str, Any]]) -> float:
        """
        Calculate diversity of retrieved results
        Based on content similarity between results
        """
        if len(ranked_contexts) < 2:
            return 1.0  # Perfect diversity for single result

        contents = [ctx.get('content', '') for ctx in ranked_contexts]

        try:
            # Calculate TF-IDF vectors for contexts
            preprocessed_contents = [self.preprocess_text(c) for c in contents]

            # Filter out empty contents
            valid_contents = [c for c in preprocessed_contents if c.strip()]
            if len(valid_contents) < 2:
                return 1.0

            tfidf_matrix = self.tfidf_vectorizer.fit_transform(valid_contents)

            # Calculate pairwise similarities
            similarity_matrix = cosine_similarity(tfidf_matrix)

            # Calculate average pairwise similarity (excluding diagonal)
            mask = np.ones_like(similarity_matrix, dtype=bool)
            np.fill_diagonal(mask, False)

            avg_similarity = similarity_matrix[mask].mean()

            # Diversity = 1 - similarity
            diversity = 1.0 - avg_similarity

            return max(0.0, min(1.0, diversity))

        except Exception as e:
            logger.warning(f"Diversity calculation failed: {e}")
            return 0.5  # Default moderate diversity

    def hybrid_rank_contexts(self, contexts: List[Dict[str, Any]], query: str) -> List[Tuple[Dict[str, Any], float]]:
        """
        Rank contexts using hybrid BM25 + TF-IDF + semantic approach
        """
        if not contexts:
            return []

        # Extract contents
        contents = [ctx.get('content', '') for ctx in contexts]

        # Preprocess contents
        preprocessed_contents = [self.preprocess_text(c) for c in contents]

        # Filter out empty contents and corresponding contexts
        valid_pairs = [(ctx, content) for ctx, content in zip(contexts, preprocessed_contents) if content.strip()]

        if not valid_pairs:
            return []

        valid_contexts, valid_contents = zip(*valid_pairs)
        valid_contexts = list(valid_contexts)
        valid_contents = list(valid_contents)

        scores = np.zeros(len(valid_contexts))

        # 1. BM25 scoring
        try:
            self.bm25_ranker.fit(valid_contents)
            bm25_scores = self.bm25_ranker.get_scores(query)

            # Normalize BM25 scores
            if bm25_scores.max() > 0:
                bm25_scores = bm25_scores / bm25_scores.max()

            scores += self.hybrid_weights['bm25'] * bm25_scores

        except Exception as e:
            logger.warning(f"BM25 scoring failed: {e}")

        # 2. TF-IDF scoring
        try:
            # Add query to contents for vectorization
            all_contents = [self.preprocess_text(query)] + valid_contents
            tfidf_matrix = self.tfidf_vectorizer.fit_transform(all_contents)

            query_vector = tfidf_matrix[0:1]  # First row is query
            content_vectors = tfidf_matrix[1:]  # Rest are contents

            # Calculate cosine similarities
            tfidf_similarities = cosine_similarity(query_vector, content_vectors).flatten()

            scores += self.hybrid_weights['tfidf'] * tfidf_similarities

        except Exception as e:
            logger.warning(f"TF-IDF scoring failed: {e}")

        # 3. Semantic scoring (using enhanced relevance calculation)
        try:
            query_terms = self.extract_query_terms(query)
            semantic_scores = np.array([
                self.calculate_context_relevance(ctx, query_terms)
                for ctx in valid_contexts
            ])

            scores += self.hybrid_weights['semantic'] * semantic_scores

        except Exception as e:
            logger.warning(f"Semantic scoring failed: {e}")

        # Combine contexts with their scores
        context_score_pairs = list(zip(valid_contexts, scores))

        # Sort by score (descending)
        context_score_pairs.sort(key=lambda x: x[1], reverse=True)

        return context_score_pairs

    def optimize_retrieval_precision(self, contexts: List[Dict[str, Any]],
                                   query: str,
                                   relevant_context_ids: Set[str]) -> RetrievalMetrics:
        """
        Main retrieval precision optimization function
        Calculates comprehensive precision metrics and optimizes ranking
        """
        # Rank contexts using hybrid approach
        ranked_context_pairs = self.hybrid_rank_contexts(contexts, query)
        ranked_contexts = [ctx for ctx, score in ranked_context_pairs]
        ranking_scores = [score for ctx, score in ranked_context_pairs]

        # Calculate precision metrics for different K values
        precision_at_k = {}
        recall_at_k = {}
        f1_at_k = {}

        for k in self.k_values:
            precision = self.calculate_precision_at_k(ranked_contexts, relevant_context_ids, k)
            recall = self.calculate_recall_at_k(ranked_contexts, relevant_context_ids, k)
            f1 = self.calculate_f1_at_k(precision, recall)

            precision_at_k[k] = precision
            recall_at_k[k] = recall
            f1_at_k[k] = f1

        # Calculate MAP and MRR
        map_score = self.calculate_map_score(ranked_contexts, relevant_context_ids)
        mrr_score = self.calculate_mrr_score(ranked_contexts, relevant_context_ids)

        # Calculate additional metrics
        query_terms = self.extract_query_terms(query)
        context_relevance_scores = [
            self.calculate_context_relevance(ctx, query_terms)
            for ctx in ranked_contexts
        ]

        context_relevance = np.mean(context_relevance_scores) if context_relevance_scores else 0.0

        # Query coverage (how well top results cover query intent)
        top_5_contexts = ranked_contexts[:5]
        query_coverage_scores = [
            self.calculate_context_relevance(ctx, query_terms)
            for ctx in top_5_contexts
        ]
        query_coverage = np.mean(query_coverage_scores) if query_coverage_scores else 0.0

        # Result diversity
        result_diversity = self.calculate_result_diversity(ranked_contexts)

        # Ranking quality (based on score distribution)
        ranking_quality = 0.0
        if len(ranking_scores) > 1:
            score_variance = np.var(ranking_scores)
            score_range = max(ranking_scores) - min(ranking_scores)
            # Good ranking has high variance and range
            ranking_quality = min(1.0, (score_variance + score_range) / 2)

        # Calculate composite precision (weighted average of precision@K)
        precision_weights = {1: 0.4, 3: 0.3, 5: 0.2, 10: 0.1}
        composite_precision = sum(
            precision_at_k.get(k, 0) * weight
            for k, weight in precision_weights.items()
        )

        # Precision confidence (based on result consistency)
        precision_values = list(precision_at_k.values())
        precision_confidence = 1.0 - np.var(precision_values) if precision_values else 0.0
        precision_confidence = max(0.0, min(1.0, precision_confidence))

        # Optimization potential (how much can be improved)
        optimization_potential = max(0.0, self.precision_target - composite_precision)

        return RetrievalMetrics(
            precision_at_k=precision_at_k,
            recall_at_k=recall_at_k,
            f1_at_k=f1_at_k,
            map_score=map_score,
            mrr_score=mrr_score,
            bm25_contribution=self.hybrid_weights['bm25'],
            tfidf_contribution=self.hybrid_weights['tfidf'],
            semantic_contribution=self.hybrid_weights['semantic'],
            hybrid_effectiveness=min(1.0, (map_score + mrr_score + composite_precision) / 3),
            context_relevance=context_relevance,
            query_coverage=query_coverage,
            result_diversity=result_diversity,
            ranking_quality=ranking_quality,
            composite_precision=composite_precision,
            precision_confidence=precision_confidence,
            optimization_potential=optimization_potential
        )

    def suggest_precision_improvements(self, metrics: RetrievalMetrics) -> Dict[str, Any]:
        """
        Generate suggestions for improving retrieval precision
        """
        suggestions = {
            'priority_improvements': [],
            'weight_adjustments': {},
            'algorithm_recommendations': [],
            'estimated_impact': {}
        }

        # Analyze performance and suggest improvements
        if metrics.composite_precision < 0.6:
            suggestions['priority_improvements'].append('overall_precision')
            suggestions['algorithm_recommendations'].append(
                "Implement query expansion and term reweighting"
            )

        if metrics.bm25_contribution > 0.5 and metrics.map_score < 0.5:
            suggestions['priority_improvements'].append('bm25_tuning')
            suggestions['weight_adjustments']['bm25'] = max(0.2, metrics.bm25_contribution - 0.1)
            suggestions['weight_adjustments']['semantic'] = min(0.5, metrics.semantic_contribution + 0.1)

        if metrics.result_diversity < 0.3:
            suggestions['priority_improvements'].append('diversity')
            suggestions['algorithm_recommendations'].append(
                "Implement diversity-aware ranking (MMR - Maximal Marginal Relevance)"
            )

        if metrics.query_coverage < 0.5:
            suggestions['priority_improvements'].append('query_coverage')
            suggestions['algorithm_recommendations'].append(
                "Enhance query understanding and intent detection"
            )

        return suggestions

    def save_precision_metrics(self, metrics: RetrievalMetrics, session_id: str = None) -> None:
        """
        Save precision metrics to database for monitoring
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Create table if not exists
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS context7_precision_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT,
                    precision_at_1 REAL,
                    precision_at_3 REAL,
                    precision_at_5 REAL,
                    precision_at_10 REAL,
                    map_score REAL,
                    mrr_score REAL,
                    bm25_contribution REAL,
                    tfidf_contribution REAL,
                    semantic_contribution REAL,
                    hybrid_effectiveness REAL,
                    context_relevance REAL,
                    query_coverage REAL,
                    result_diversity REAL,
                    ranking_quality REAL,
                    composite_precision REAL,
                    precision_confidence REAL,
                    optimization_potential REAL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                INSERT INTO context7_precision_metrics (
                    session_id, precision_at_1, precision_at_3, precision_at_5, precision_at_10,
                    map_score, mrr_score, bm25_contribution, tfidf_contribution, semantic_contribution,
                    hybrid_effectiveness, context_relevance, query_coverage, result_diversity,
                    ranking_quality, composite_precision, precision_confidence, optimization_potential
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                session_id or f"precision_session_{datetime.now().timestamp()}",
                metrics.precision_at_k.get(1, 0), metrics.precision_at_k.get(3, 0),
                metrics.precision_at_k.get(5, 0), metrics.precision_at_k.get(10, 0),
                metrics.map_score, metrics.mrr_score, metrics.bm25_contribution,
                metrics.tfidf_contribution, metrics.semantic_contribution,
                metrics.hybrid_effectiveness, metrics.context_relevance, metrics.query_coverage,
                metrics.result_diversity, metrics.ranking_quality, metrics.composite_precision,
                metrics.precision_confidence, metrics.optimization_potential
            ))

            conn.commit()
            conn.close()

            logger.info(f"Precision metrics saved: composite_precision={metrics.composite_precision:.3f}")

        except Exception as e:
            logger.error(f"Failed to save precision metrics: {e}")

def main():
    """Test the retrieval precision optimizer"""
    optimizer = RetrievalPrecisionOptimizer()

    # Test data simulation
    test_contexts = [
        {
            'id': '1',
            'content': 'Machine learning optimization techniques focus on hyperparameter tuning and gradient descent algorithms for neural network training.'
        },
        {
            'id': '2',
            'content': 'Deep learning models require careful optimization of learning rates, batch sizes, and network architectures for optimal performance.'
        },
        {
            'id': '3',
            'content': 'Natural language processing uses transformer architectures and attention mechanisms for text understanding and generation tasks.'
        },
        {
            'id': '4',
            'content': 'Computer vision applications employ convolutional neural networks and object detection algorithms for image analysis.'
        },
        {
            'id': '5',
            'content': 'Optimization algorithms like Adam, SGD, and RMSprop are essential for training machine learning models effectively.'
        }
    ]

    test_query = "machine learning optimization techniques neural network training"
    relevant_ids = {'1', '2', '5'}  # Ground truth relevant contexts

    # Calculate precision metrics
    metrics = optimizer.optimize_retrieval_precision(test_contexts, test_query, relevant_ids)

    # Get improvement suggestions
    suggestions = optimizer.suggest_precision_improvements(metrics)

    # Save to database
    optimizer.save_precision_metrics(metrics, "precision_optimizer_test")

    # Output results
    print("🎯 Retrieval Precision Optimization Results")
    print("=" * 60)
    print(f"Composite Precision: {metrics.composite_precision:.3f}")
    print(f"MAP Score: {metrics.map_score:.3f}")
    print(f"MRR Score: {metrics.mrr_score:.3f}")
    print(f"Precision Confidence: {metrics.precision_confidence:.3f}")
    print()
    print("Precision@K Metrics:")
    for k, precision in metrics.precision_at_k.items():
        recall = metrics.recall_at_k.get(k, 0)
        f1 = metrics.f1_at_k.get(k, 0)
        print(f"  P@{k}: {precision:.3f} | R@{k}: {recall:.3f} | F1@{k}: {f1:.3f}")
    print()
    print("Hybrid System Metrics:")
    print(f"  BM25 Weight: {metrics.bm25_contribution:.3f}")
    print(f"  TF-IDF Weight: {metrics.tfidf_contribution:.3f}")
    print(f"  Semantic Weight: {metrics.semantic_contribution:.3f}")
    print(f"  Hybrid Effectiveness: {metrics.hybrid_effectiveness:.3f}")
    print()
    print("Quality Metrics:")
    print(f"  Context Relevance: {metrics.context_relevance:.3f}")
    print(f"  Query Coverage: {metrics.query_coverage:.3f}")
    print(f"  Result Diversity: {metrics.result_diversity:.3f}")
    print(f"  Ranking Quality: {metrics.ranking_quality:.3f}")
    print()
    if suggestions['algorithm_recommendations']:
        print("Improvement Recommendations:")
        for i, rec in enumerate(suggestions['algorithm_recommendations'], 1):
            print(f"  {i}. {rec}")

if __name__ == "__main__":
    main()