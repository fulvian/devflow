import { VectorDatabase, VectorDocument, QueryResult } from './vector-database';
import { EmbeddingPipeline } from './embedding-pipeline';

export interface SearchQuery {
  text: string;
  filters?: {
    language?: string;
    filePath?: string;
    dateRange?: {
      start: Date;
      end: Date;
    };
  };
  options?: {
    maxResults?: number;
    threshold?: number;
    includeMetadata?: boolean;
    hybridWeight?: {
      vector: number;
      keyword: number;
    };
  };
}

export interface SearchResult {
  document: VectorDocument;
  score: number;
  similarity?: number;
  keywordMatches: number;
  snippet: string;
}

export interface RankedResults {
  results: SearchResult[];
  totalFound: number;
  queryTime: number;
  searchStrategy: 'vector' | 'keyword' | 'hybrid';
}

/**
 * Semantic search with cosine similarity and hybrid ranking
 */
export class SemanticSearch {
  private vectorDb: VectorDatabase;
  private embeddingPipeline: EmbeddingPipeline;
  private keywordIndex: Map<string, Set<string>> = new Map(); // word -> document IDs

  constructor(vectorDb: VectorDatabase, embeddingPipeline: EmbeddingPipeline) {
    this.vectorDb = vectorDb;
    this.embeddingPipeline = embeddingPipeline;
    this.buildKeywordIndex();
  }

  /**
   * Perform semantic search with hybrid ranking
   */
  async search(query: SearchQuery): Promise<RankedResults> {
    const startTime = Date.now();
    
    const options = {
      maxResults: 10,
      threshold: 0.7,
      includeMetadata: true,
      hybridWeight: { vector: 0.7, keyword: 0.3 },
      ...query.options
    };

    try {
      // Perform vector similarity search
      const vectorResults = await this.performVectorSearch(query, options);
      
      // Perform keyword search
      const keywordResults = await this.performKeywordSearch(query, options);
      
      // Combine and rank results
      const combinedResults = this.combineResults(vectorResults, keywordResults, options);
      
      // Apply relevance ranking
      const rankedResults = this.rankResults(combinedResults, query);
      
      // Filter by threshold and limit
      const filteredResults = rankedResults
        .filter(result => result.score >= options.threshold)
        .slice(0, options.maxResults);

      return {
        results: filteredResults,
        totalFound: rankedResults.length,
        queryTime: Date.now() - startTime,
        searchStrategy: 'hybrid'
      };
      
    } catch (error) {
      console.error('Semantic search failed:', error);
      return {
        results: [],
        totalFound: 0,
        queryTime: Date.now() - startTime,
        searchStrategy: 'hybrid'
      };
    }
  }

  /**
   * Perform pure vector similarity search
   */
  async vectorSearch(queryText: string, maxResults: number = 10): Promise<SearchResult[]> {
    try {
      const queryResult = await this.vectorDb.queryDocuments(queryText, {
        nResults: maxResults
      });
      
      return queryResult.documents.map((doc, index) => ({
        document: doc,
        score: queryResult.similarities?.[index] || 0,
        similarity: queryResult.similarities?.[index],
        keywordMatches: 0,
        snippet: this.generateSnippet(doc.content, queryText)
      }));
    } catch (error) {
      console.error('Vector search failed:', error);
      return [];
    }
  }

  /**
   * Perform pure keyword search
   */
  async keywordSearch(queryText: string, maxResults: number = 10): Promise<SearchResult[]> {
    const keywords = this.extractKeywords(queryText);
    const candidateIds = new Set<string>();
    
    // Find documents containing keywords
    for (const keyword of keywords) {
      const docIds = this.keywordIndex.get(keyword.toLowerCase());
      if (docIds) {
        docIds.forEach(id => candidateIds.add(id));
      }
    }
    
    const results: SearchResult[] = [];
    
    for (const docId of Array.from(candidateIds).slice(0, maxResults)) {
      try {
        const doc = await this.vectorDb.getDocument(docId);
        if (doc) {
          const keywordMatches = this.countKeywordMatches(doc.content, keywords);
          const score = keywordMatches / keywords.length;
          
          results.push({
            document: doc,
            score,
            keywordMatches,
            snippet: this.generateSnippet(doc.content, queryText)
          });
        }
      } catch (error) {
        console.warn(`Failed to retrieve document ${docId}:`, error);
      }
    }
    
    return results.sort((a, b) => b.score - a.score);
  }

