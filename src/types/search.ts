export interface SearchDocument {
  id: string;
  keywordScore: number;
  semanticScore: number;
  combinedScore: number;
}

export interface SearchResult {
  document: SearchDocument;
  content: string;
  metadata: Record<string, any>;
}