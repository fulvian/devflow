// Embedding e SQLite disabilitati in produzione: usare cc-sessions per lo storage

export class SemanticSearchService {
  constructor() {}

  async search(_query: string, _threshold: number = 0.7) {
    // Delegare a cc-sessions o restituire lista vuota
    return [] as any[];
  }

  async storeDocument(_content: string, _metadata?: any) {
    // Delegare a cc-sessions, no-op qui
    return null;
  }
}