  private async performVectorSearch(query: SearchQuery, options: any): Promise<SearchResult[]> {
    return await this.vectorSearch(query.text, options.maxResults * 2);
  }

  private async performKeywordSearch(query: SearchQuery, options: any): Promise<SearchResult[]> {
    return await this.keywordSearch(query.text, options.maxResults * 2);
  }

  private combineResults(
    vectorResults: SearchResult[],
    keywordResults: SearchResult[],
    options: { hybridWeight: { vector: number; keyword: number } }
  ): SearchResult[] {
    const combined = new Map<string, SearchResult>();
    
    // Add vector results
    for (const result of vectorResults) {
      const adjustedScore = result.score * options.hybridWeight.vector;
      combined.set(result.document.id, {
        ...result,
        score: adjustedScore
      });
    }
    
    // Add/merge keyword results
    for (const result of keywordResults) {
      const existing = combined.get(result.document.id);
      const keywordScore = result.score * options.hybridWeight.keyword;
      
      if (existing) {
        // Combine scores
        existing.score += keywordScore;
        existing.keywordMatches = Math.max(existing.keywordMatches, result.keywordMatches);
      } else {
        combined.set(result.document.id, {
          ...result,
          score: keywordScore
        });
      }
    }
    
    return Array.from(combined.values());
  }

  private rankResults(results: SearchResult[], query: SearchQuery): SearchResult[] {
    // Apply additional ranking factors
    return results
      .map(result => {
        let score = result.score;
        
        // Boost score for exact phrase matches
        if (result.document.content.toLowerCase().includes(query.text.toLowerCase())) {
          score *= 1.2;
        }
        
        // Boost score for recent documents
        const docAge = Date.now() - (result.document.metadata.lastModified || 0);
        const ageInDays = docAge / (1000 * 60 * 60 * 24);
        if (ageInDays < 7) {
          score *= 1.1;
        }
        
        return { ...result, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  private generateSnippet(content: string, queryText: string, maxLength: number = 200): string {
    const query = queryText.toLowerCase();
    const contentLower = content.toLowerCase();
    const index = contentLower.indexOf(query);
    
    if (index === -1) {
      return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
    }
    
    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + query.length + 150);
    
    let snippet = content.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet += '...';
    
    return snippet;
  }

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.isStopWord(word));
  }

  private countKeywordMatches(content: string, keywords: string[]): number {
    const contentLower = content.toLowerCase();
    return keywords.reduce((count, keyword) => {
      const matches = (contentLower.match(new RegExp(keyword, 'g')) || []).length;
      return count + matches;
    }, 0);
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'
    ]);
    return stopWords.has(word);
  }

  private async buildKeywordIndex(): Promise<void> {
    try {
      // In a real implementation, this would index all documents
      // For now, we'll build it incrementally as documents are added
      console.log('Keyword index initialized (will build incrementally)');
    } catch (error) {
      console.error('Failed to build keyword index:', error);
    }
  }

  /**
   * Add document to keyword index
   */
  indexDocument(document: VectorDocument): void {
    const keywords = this.extractKeywords(document.content);
    
    for (const keyword of keywords) {
      if (!this.keywordIndex.has(keyword)) {
        this.keywordIndex.set(keyword, new Set());
      }
      this.keywordIndex.get(keyword)!.add(document.id);
    }
  }

  /**
   * Remove document from keyword index
   */
  removeFromIndex(documentId: string): void {
    for (const [keyword, docIds] of this.keywordIndex.entries()) {
      docIds.delete(documentId);
      if (docIds.size === 0) {
        this.keywordIndex.delete(keyword);
      }
    }
  }

  /**
   * Get search statistics
   */
  getStats(): {
    keywordIndexSize: number;
    totalDocuments: number;
  } {
    const totalDocs = new Set<string>();
    for (const docIds of this.keywordIndex.values()) {
      docIds.forEach(id => totalDocs.add(id));
    }
    
    return {
      keywordIndexSize: this.keywordIndex.size,
      totalDocuments: totalDocs.size
    };
  }
}