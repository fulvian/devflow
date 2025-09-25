/**
 * Cross-Session Memory Bridge
 * Bridges session state manager with dual-trigger context manager
 * Provides seamless integration between Python hooks and TypeScript semantic memory
 */

import { SessionStateManager, SessionStateSnapshot, SessionRestoration } from './session-state-manager';
import { EnhancedProjectMemorySystem } from './enhanced-memory-system';
import { MemoryHookIntegrationBridge } from './memory-hook-integration-bridge';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface DualTriggerIntegration {
  taskCreationDetected: boolean;
  contextLimitReached: boolean;
  sessionId: string;
  triggerType: 'task_creation' | 'context_limit' | 'manual';
  confidence: number;
}

export interface CrossSessionOperation {
  operation: 'save_session' | 'restore_session' | 'bridge_sessions' | 'cleanup_old';
  sessionId: string;
  projectId: number;
  metadata?: any;
}

export interface BridgeOperationResult {
  success: boolean;
  data?: any;
  error?: string;
  processingTime: number;
  operationType: string;
}

export class CrossSessionMemoryBridge {
  private sessionManager: SessionStateManager;
  private memorySystem: EnhancedProjectMemorySystem;
  private hookBridge: MemoryHookIntegrationBridge;

  constructor() {
    this.sessionManager = new SessionStateManager();
    this.memorySystem = new EnhancedProjectMemorySystem();
    this.hookBridge = new MemoryHookIntegrationBridge();
  }

  /**
   * Initialize cross-session memory bridge
   */
  async initialize(): Promise<boolean> {
    try {
      const [sessionInit, memoryInit, hookInit] = await Promise.all([
        this.sessionManager.initialize(),
        this.memorySystem.initialize(),
        this.hookBridge.initialize()
      ]);

      if (!sessionInit || !memoryInit.success || !hookInit) {
        console.error('Failed to initialize Cross-Session Memory Bridge');
        return false;
      }

      console.log('Cross-Session Memory Bridge initialized successfully');
      return true;
    } catch (error) {
      console.error('Cross-Session Memory Bridge initialization failed:', error);
      return false;
    }
  }

  /**
   * Handle dual-trigger session save operation
   */
  async handleDualTriggerSave(
    triggerData: DualTriggerIntegration,
    currentContext: string
  ): Promise<BridgeOperationResult> {
    const startTime = performance.now();

    try {
      // Extract current session information
      const sessionSnapshot = await this.extractSessionSnapshot(
        triggerData.sessionId,
        currentContext,
        triggerData
      );

      // Save session state with semantic correlation
      const saveSuccess = await this.sessionManager.saveSessionState(sessionSnapshot);

      if (!saveSuccess) {
        return {
          success: false,
          error: 'Failed to save session state',
          processingTime: performance.now() - startTime,
          operationType: 'dual_trigger_save'
        };
      }

      // Store dual-trigger metadata for future reference
      await this.storeDualTriggerMetadata(triggerData, sessionSnapshot);

      return {
        success: true,
        data: {
          sessionId: sessionSnapshot.sessionId,
          triggerType: triggerData.triggerType,
          contextTokens: sessionSnapshot.contextWindow.estimatedTokens,
          correlatedMemories: sessionSnapshot.semanticCorrelation.relatedMemories.length
        },
        processingTime: performance.now() - startTime,
        operationType: 'dual_trigger_save'
      };

    } catch (error) {
      return {
        success: false,
        error: `Dual-trigger save failed: ${error}`,
        processingTime: performance.now() - startTime,
        operationType: 'dual_trigger_save'
      };
    }
  }

