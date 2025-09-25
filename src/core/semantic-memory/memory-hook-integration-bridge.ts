/**
 * Memory-Hook Integration Bridge
 * Connects EnhancedProjectMemorySystem with DevFlow hook ecosystem
 * Handles automatic memory storage/retrieval on tool interactions
 */

import { EnhancedProjectMemorySystem } from './enhanced-memory-system';
import { ContextInjectionIntelligenceEngine, ConversationContext } from './context-injection-intelligence-engine';
import { MemoryContent } from './semantic-memory-engine';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface HookContext {
  toolName: string;
  toolParams: any;
  sessionId: string;
  timestamp: Date;
  projectContext?: {
    id: number;
    name: string;
    branch: string;
  };
}

export interface MemoryStorageOptions {
  autoStore: boolean;
  contentTypes: string[];
  minContentLength: number;
  significantTools: string[];
}

export interface ContextInjectionOptions {
  enabled: boolean;
  maxTokens: number;
  similarityThreshold: number;
  includeInPrompt: boolean;
}

export class MemoryHookIntegrationBridge {
  private memorySystem: EnhancedProjectMemorySystem;
  private contextEngine: ContextInjectionIntelligenceEngine;
  private defaultStorageOptions: MemoryStorageOptions;
  private defaultInjectionOptions: ContextInjectionOptions;

  constructor() {
    this.memorySystem = new EnhancedProjectMemorySystem();
    this.contextEngine = new ContextInjectionIntelligenceEngine();

    this.defaultStorageOptions = {
      autoStore: true,
      contentTypes: ['conversation', 'file', 'task', 'decision'],
      minContentLength: 50,
      significantTools: ['Write', 'Edit', 'MultiEdit', 'Task', 'Bash', 'Read']
    };

    this.defaultInjectionOptions = {
      enabled: true,
      maxTokens: 2000,
      similarityThreshold: 0.7,
      includeInPrompt: true
    };
  }

  /**
   * Initialize the bridge system
   */
  async initialize(): Promise<boolean> {
    try {
      const memoryInit = await this.memorySystem.initialize();
      const contextInit = await this.contextEngine.initialize();

      if (!memoryInit.success || !contextInit) {
        console.error('Failed to initialize Memory-Hook Integration Bridge');
        return false;
      }

      console.log('Memory-Hook Integration Bridge initialized successfully');
      return true;
    } catch (error) {
      console.error('Bridge initialization failed:', error);
      return false;
    }
  }

  /**
   * Handle PostToolUse hook - store significant interactions in memory
   */
  async handlePostToolUse(
    hookContext: HookContext,
    toolResult?: any,
    options?: Partial<MemoryStorageOptions>
  ): Promise<boolean> {
    try {
      const mergedOptions = { ...this.defaultStorageOptions, ...options };

      if (!mergedOptions.autoStore) return true;

      // Check if tool is significant enough for memory storage
      if (!mergedOptions.significantTools.includes(hookContext.toolName)) {
        return true;
      }

      const projectId = await this.extractProjectId(hookContext);
      if (!projectId) return true;

      // Generate memory content from tool interaction
      const memoryContent = await this.generateMemoryContent(
        hookContext,
        toolResult,
        mergedOptions
      );

      if (!memoryContent || memoryContent.content.length < mergedOptions.minContentLength) {
        return true;
      }

      // Store in semantic memory system
      const result = await this.memorySystem.storeMemory(memoryContent);

      if (result.success) {
        console.log(`Memory stored for ${hookContext.toolName} interaction: ${result.data}`);
        return true;
      } else {
        console.warn(`Memory storage failed: ${result.error}`);
        return false;
      }

    } catch (error) {
      console.error('PostToolUse memory storage failed:', error);
      return false;
    }
  }

