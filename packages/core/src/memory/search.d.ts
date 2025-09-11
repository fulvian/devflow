import type Database from 'better-sqlite3';
import type { MemoryBlock, SemanticSearchOptions, SemanticSearchResult } from '@devflow/shared';
export declare class SearchService {
    private db;
    constructor(db: Database.Database);
    fullText(query: string, limit?: number): MemoryBlock[];
    semantic(query: string, options?: SemanticSearchOptions): SemanticSearchResult[];
}
//# sourceMappingURL=search.d.ts.map