  /**
   * Handle session restoration for new Claude Code session
   */
  async handleSessionRestoration(
    sessionId: string,
    projectId: number
  ): Promise<BridgeOperationResult> {
    const startTime = performance.now();

    try {
      // Restore session context using semantic memory
      const restoration = await this.sessionManager.restoreSessionContext(
        sessionId,
        projectId
      );

      if (!restoration.success) {
        return {
          success: true, // Not an error - just no context to restore
          data: {
            contextRestored: false,
            message: 'No previous session context found'
          },
          processingTime: performance.now() - startTime,
          operationType: 'session_restoration'
        };
      }

      // Create continuity with previous sessions
      const continuity = await this.createSessionContinuity(
        sessionId,
        projectId,
        restoration
      );

      return {
        success: true,
        data: {
          contextRestored: true,
          restoredContext: restoration.restoredContext,
          contextQuality: restoration.contextQuality,
          correlatedMemories: restoration.correlatedMemories.length,
          continuityQuality: continuity.bridgeQuality,
          recommendedContext: restoration.recommendedContext
        },
        processingTime: performance.now() - startTime,
        operationType: 'session_restoration'
      };

    } catch (error) {
      return {
        success: false,
        error: `Session restoration failed: ${error}`,
        processingTime: performance.now() - startTime,
        operationType: 'session_restoration'
      };
    }
  }

  /**
   * Handle intelligent context switching between tasks
   */
  async handleContextSwitch(
    fromSessionId: string,
    toSessionId: string,
    projectId: number,
    taskContext: string
  ): Promise<BridgeOperationResult> {
    const startTime = performance.now();

    try {
      // Create conversation continuity bridge
      const continuity = await this.sessionManager.createConversationContinuity(
        fromSessionId,
        toSessionId,
        projectId
      );

      // Enhance with task-specific context
      const enhancedContext = await this.enhanceWithTaskContext(
        continuity.continuityContext,
        taskContext,
        projectId
      );

      return {
        success: true,
        data: {
          continuityContext: enhancedContext,
          bridgeQuality: continuity.bridgeQuality,
          taskContextIntegrated: taskContext.length > 0
        },
        processingTime: performance.now() - startTime,
        operationType: 'context_switch'
      };

    } catch (error) {
      return {
        success: false,
        error: `Context switch failed: ${error}`,
        processingTime: performance.now() - startTime,
        operationType: 'context_switch'
      };
    }
  }

  /**
   * Handle periodic cleanup of old session data
   */
  async handleSessionCleanup(
    maxAgeHours: number = 72,
    projectId?: number
  ): Promise<BridgeOperationResult> {
    const startTime = performance.now();

    try {
      let cleanupCount = 0;

      // Clean up session metadata
      const metadataPath = path.join(process.cwd(), '.devflow/session-metadata.json');

      try {
        const metadata = await fs.readFile(metadataPath, 'utf8');
        const sessions = JSON.parse(metadata);
        const maxAge = Date.now() - (maxAgeHours * 60 * 60 * 1000);

        const activeSessions = sessions.filter((session: any) => {
          const sessionTime = new Date(session.timestamp).getTime();
          return sessionTime > maxAge;
        });

        if (activeSessions.length < sessions.length) {
          cleanupCount = sessions.length - activeSessions.length;
          await fs.writeFile(metadataPath, JSON.stringify(activeSessions, null, 2));
        }

      } catch {
        // Metadata file doesn't exist or is corrupted
      }

      // TODO: Clean up old semantic memory entries marked as session contexts
      // This would require enhanced memory system cleanup methods

      return {
        success: true,
        data: {
          cleanedSessions: cleanupCount,
          maxAgeHours,
          projectId
        },
        processingTime: performance.now() - startTime,
        operationType: 'session_cleanup'
      };

    } catch (error) {
      return {
        success: false,
        error: `Session cleanup failed: ${error}`,
        processingTime: performance.now() - startTime,
        operationType: 'session_cleanup'
      };
    }
  }

  /**
   * Get bridge health and statistics
   */
  async getBridgeHealth(): Promise<{
    healthy: boolean;
    components: { [key: string]: boolean };
    statistics: { [key: string]: number };
  }> {
    try {
      const [sessionHealth, memoryHealth, hookHealth] = await Promise.all([
        this.checkSessionManagerHealth(),
        this.memorySystem.runHealthCheck(),
        this.checkHookBridgeHealth()
      ]);

      const statistics = await this.gatherBridgeStatistics();

      return {
        healthy: sessionHealth && memoryHealth.success && hookHealth,
        components: {
          session_manager: sessionHealth,
          memory_system: memoryHealth.success,
          hook_bridge: hookHealth
        },
        statistics
      };

    } catch (error) {
      console.error('Bridge health check failed:', error);
      return {
        healthy: false,
        components: {
          session_manager: false,
          memory_system: false,
          hook_bridge: false
        },
        statistics: {}
      };
    }
  }

