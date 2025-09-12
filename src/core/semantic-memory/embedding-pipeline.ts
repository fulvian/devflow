import { createHash } from 'crypto';
import { VectorDatabase, VectorDocument } from './vector-database';

export interface CodeChunk {
  id: string;
  content: string;
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
  metadata: Record<string, any>;
}

export interface FileMetadata {
  filePath: string;
  lastModified: Date;
  fileSize: number;
  language: string;
  gitHash?: string;
}

export interface EmbeddingModel {
  generateEmbedding(text: string): Promise<number[]>;
  getDimensions(): number;
}

export class EmbeddingPipeline {
  private vectorDb: VectorDatabase;
  private embeddingModel: EmbeddingModel;

  constructor(vectorDb: VectorDatabase, embeddingModel: EmbeddingModel) {
    this.vectorDb = vectorDb;
    this.embeddingModel = embeddingModel;
  }

  async processFile(content: string, metadata: FileMetadata): Promise<CodeChunk[]> {
    // Preprocess content
    const cleanedContent = this.preprocessContent(content);
    
    // Generate chunks
    const chunks = this.chunkCode(cleanedContent, metadata);
    
    // Generate embeddings
    const embeddedChunks = await this.generateEmbeddings(chunks);
    
    return embeddedChunks;
  }

  private preprocessContent(content: string): string {
    // Remove extra whitespace and normalize
    return content.replace(/\r\n/g, '\n').trim();
  }

  private chunkCode(content: string, metadata: FileMetadata): CodeChunk[] {
    const lines = content.split('\n');
    const chunks: CodeChunk[] = [];
    const chunkSize = 50; // lines per chunk
    const overlap = 5; // overlapping lines

    for (let i = 0; i < lines.length; i += chunkSize - overlap) {
      const chunkLines = lines.slice(i, Math.min(i + chunkSize, lines.length));
      const chunkContent = chunkLines.join('\n');
      
      if (chunkContent.trim().length === 0) continue;

      const chunkId = this.generateChunkId(metadata.filePath, i, i + chunkLines.length);
      
      chunks.push({
        id: chunkId,
        content: chunkContent,
        filePath: metadata.filePath,
        startLine: i + 1,
        endLine: Math.min(i + chunkLines.length, lines.length),
        language: metadata.language,
        metadata: {
          ...metadata,
          chunkIndex: chunks.length
        }
      });

      if (i + chunkSize >= lines.length) break;
    }

    return chunks;
  }

  private async generateEmbeddings(chunks: CodeChunk[]): Promise<CodeChunk[]> {
    const embeddedChunks: CodeChunk[] = [];
    
    for (const chunk of chunks) {
      try {
        const embedding = await this.embeddingModel.generateEmbedding(chunk.content);
        chunk.metadata.embedding = embedding;
        embeddedChunks.push(chunk);
      } catch (error) {
        console.warn(`Failed to generate embedding for chunk ${chunk.id}:`, error);
      }
    }
    
    return embeddedChunks;
  }

  private generateChunkId(filePath: string, startLine: number, endLine: number): string {
    const hash = createHash('md5');
    hash.update(`${filePath}:${startLine}:${endLine}`);
    return hash.digest('hex');
  }

  async processGitChanges(changedFiles: { path: string; content: string }[]): Promise<void> {
    for (const file of changedFiles) {
      try {
        // Extract metadata
        const metadata: FileMetadata = {
          filePath: file.path,
          lastModified: new Date(),
          fileSize: file.content.length,
          language: this.detectLanguage(file.path),
          gitHash: this.generateGitHash(file.content)
        };

        // Process file into chunks
        const chunks = await this.processFile(file.content, metadata);
        
        // Convert to vector documents
        const vectorDocuments: VectorDocument[] = chunks.map(chunk => ({
          id: chunk.id,
          content: chunk.content,
          embedding: chunk.metadata.embedding,
          metadata: chunk.metadata
        }));

        // Update in vector database
        await this.updateVectorDatabase(vectorDocuments, file.path);
      } catch (error) {
        console.error(`Failed to process file ${file.path}:`, error);
      }
    }
  }

  private async updateVectorDatabase(documents: VectorDocument[], filePath: string): Promise<void> {
    // Remove existing chunks for this file
    // In a real implementation, you'd query by filePath metadata
    // and delete those documents first
    
    // Add new documents
    if (documents.length > 0) {
      await this.vectorDb.addDocuments(documents);
    }
  }

  private detectLanguage(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase() || 'unknown';
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'js': 'javascript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'cs': 'csharp'
    };
    
    return languageMap[extension] || 'unknown';
  }

  private generateGitHash(content: string): string {
    const hash = createHash('sha1');
    hash.update(`blob ${content.length}\0${content}`);
    return hash.digest('hex');
  }
}
