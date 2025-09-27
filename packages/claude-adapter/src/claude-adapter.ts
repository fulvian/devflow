/**
 * ClaudeAdapter - Bridge between hook system and SemanticMemoryService
 * Provides memory search functionality for DevFlow context injection
 */

import { SemanticMemoryService, MockEmbeddingModel } from '../../../dist/core/semantic-memory/semantic-memory-service.js';
import { TaskHierarchyService } from '../../../dist/core/task-hierarchy/task-hierarchy-service.js';

export interface MemorySearchResult {
  block: {
    id: string;
    label: string;
    blockType: string;
    content: string;
    importanceScore: number;
  };
  similarity: number;
}

export interface SearchOptions {
  maxResults?: number;
  blockTypes?: string[];
  threshold?: number;
}

export class ClaudeAdapter {
  private semanticMemoryService: SemanticMemoryService | null = null;
  private taskHierarchyService: TaskHierarchyService | null = null;
  private isInitialized = false;
  private verbose = false;

  constructor(options: { verbose?: boolean } = {}) {
    this.verbose = options.verbose || false;
    if (this.verbose) {
      console.log('🧠 ClaudeAdapter created for hook system integration');
    }
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize task hierarchy service
      this.taskHierarchyService = new TaskHierarchyService('./data/devflow_unified.sqlite');
      await this.taskHierarchyService.initialize();

      // Initialize semantic memory service
      this.semanticMemoryService = new SemanticMemoryService(this.taskHierarchyService);
      await this.semanticMemoryService.initialize();

      // Register mock embedding model for testing
      const mockModel = new MockEmbeddingModel('hook-model', 'Hook Integration Model', 384);
      this.semanticMemoryService.registerEmbeddingModel(mockModel);

      this.isInitialized = true;
      if (this.verbose) {
        console.log('✅ ClaudeAdapter initialized successfully');
      }
    } catch (error) {
      if (this.verbose) {
        console.error('❌ ClaudeAdapter initialization failed:', error);
      }
      throw new Error(`ClaudeAdapter initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Search memory for relevant context blocks
   * This is the main method called by the hook system
   */
  async searchMemory(query: string, options: SearchOptions = {}): Promise<MemorySearchResult[]> {
    try {
      await this.initialize();

      if (!this.semanticMemoryService || !this.taskHierarchyService) {
        throw new Error('Services not initialized');
      }

      const {
        maxResults = 10,
        blockTypes = ['architectural', 'implementation'],
        threshold = 0.7
      } = options;

      if (this.verbose) {
        console.log(`🔍 Searching memory for: "${query}" (threshold: ${threshold}, maxResults: ${maxResults})`);
      }

      // Get all tasks that might contain relevant content
      const rootTasks = await this.taskHierarchyService.getRootTasks();
      const allTasks = [];

      // Collect all tasks
      for (const rootTask of rootTasks) {
        allTasks.push(rootTask);
        const children = await this.getAllDescendants(rootTask.id);
        allTasks.push(...children);
      }

      if (this.verbose) {
        console.log(`📊 Found ${allTasks.length} total tasks to search`);
      }

      // Filter tasks that contain relevant content
      const relevantTasks = allTasks.filter(task => {
        const content = `${task.title} ${task.description || ''}`.toLowerCase();
        const queryLower = query.toLowerCase();

        // Simple relevance scoring based on keyword matching
        const keywords = queryLower.split(' ').filter(w => w.length > 2);
        const matchCount = keywords.filter(keyword => content.includes(keyword)).length;

        return matchCount > 0 || content.includes(queryLower);
      });

      if (this.verbose) {
        console.log(`🎯 Found ${relevantTasks.length} potentially relevant tasks`);
      }

      // Convert tasks to memory search results format
      const results: MemorySearchResult[] = relevantTasks.slice(0, maxResults).map((task) => {
        // Calculate simple similarity score
        const content = `${task.title} ${task.description || ''}`.toLowerCase();
        const queryLower = query.toLowerCase();
        const keywords = queryLower.split(' ').filter(w => w.length > 2);
        const matchCount = keywords.filter(keyword => content.includes(keyword)).length;
        const similarity = Math.min(0.9, 0.3 + (matchCount / keywords.length) * 0.6);

        // Determine block type based on content
        let blockType = 'general';
        if (blockTypes.includes('architectural') && this.isArchitectural(content)) {
          blockType = 'architectural';
        } else if (blockTypes.includes('implementation') && this.isImplementation(content)) {
          blockType = 'implementation';
        }

        return {
          block: {
            id: task.id,
            label: task.title,
            blockType,
            content: `${task.title}\n\n${task.description || ''}\n\nStatus: ${task.status}\nPriority: ${task.priority}`,
            importanceScore: this.calculateImportance(task, similarity)
          },
          similarity
        };
      }).filter(result => result.similarity >= threshold);

      if (this.verbose) {
        console.log(`✅ Returning ${results.length} memory blocks above threshold`);
      }

      return results.sort((a, b) => b.similarity - a.similarity);

    } catch (error) {
      if (this.verbose) {
        console.error('❌ Memory search failed:', error);
      }
      return [];
    }
  }

  private async getAllDescendants(parentId: string): Promise<any[]> {
    if (!this.taskHierarchyService) return [];

    try {
      const children = await this.taskHierarchyService.getChildTasks(parentId);
      let descendants = [...children];

      for (const child of children) {
        const grandchildren = await this.getAllDescendants(child.id);
        descendants.push(...grandchildren);
      }

      return descendants;
    } catch (error) {
      return [];
    }
  }

  private isArchitectural(content: string): boolean {
    const architecturalKeywords = [
      'architecture', 'design', 'pattern', 'structure', 'component',
      'service', 'module', 'interface', 'api', 'orchestration',
      'system', 'framework', 'integration', 'microservice'
    ];
    return architecturalKeywords.some(keyword => content.includes(keyword));
  }

  private isImplementation(content: string): boolean {
    const implementationKeywords = [
      'implementation', 'code', 'function', 'method', 'class',
      'feature', 'bug', 'fix', 'develop', 'build', 'test',
      'algorithm', 'logic', 'procedure', 'execution'
    ];
    return implementationKeywords.some(keyword => content.includes(keyword));
  }

  private calculateImportance(task: any, similarity: number): number {
    let importance = similarity;

    // Boost importance based on task characteristics
    if (task.priority === 'high') importance += 0.1;
    if (task.status === 'in_progress') importance += 0.05;
    if (task.title && task.title.length > 20) importance += 0.05; // Detailed tasks

    return Math.min(1.0, importance);
  }

  async close(): Promise<void> {
    if (this.semanticMemoryService) {
      await this.semanticMemoryService.close();
    }
    this.isInitialized = false;

    if (this.verbose) {
      console.log('🔒 ClaudeAdapter closed');
    }
  }
}