  /**
   * Handle UserPromptSubmit hook - inject intelligent context
   */
  async handleUserPromptSubmit(
    userPrompt: string,
    sessionId: string,
    options?: Partial<ContextInjectionOptions>
  ): Promise<string> {
    try {
      const mergedOptions = { ...this.defaultInjectionOptions, ...options };

      if (!mergedOptions.enabled) return userPrompt;

      const projectId = await this.getCurrentProjectId();
      if (!projectId) return userPrompt;

      // Create conversation context
      const conversationContext: ConversationContext = {
        currentPrompt: userPrompt,
        projectId,
        sessionId,
        timestamp: new Date()
      };

      // Get intelligent context injection
      const injection = await this.contextEngine.injectIntelligentContext(
        conversationContext,
        {
          maxTokens: mergedOptions.maxTokens,
          similarityThreshold: mergedOptions.similarityThreshold
        }
      );

      if (!injection.success || !injection.injectedContext) {
        return userPrompt;
      }

      // Log injection metrics
      console.log(`Context injection: ${injection.relevantMemories.length} memories, ` +
                  `${injection.tokenCount} tokens, ${injection.processingTime.toFixed(2)}ms`);

      // Assemble enhanced prompt with context
      if (mergedOptions.includeInPrompt) {
        return this.assembleEnhancedPrompt(userPrompt, injection.injectedContext);
      }

      return userPrompt;

    } catch (error) {
      console.error('UserPromptSubmit context injection failed:', error);
      return userPrompt;
    }
  }

  /**
   * Handle SessionStart hook - restore session context
   */
  async handleSessionStart(sessionId: string): Promise<string | null> {
    try {
      const projectId = await this.getCurrentProjectId();
      if (!projectId) return null;

      // Search for recent session context
      const searchResult = await this.memorySystem.searchMemories({
        query: `session context restoration project ${projectId}`,
        projectId,
        contentTypes: ['conversation', 'context'],
        similarityThreshold: 0.6,
        limit: 3
      });

      if (!searchResult.success || !searchResult.data?.length) {
        return null;
      }

      // Assemble session restoration context
      const contextSections = [
        '# Session Context Restoration',
        '',
        '*Restored from previous session memory*',
        ''
      ];

      searchResult.data.forEach((memory, index) => {
        contextSections.push(`## Recent Context ${index + 1}`);
        contextSections.push(`**Date**: ${memory.memory.createdAt.toLocaleDateString()}`);
        contextSections.push(memory.memory.content.substring(0, 300) + '...');
        contextSections.push('');
      });

      console.log(`Session context restored: ${searchResult.data.length} memories`);
      return contextSections.join('\n');

    } catch (error) {
      console.error('SessionStart context restoration failed:', error);
      return null;
    }
  }

  /**
   * Generate memory content from tool interaction
   */
  private async generateMemoryContent(
    hookContext: HookContext,
    toolResult: any,
    options: MemoryStorageOptions
  ): Promise<MemoryContent | null> {
    const projectId = await this.extractProjectId(hookContext);
    if (!projectId) return null;

    let content = '';
    let contentType: 'task' | 'conversation' | 'file' | 'decision' | 'context' = 'conversation';

    switch (hookContext.toolName) {
      case 'Write':
      case 'Edit':
      case 'MultiEdit':
        content = this.generateFileModificationMemory(hookContext, toolResult);
        contentType = 'file';
        break;

      case 'Task':
        content = this.generateTaskExecutionMemory(hookContext, toolResult);
        contentType = 'task';
        break;

      case 'Bash':
        content = this.generateCommandExecutionMemory(hookContext, toolResult);
        contentType = 'task';
        break;

      case 'Read':
        // Only store significant file reads
        if (this.isSignificantFileRead(hookContext)) {
          content = this.generateFileReadMemory(hookContext, toolResult);
          contentType = 'context';
        }
        break;

      default:
        content = this.generateGenericToolMemory(hookContext, toolResult);
        contentType = 'conversation';
    }

    if (!content) return null;

    return {
      content,
      contentType,
      projectId,
      metadata: {
        toolName: hookContext.toolName,
        sessionId: hookContext.sessionId,
        timestamp: hookContext.timestamp.toISOString(),
        toolParams: this.sanitizeToolParams(hookContext.toolParams)
      }
    };
  }

  /**
   * Generate file modification memory content
   */
  private generateFileModificationMemory(hookContext: HookContext, toolResult: any): string {
    const params = hookContext.toolParams;
    const sections = [
      `File ${hookContext.toolName.toLowerCase()} operation: ${params.file_path || 'unknown'}`,
      '',
      `Timestamp: ${hookContext.timestamp.toISOString()}`,
      `Session: ${hookContext.sessionId}`
    ];

    if (params.old_string && params.new_string) {
      sections.push('', 'Changes made:', `- Replaced content in file`, `- Modified ${params.old_string.length} characters`);
    } else if (params.content) {
      sections.push('', 'Content written:', `- File size: ${params.content.length} characters`);
    }

    return sections.join('\n');
  }