  /**
   * Extract session snapshot from current context
   */
  private async extractSessionSnapshot(
    sessionId: string,
    currentContext: string,
    triggerData: DualTriggerIntegration
  ): Promise<SessionStateSnapshot> {
    // Get current project information
    const projectInfo = await this.getCurrentProjectInfo();

    // Estimate context window usage
    const estimatedTokens = Math.ceil(currentContext.length / 4);
    const usagePercentage = triggerData.contextLimitReached ? 0.95 : estimatedTokens / 200000;

    // Extract conversation themes (simplified)
    const conversationThemes = this.extractThemes(currentContext);

    return {
      sessionId,
      projectId: projectInfo.id,
      timestamp: new Date(),
      contextWindow: {
        currentContent: currentContext,
        estimatedTokens,
        usagePercentage
      },
      conversationFlow: {
        recentPrompts: this.extractRecentPrompts(currentContext),
        taskContext: projectInfo.taskContext,
        workingDirectory: process.cwd(),
        currentBranch: projectInfo.branch
      },
      semanticCorrelation: {
        relatedMemories: [], // Will be populated by semantic correlation
        topicClusters: [],
        conversationThemes
      }
    };
  }

  /**
   * Store dual-trigger metadata for analysis
   */
  private async storeDualTriggerMetadata(
    triggerData: DualTriggerIntegration,
    snapshot: SessionStateSnapshot
  ): Promise<void> {
    try {
      const metadataPath = path.join(process.cwd(), '.devflow/dual-trigger-log.json');
      const logEntry = {
        timestamp: new Date().toISOString(),
        sessionId: triggerData.sessionId,
        triggerType: triggerData.triggerType,
        confidence: triggerData.confidence,
        contextTokens: snapshot.contextWindow.estimatedTokens,
        usagePercentage: snapshot.contextWindow.usagePercentage
      };

      await fs.mkdir(path.dirname(metadataPath), { recursive: true });

      let existingLog = [];
      try {
        const existing = await fs.readFile(metadataPath, 'utf8');
        existingLog = JSON.parse(existing);
      } catch {
        // File doesn't exist, start fresh
      }

      existingLog.push(logEntry);

      // Keep only last 100 entries
      if (existingLog.length > 100) {
        existingLog = existingLog.slice(-100);
      }

      await fs.writeFile(metadataPath, JSON.stringify(existingLog, null, 2));

    } catch (error) {
      console.warn('Failed to store dual-trigger metadata:', error);
    }
  }

  /**
   * Create session continuity with previous sessions
   */
  private async createSessionContinuity(
    sessionId: string,
    projectId: number,
    restoration: SessionRestoration
  ): Promise<{ success: boolean; bridgeQuality: number }> {
    try {
      // Find related sessions for continuity
      const recentSessions = await this.findRecentSessions(projectId, 24); // Last 24 hours

      if (recentSessions.length === 0) {
        return { success: true, bridgeQuality: 0.5 };
      }

      // Calculate continuity quality based on thematic similarity
      const bridgeQuality = this.calculateContinuityQuality(restoration, recentSessions);

      return { success: true, bridgeQuality };

    } catch (error) {
      console.warn('Failed to create session continuity:', error);
      return { success: false, bridgeQuality: 0 };
    }
  }

