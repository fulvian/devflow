// Mock ChromaDB implementation for build compatibility
export interface VectorDatabaseConfig {
  persistDirectory: string;
  collectionName: string;
}

export interface VectorDocument {
  id: string;
  content: string;
  embedding?: number[];
  metadata: Record<string, any>;
}

export interface QueryResult {
  documents: VectorDocument[];
  distances?: number[];
  similarities?: number[];
}

// Mock ChromaDB types
export interface Collection {
  add(params: { ids: string[]; documents: string[]; metadatas?: any[]; embeddings?: number[][]; }): Promise<void>;
  query(params: { queryTexts?: string[]; queryEmbeddings?: number[][]; nResults?: number; }): Promise<any>;
  peek(limit?: number): Promise<any>;
  delete(params: { ids: string[]; }): Promise<void>;
}

export class VectorDatabase {
  private config: VectorDatabaseConfig;
  private collection: Collection | null = null;
  private documents: Map<string, VectorDocument> = new Map();

  constructor(config: VectorDatabaseConfig) {
    this.config = config;
    this.initializeCollection();
  }

  private async initializeCollection(): Promise<void> {
    try {
      // Mock ChromaDB collection
      this.collection = {
        async add(params) {
          console.log('Mock ChromaDB: Adding documents', params.ids.length);
        },
        async query(params) {
          console.log('Mock ChromaDB: Querying', params.nResults || 10);
          return { documents: [[]], distances: [[]], metadatas: [[]] };
        },
        async peek(limit = 10) {
          console.log('Mock ChromaDB: Peeking', limit);
          return { documents: [], ids: [], metadatas: [] };
        },
        async delete(params) {
          console.log('Mock ChromaDB: Deleting', params.ids.length);
        }
      };
    } catch (error) {
      console.warn('ChromaDB not available, using mock implementation');
    }
  }

  async addDocuments(documents: VectorDocument[]): Promise<void> {
    if (!this.collection) {
      throw new Error('Database not initialized');
    }

    const ids = documents.map(doc => doc.id);
    const contents = documents.map(doc => doc.content);
    const metadatas = documents.map(doc => doc.metadata);
    const embeddings = documents.map(doc => doc.embedding).filter(Boolean) as number[][];

    // Store in memory for mock implementation
    documents.forEach(doc => {
      this.documents.set(doc.id, doc);
    });

    await this.collection.add({
      ids,
      documents: contents,
      metadatas,
      embeddings: embeddings.length === documents.length ? embeddings : undefined
    });
  }

  async queryDocuments(
    queryText: string,
    options: {
      nResults?: number;
      filter?: Record<string, any>;
    } = {}
  ): Promise<QueryResult> {
    if (!this.collection) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.collection.query({
        queryTexts: [queryText],
        nResults: options.nResults || 10
      });

      // Mock response processing
      return {
        documents: Array.from(this.documents.values()).slice(0, options.nResults || 10),
        distances: result.distances?.[0] || [],
        similarities: result.distances?.[0]?.map((d: number) => 1 - d) || []
      };
    } catch (error) {
      console.error('Query failed:', error);
      return { documents: [] };
    }
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    if (!this.collection) {
      throw new Error('Database not initialized');
    }

    // Remove from memory
    ids.forEach(id => {
      this.documents.delete(id);
    });

    await this.collection.delete({ ids });
  }

  async getDocument(id: string): Promise<VectorDocument | undefined> {
    return this.documents.get(id);
  }

  async close(): Promise<void> {
    this.collection = null;
    this.documents.clear();
  }

  getStats(): { totalDocuments: number; collectionName: string; } {
    return {
      totalDocuments: this.documents.size,
      collectionName: this.config.collectionName
    };
  }
}