  /**
   * Generate task execution memory content
   */
  private generateTaskExecutionMemory(hookContext: HookContext, toolResult: any): string {
    const params = hookContext.toolParams;
    return [
      `Task execution: ${params.description || 'Task performed'}`,
      '',
      `Timestamp: ${hookContext.timestamp.toISOString()}`,
      `Subagent: ${params.subagent_type || 'unknown'}`,
      '',
      `Task details:`,
      params.prompt?.substring(0, 500) + (params.prompt?.length > 500 ? '...' : '') || 'No details available'
    ].join('\n');
  }

  /**
   * Generate command execution memory content
   */
  private generateCommandExecutionMemory(hookContext: HookContext, toolResult: any): string {
    const params = hookContext.toolParams;
    return [
      `Command executed: ${params.command}`,
      '',
      `Timestamp: ${hookContext.timestamp.toISOString()}`,
      `Description: ${params.description || 'No description'}`,
      '',
      toolResult ? `Result available: ${typeof toolResult}` : 'No result captured'
    ].join('\n');
  }

  /**
   * Check if file read is significant enough to store
   */
  private isSignificantFileRead(hookContext: HookContext): boolean {
    const params = hookContext.toolParams;
    const path = params.file_path?.toLowerCase() || '';

    // Store reads of important configuration files
    const significantFiles = [
      'claude.md', 'readme.md', 'package.json', 'tsconfig.json',
      '.env', 'config.', 'settings.json'
    ];

    return significantFiles.some(file => path.includes(file));
  }

  /**
   * Generate file read memory content
   */
  private generateFileReadMemory(hookContext: HookContext, toolResult: any): string {
    const params = hookContext.toolParams;
    return [
      `Important file read: ${params.file_path}`,
      '',
      `Timestamp: ${hookContext.timestamp.toISOString()}`,
      `File contains key project information`,
      '',
      `File analysis: Configuration or documentation file accessed`
    ].join('\n');
  }

  /**
   * Generate generic tool memory content
   */
  private generateGenericToolMemory(hookContext: HookContext, toolResult: any): string {
    return [
      `Tool interaction: ${hookContext.toolName}`,
      '',
      `Timestamp: ${hookContext.timestamp.toISOString()}`,
      `Session: ${hookContext.sessionId}`,
      '',
      `Tool usage recorded for project context`
    ].join('\n');
  }

  /**
   * Extract project ID from hook context
   */
  private async extractProjectId(hookContext: HookContext): Promise<number | null> {
    if (hookContext.projectContext?.id) {
      return hookContext.projectContext.id;
    }

    // Try to get from current task state
    return await this.getCurrentProjectId();
  }

  /**
   * Get current project ID from task state or default project
   */
  private async getCurrentProjectId(): Promise<number | null> {
    try {
      const taskStatePath = path.join(process.cwd(), '.claude', 'state', 'current_task.json');
      const taskState = await fs.readFile(taskStatePath, 'utf8');
      const taskData = JSON.parse(taskState);

      // For now, return a default project ID - this should be enhanced
      // to properly map branch/task to project ID
      return 1; // Default project ID
    } catch {
      return 1; // Default fallback
    }
  }

  /**
   * Assemble enhanced prompt with injected context
   */
  private assembleEnhancedPrompt(originalPrompt: string, contextInjection: string): string {
    return [
      contextInjection,
      '',
      '---',
      '',
      '# User Request',
      '',
      originalPrompt
    ].join('\n');
  }

  /**
   * Sanitize tool parameters for memory storage
   */
  private sanitizeToolParams(params: any): any {
    // Remove potentially sensitive information
    const sanitized = { ...params };

    // Remove large content fields to avoid bloating memory
    if (sanitized.content && sanitized.content.length > 1000) {
      sanitized.content = sanitized.content.substring(0, 1000) + '... (truncated)';
    }

    return sanitized;
  }
}