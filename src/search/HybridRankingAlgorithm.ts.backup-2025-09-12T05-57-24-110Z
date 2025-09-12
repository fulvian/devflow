import { Database } from 'sqlite3';
import { cosineSimilarity } from '../utils/vectorUtils';
import { SearchDocument } from '../types/search';

interface HybridSearchConfig {
  keywordWeight: number;
  semanticWeight: number;
  similarityThreshold: number;
  normalizationMethod: 'minmax' | 'zscore' | 'none';
}

class HybridRankingAlgorithm {
  private db: Database;
  private config: HybridSearchConfig;

  constructor(db: Database, config: Partial<HybridSearchConfig> = {}) {
    this.db = db;
    this.config = {
      keywordWeight: config.keywordWeight ?? 0.3,
      semanticWeight: config.semanticWeight ?? 0.7,
      similarityThreshold: config.similarityThreshold ?? 0.5,
      normalizationMethod: config.normalizationMethod ?? 'minmax'
    };
  }

  /**
   * Executes hybrid search combining FTS5 BM25 and vector similarity
   * @param queryText The search query text
   * @param queryVector The query embedding vector
   * @param limit Maximum number of results
   * @returns Ranked search results
   */
  async search(queryText: string, queryVector: number[], limit: number = 20): Promise<SearchDocument[]> {
    // Get BM25 scores from FTS5
    const keywordResults = await this.getKeywordScores(queryText, limit * 2);
    
    // Get vector similarity scores
    const semanticResults = await this.getSemanticScores(queryVector, limit * 2);
    
    // Combine and rank results
    const combinedResults = this.combineScores(keywordResults, semanticResults);
    
    // Apply threshold filtering
    const filteredResults = combinedResults.filter(r => r.combinedScore >= this.config.similarityThreshold);
    
    // Sort by combined score
    return filteredResults
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, limit);
  }

  /**
   * Fetches BM25 scores using FTS5
   */
  private async getKeywordScores(query: string, limit: number): Promise<Array<{id: string, bm25Score: number}>> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT id, bm25(search_index) as score
        FROM search_index
        WHERE search_index MATCH ?
        ORDER BY score
        LIMIT ?
      `;
      
      this.db.all(sql, [query, limit], (err, rows: any[]) => {
        if (err) reject(err);
        resolve(rows.map(row => ({
          id: row.id,
          bm25Score: row.score
        })));
      });
    });
  }

  /**
   * Fetches vector similarity scores
   */
  private async getSemanticScores(queryVector: number[], limit: number): Promise<Array<{id: string, similarity: number}>> {
    return new Promise((resolve, reject) => {
      // For performance, we limit semantic search to top candidates
      const sql = `
        SELECT id, vector_data
        FROM document_vectors
        ORDER BY id
        LIMIT ?
      `;
      
      this.db.all(sql, [limit], async (err, rows: any[]) => {
        if (err) reject(err);
        
        const similarities = rows.map(row => ({
          id: row.id,
          similarity: cosineSimilarity(queryVector, JSON.parse(row.vector_data))
        }));
        
        resolve(similarities);
      });
    });
  }

  /**
   * Combines keyword and semantic scores with configurable weighting
   */
  private combineScores(
    keywordScores: Array<{id: string, bm25Score: number}>,
    semanticScores: Array<{id: string, similarity: number}>
  ): SearchDocument[] {
    // Normalize scores
    const normalizedKeywords = this.normalizeScores(
      keywordScores.map(s => ({id: s.id, score: -s.bm25Score})) // Invert BM25 (lower is better)
    );
    
    const normalizedSemantics = this.normalizeScores(
      semanticScores.map(s => ({id: s.id, score: s.similarity}))
    );
    
    // Create maps for efficient lookup
    const keywordMap = new Map(normalizedKeywords.map(s => [s.id, s.score]));
    const semanticMap = new Map(normalizedSemantics.map(s => [s.id, s.score]));
    
    // Combine scores
    const allIds = new Set([...keywordMap.keys(), ...semanticMap.keys()]);
    const combined: SearchDocument[] = [];
    
    for (const id of allIds) {
      const keywordScore = keywordMap.get(id) || 0;
      const semanticScore = semanticMap.get(id) || 0;
      
      const combinedScore = (
        this.config.keywordWeight * keywordScore +
        this.config.semanticWeight * semanticScore
      );
      
      combined.push({
        id,
        keywordScore,
        semanticScore,
        combinedScore
      });
    }
    
    return combined;
  }

  /**
   * Normalizes scores using configured method
   */
  private normalizeScores(scores: Array<{id: string, score: number}>): Array<{id: string, score: number}> {
    if (this.config.normalizationMethod === 'none') return scores;
    
    if (this.config.normalizationMethod === 'minmax') {
      const min = Math.min(...scores.map(s => s.score));
      const max = Math.max(...scores.map(s => s.score));
      const range = max - min || 1; // Avoid division by zero
      
      return scores.map(s => ({
        id: s.id,
        score: (s.score - min) / range
      }));
    }
    
    // Z-score normalization
    const mean = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
    const std = Math.sqrt(
      scores.reduce((sum, s) => sum + Math.pow(s.score - mean, 2), 0) / scores.length
    ) || 1; // Avoid division by zero
    
    return scores.map(s => ({
      id: s.id,
      score: (s.score - mean) / std
    }));
  }

  /**
   * Updates configuration parameters
   */
  updateConfig(newConfig: Partial<HybridSearchConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Performs validation of ranking quality
   */
  async validateRanking(testQueries: Array<{text: string, vector: number[], relevantIds: string[]}>): Promise<{ndcg: number, precision: number}> {
    let totalNDCG = 0;
    let totalPrecision = 0;
    
    for (const query of testQueries) {
      const results = await this.search(query.text, query.vector, 10);
      const resultIds = results.map(r => r.id);
      
      // Calculate NDCG@10
      const dcg = resultIds.reduce((sum, id, idx) => 
        sum + (query.relevantIds.includes(id) ? 1 / Math.log2(idx + 2) : 0), 0
      );
      
      const idealResultIds = [...query.relevantIds];
      const idcg = idealResultIds.slice(0, 10).reduce((sum, _, idx) => 
        sum + 1 / Math.log2(idx + 2), 0
      ) || 1;
      
      totalNDCG += dcg / idcg;
      
      // Calculate Precision@10
      const relevantRetrieved = resultIds.filter(id => query.relevantIds.includes(id)).length;
      totalPrecision += relevantRetrieved / Math.min(10, resultIds.length);
    }
    
    return {
      ndcg: totalNDCG / testQueries.length,
      precision: totalPrecision / testQueries.length
    };
  }
}

export { HybridRankingAlgorithm, HybridSearchConfig };