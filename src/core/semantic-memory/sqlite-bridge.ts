import * as fs from 'fs';
import * as path from 'path';

// Mock SQLite interface to avoid native dependency issues
export interface SQLiteRow {
  [key: string]: any;
}

export interface MetadataRecord {
  id: string;
  vectorId: string;
  filePath: string;
  content: string;
  language: string;
  lastModified: number;
  embedding?: string; // JSON serialized embedding
}

export interface CrossReferenceQuery {
  vectorIds: string[];
  metadata?: Partial<MetadataRecord>;
  limit?: number;
}

export interface SyncResult {
  synchronized: number;
  conflicts: number;
  errors: string[];
}

/**
 * SQLite Bridge for metadata synchronization
 * Uses file-based storage as fallback when SQLite is not available
 */
export class SQLiteBridge {
  private dbPath: string;
  private connected: boolean = false;
  private metadata: Map<string, MetadataRecord> = new Map();
  private fallbackFile: string;

  constructor(dbPath: string = './data/devflow_unified.sqlite') {
    this.dbPath = dbPath;
    this.fallbackFile = path.join(path.dirname(dbPath), 'metadata-fallback.json');
    this.initializeStorage();
  }

  private initializeStorage(): void {
    try {
      // Try to load from fallback file
      if (fs.existsSync(this.fallbackFile)) {
        const data = JSON.parse(fs.readFileSync(this.fallbackFile, 'utf8'));
        data.forEach((record: MetadataRecord) => {
          this.metadata.set(record.id, record);
        });
      }
      this.connected = true;
      console.log('📄 Using file-based metadata storage (SQLite fallback)');
    } catch (error) {
      console.error('Failed to initialize metadata storage:', error);
    }
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    
    try {
      this.initializeStorage();
      this.connected = true;
    } catch (error) {
      throw new Error(`Failed to connect to metadata storage: ${error}`);
    }
  }

  async close(): Promise<void> {
    if (this.connected) {
      await this.syncToFile();
      this.connected = false;
      this.metadata.clear();
    }
  }

  async insertMetadata(record: MetadataRecord): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to storage');
    }

    this.metadata.set(record.id, record);
    await this.syncToFile();
  }

  async updateMetadata(id: string, updates: Partial<MetadataRecord>): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to storage');
    }

    const existing = this.metadata.get(id);
    if (existing) {
      this.metadata.set(id, { ...existing, ...updates });
      await this.syncToFile();
    }
  }

  async getMetadata(id: string): Promise<MetadataRecord | null> {
    if (!this.connected) {
      throw new Error('Not connected to storage');
    }

    return this.metadata.get(id) || null;
  }

  async findMetadataByVectorIds(vectorIds: string[]): Promise<MetadataRecord[]> {
    if (!this.connected) {
      throw new Error('Not connected to storage');
    }

    const results: MetadataRecord[] = [];
    for (const record of this.metadata.values()) {
      if (vectorIds.includes(record.vectorId)) {
        results.push(record);
      }
    }
    return results;
  }

  async crossReferenceQuery(query: CrossReferenceQuery): Promise<MetadataRecord[]> {
    if (!this.connected) {
      throw new Error('Not connected to storage');
    }

    let results = Array.from(this.metadata.values());

    // Filter by vector IDs if provided
    if (query.vectorIds.length > 0) {
      results = results.filter(record => 
        query.vectorIds.includes(record.vectorId)
      );
    }

    // Filter by metadata if provided
    if (query.metadata) {
      results = results.filter(record => {
        return Object.entries(query.metadata!).every(([key, value]) => {
          return record[key as keyof MetadataRecord] === value;
        });
      });
    }

    // Apply limit if provided
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  async syncVectorDatabase(vectorDbRecords: { id: string; metadata: any }[]): Promise<SyncResult> {
    if (!this.connected) {
      throw new Error('Not connected to storage');
    }

    const result: SyncResult = {
      synchronized: 0,
      conflicts: 0,
      errors: []
    };

    for (const vRecord of vectorDbRecords) {
      try {
        const existing = this.metadata.get(vRecord.id);
        if (!existing) {
          // Create new metadata record
          const newRecord: MetadataRecord = {
            id: vRecord.id,
            vectorId: vRecord.id,
            filePath: vRecord.metadata.filePath || '',
            content: vRecord.metadata.content || '',
            language: vRecord.metadata.language || 'unknown',
            lastModified: Date.now()
          };
          this.metadata.set(vRecord.id, newRecord);
          result.synchronized++;
        } else {
          // Check for conflicts
          if (existing.lastModified < (vRecord.metadata.lastModified || 0)) {
            result.conflicts++;
          }
        }
      } catch (error) {
        result.errors.push(`Error syncing ${vRecord.id}: ${error}`);
      }
    }

    await this.syncToFile();
    return result;
  }

  async validateConsistency(): Promise<{
    consistent: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    // Basic validation
    for (const [id, record] of this.metadata.entries()) {
      if (id !== record.id) {
        issues.push(`ID mismatch for record ${id}`);
      }
      if (!record.vectorId) {
        issues.push(`Missing vectorId for record ${id}`);
      }
    }

    return {
      consistent: issues.length === 0,
      issues
    };
  }

  private async syncToFile(): Promise<void> {
    try {
      const data = Array.from(this.metadata.values());
      const dir = path.dirname(this.fallbackFile);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.fallbackFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to sync metadata to file:', error);
    }
  }

  getStats(): {
    totalRecords: number;
    connected: boolean;
    storageType: string;
  } {
    return {
      totalRecords: this.metadata.size,
      connected: this.connected,
      storageType: 'file-based'
    };
  }
}