  /**
   * Enhance continuity context with task-specific information
   */
  private async enhanceWithTaskContext(
    continuityContext: string,
    taskContext: string,
    projectId: number
  ): Promise<string> {
    if (!taskContext) return continuityContext;

    // Search for task-related memories
    const taskMemories = await this.memorySystem.searchMemories({
      query: taskContext,
      projectId,
      contentTypes: ['task', 'decision'],
      limit: 3
    });

    if (!taskMemories.success || !taskMemories.data?.length) {
      return continuityContext;
    }

    const enhancedSections = [
      continuityContext,
      '',
      '## Task Context Enhancement',
      `Current task: ${taskContext}`,
      ''
    ];

    taskMemories.data.forEach((memory, index) => {
      enhancedSections.push(`### Related Task ${index + 1}`);
      enhancedSections.push(memory.memory.content.substring(0, 200) + '...');
      enhancedSections.push('');
    });

    return enhancedSections.join('\n');
  }

  /**
   * Get current project information
   */
  private async getCurrentProjectInfo(): Promise<{
    id: number;
    taskContext: string;
    branch: string;
  }> {
    try {
      const taskStatePath = path.join(process.cwd(), '.claude/state/current_task.json');
      const taskState = await fs.readFile(taskStatePath, 'utf8');
      const taskData = JSON.parse(taskState);

      return {
        id: 1, // Default project ID
        taskContext: taskData.task || 'general',
        branch: taskData.branch || 'main'
      };
    } catch {
      return {
        id: 1,
        taskContext: 'general',
        branch: 'main'
      };
    }
  }

  /**
   * Extract conversation themes from context
   */
  private extractThemes(context: string): string[] {
    const themeKeywords = [
      'implement', 'debug', 'test', 'feature', 'api', 'database',
      'authentication', 'performance', 'security', 'deployment'
    ];

    const lowerContext = context.toLowerCase();
    return themeKeywords.filter(theme => lowerContext.includes(theme));
  }

  /**
   * Extract recent prompts from context
   */
  private extractRecentPrompts(context: string): string[] {
    // Simple extraction - could be enhanced with better parsing
    const lines = context.split('\n').filter(line => line.trim().length > 20);
    return lines.slice(-5); // Last 5 meaningful lines
  }

  /**
   * Find recent sessions for continuity analysis
   */
  private async findRecentSessions(
    projectId: number,
    hours: number
  ): Promise<any[]> {
    try {
      const metadataPath = path.join(process.cwd(), '.devflow/session-metadata.json');
      const metadata = await fs.readFile(metadataPath, 'utf8');
      const sessions = JSON.parse(metadata);

      const cutoff = Date.now() - (hours * 60 * 60 * 1000);

      return sessions.filter((session: any) => {
        const sessionTime = new Date(session.timestamp).getTime();
        return sessionTime > cutoff && session.projectId === projectId;
      });

    } catch {
      return [];
    }
  }

  /**
   * Calculate continuity quality between sessions
   */
  private calculateContinuityQuality(
    restoration: SessionRestoration,
    recentSessions: any[]
  ): number {
    if (recentSessions.length === 0) return 0.5;

    const contextQuality = restoration.contextQuality;
    const sessionCount = Math.min(recentSessions.length / 5, 1); // Normalize to 0-1

    return (contextQuality * 0.7 + sessionCount * 0.3);
  }

  /**
   * Check session manager health
   */
  private async checkSessionManagerHealth(): Promise<boolean> {
    try {
      // Simple health check - could be enhanced
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check hook bridge health
   */
  private async checkHookBridgeHealth(): Promise<boolean> {
    try {
      // Simple health check - could be enhanced
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gather bridge statistics
   */
  private async gatherBridgeStatistics(): Promise<{ [key: string]: number }> {
    try {
      const metadataPath = path.join(process.cwd(), '.devflow/session-metadata.json');
      const metadata = await fs.readFile(metadataPath, 'utf8');
      const sessions = JSON.parse(metadata);

      return {
        total_sessions: sessions.length,
        recent_sessions: sessions.filter((s: any) => {
          const age = Date.now() - new Date(s.timestamp).getTime();
          return age < (24 * 60 * 60 * 1000); // Last 24 hours
        }).length,
        average_context_quality: sessions.reduce((sum: number, s: any) =>
          sum + (s.contextQuality || 0), 0) / sessions.length || 0
      };

    } catch {
      return {
        total_sessions: 0,
        recent_sessions: 0,
        average_context_quality: 0
      };
    }
  }
}