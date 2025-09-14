// sonnet-usage-monitor.ts
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// Types and interfaces
interface UsageMetrics {
  tokensUsed: number;
  apiCalls: number;
  sessionStartTime: Date;
  lastActivity: Date;
}

interface UsageThresholds {
  warningThreshold: number; // 80%
  delegationThreshold: number; // 90%
  maxSessionDuration: number; // in milliseconds (5 hours)
  maxTokens: number;
  maxApiCalls: number;
}

interface DelegationAction {
  trigger: 'tokens' | 'apiCalls' | 'sessionTime';
  thresholdReached: number;
  actionRequired: boolean;
  recommendedDelegate: string;
}

interface UsageHistory {
  sessionId: string;
  startTime: Date;
  endTime: Date;
  totalTokens: number;
  totalApiCalls: number;
  delegationTriggered: boolean;
}

// Cognitive database interface (stub for actual implementation)
interface CognitiveDatabase {
  saveUsageHistory(history: UsageHistory): Promise<void>;
  getUsagePatterns(userId: string): Promise<any>;
  updateUsageMetrics(metrics: UsageMetrics): Promise<void>;
}

// Claude Code analytics interface (stub for actual implementation)
interface ClaudeCodeAnalytics {
  reportUsage(metrics: UsageMetrics): Promise<void>;
  getOptimizationSuggestions(): Promise<string[]>;
}

class SonnetUsageMonitor extends EventEmitter {
  private usageMetrics: UsageMetrics;
  private thresholds: UsageThresholds;
  private sessionId: string;
  private isMonitoring: boolean;
  private delegationHierarchy: string[];
  private cognitiveDb: CognitiveDatabase;
  private claudeAnalytics: ClaudeCodeAnalytics;

  constructor(
    cognitiveDb: CognitiveDatabase,
    claudeAnalytics: ClaudeCodeAnalytics,
    delegationHierarchy: string[] = ['junior-dev', 'senior-dev', 'tech-lead']
  ) {
    super();
    this.sessionId = uuidv4();
    this.isMonitoring = false;
    this.delegationHierarchy = delegationHierarchy;
    this.cognitiveDb = cognitiveDb;
    this.claudeAnalytics = claudeAnalytics;

    // Initialize usage metrics
    this.usageMetrics = {
      tokensUsed: 0,
      apiCalls: 0,
      sessionStartTime: new Date(),
      lastActivity: new Date()
    };

    // Set thresholds (example values - should be configurable)
    this.thresholds = {
      warningThreshold: 0.8,
      delegationThreshold: 0.9,
      maxSessionDuration: 5 * 60 * 60 * 1000, // 5 hours in milliseconds
      maxTokens: 100000, // Example token limit
      maxApiCalls: 1000 // Example API call limit
    };
  }

  /**
   * Start monitoring Sonnet usage
   */
  public startMonitoring(): void {
    if (this.isMonitoring) {
      console.warn('Monitoring is already active');
      return;
    }

    this.isMonitoring = true;
    this.usageMetrics.sessionStartTime = new Date();
    this.usageMetrics.lastActivity = new Date();
    
    console.log(`Sonnet Usage Monitor started. Session ID: ${this.sessionId}`);
    this.emit('monitoringStarted', { sessionId: this.sessionId });
  }

  /**
   * Stop monitoring and save session history
   */
  public async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      console.warn('Monitoring is not active');
      return;
    }

    this.isMonitoring = false;
    
    const usageHistory: UsageHistory = {
      sessionId: this.sessionId,
      startTime: this.usageMetrics.sessionStartTime,
      endTime: new Date(),
      totalTokens: this.usageMetrics.tokensUsed,
      totalApiCalls: this.usageMetrics.apiCalls,
      delegationTriggered: false // This would be set during monitoring
    };

    try {
      await this.cognitiveDb.saveUsageHistory(usageHistory);
      console.log(`Usage history saved for session ${this.sessionId}`);
      this.emit('monitoringStopped', usageHistory);
    } catch (error) {
      console.error('Failed to save usage history:', error);
      this.emit('error', { message: 'Failed to save usage history', error });
    }
  }

  /**
   * Record token usage
   * @param tokens Number of tokens used
   */
  public async recordTokenUsage(tokens: number): Promise<void> {
    if (!this.isMonitoring) {
      throw new Error('Monitoring is not active. Call startMonitoring() first.');
    }

    if (tokens < 0) {
      throw new Error('Token count cannot be negative');
    }

    this.usageMetrics.tokensUsed += tokens;
    this.usageMetrics.lastActivity = new Date();
    
    await this.claudeAnalytics.reportUsage(this.usageMetrics);
    await this.cognitiveDb.updateUsageMetrics(this.usageMetrics);
    
    this.checkThresholds();
  }

  /**
   * Record API call
   */
  public async recordApiCall(): Promise<void> {
    if (!this.isMonitoring) {
      throw new Error('Monitoring is not active. Call startMonitoring() first.');
    }

    this.usageMetrics.apiCalls += 1;
    this.usageMetrics.lastActivity = new Date();
    
    await this.claudeAnalytics.reportUsage(this.usageMetrics);
    await this.cognitiveDb.updateUsageMetrics(this.usageMetrics);
    
    this.checkThresholds();
  }

  /**
   * Check if usage thresholds have been reached
   */
  private checkThresholds(): void {
    const tokenPercentage = this.usageMetrics.tokensUsed / this.thresholds.maxTokens;
    const apiCallPercentage = this.usageMetrics.apiCalls / this.thresholds.maxApiCalls;
    const sessionDuration = Date.now() - this.usageMetrics.sessionStartTime.getTime();
    const sessionTimePercentage = sessionDuration / this.thresholds.maxSessionDuration;

    // Check for warning threshold (80%)
    if (
      tokenPercentage >= this.thresholds.warningThreshold ||
      apiCallPercentage >= this.thresholds.warningThreshold ||
      sessionTimePercentage >= this.thresholds.warningThreshold
    ) {
      this.emit('warningThresholdReached', {
        tokenPercentage,
        apiCallPercentage,
        sessionTimePercentage
      });
    }

    // Check for delegation threshold (90%)
    let delegationAction: DelegationAction | null = null;

    if (tokenPercentage >= this.thresholds.delegationThreshold) {
      delegationAction = {
        trigger: 'tokens',
        thresholdReached: tokenPercentage,
        actionRequired: true,
        recommendedDelegate: this.getRecommendedDelegate()
      };
    } else if (apiCallPercentage >= this.thresholds.delegationThreshold) {
      delegationAction = {
        trigger: 'apiCalls',
        thresholdReached: apiCallPercentage,
        actionRequired: true,
        recommendedDelegate: this.getRecommendedDelegate()
      };
    } else if (sessionTimePercentage >= this.thresholds.delegationThreshold) {
      delegationAction = {
        trigger: 'sessionTime',
        thresholdReached: sessionTimePercentage,
        actionRequired: true,
        recommendedDelegate: this.getRecommendedDelegate()
      };
    }

    if (delegationAction) {
      this.emit('delegationRequired', delegationAction);
      this.triggerDelegation(delegationAction);
    }
  }

  /**
   * Get recommended delegate based on usage patterns
   */
  private getRecommendedDelegate(): string {
    // In a real implementation, this would use ML to analyze usage patterns
    // For now, we'll cycle through the delegation hierarchy
    const currentIndex = this.delegationHierarchy.findIndex(
      delegate => delegate === this.getRecommendedDelegate.name
    );
    
    return this.delegationHierarchy[
      (currentIndex + 1) % this.delegationHierarchy.length
    ] || this.delegationHierarchy[0];
  }

  /**
   * Trigger delegation process
   * @param action Delegation action details
   */
  private async triggerDelegation(action: DelegationAction): Promise<void> {
    try {
      console.log(`Delegation triggered due to ${action.trigger} usage at ${ 
        (action.thresholdReached * 100).toFixed(2) 
      }%`);
      
      // In a real implementation, this would:
      // 1. Notify the recommended delegate
      // 2. Transfer context/state
      // 3. Pause current operations
      // 4. Log the delegation event
      
      this.emit('delegationTriggered', action);
      
      // Update usage history to mark delegation triggered
      // This would be persisted in the cognitive database
    } catch (error) {
      console.error('Failed to trigger delegation:', error);
      this.emit('error', { message: 'Failed to trigger delegation', error });
    }
  }

  /**
   * Get current usage metrics
   */
  public getUsageMetrics(): UsageMetrics {
    return { ...this.usageMetrics };
  }

  /**
   * Get current usage percentages
   */
  public getUsagePercentages(): {
    tokenPercentage: number;
    apiCallPercentage: number;
    sessionTimePercentage: number;
  } {
    const sessionDuration = Date.now() - this.usageMetrics.sessionStartTime.getTime();
    
    return {
      tokenPercentage: this.usageMetrics.tokensUsed / this.thresholds.maxTokens,
      apiCallPercentage: this.usageMetrics.apiCalls / this.thresholds.maxApiCalls,
      sessionTimePercentage: sessionDuration / this.thresholds.maxSessionDuration
    };
  }

  /**
   * Update thresholds dynamically
   * @param newThresholds Updated threshold values
   */
  public updateThresholds(newThresholds: Partial<UsageThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('Usage thresholds updated:', this.thresholds);
  }

  /**
   * Get session information
   */
  public getSessionInfo(): {
    sessionId: string;
    isActive: boolean;
    startTime: Date;
    duration: number; // in milliseconds
  } {
    return {
      sessionId: this.sessionId,
      isActive: this.isMonitoring,
      startTime: this.usageMetrics.sessionStartTime,
      duration: Date.now() - this.usageMetrics.sessionStartTime.getTime()
    };
  }
}

// Event types for type safety
interface SonnetUsageMonitorEvents {
  monitoringStarted: (data: { sessionId: string }) => void;
  monitoringStopped: (data: UsageHistory) => void;
  warningThresholdReached: (data: {
    tokenPercentage: number;
    apiCallPercentage: number;
    sessionTimePercentage: number;
  }) => void;
  delegationRequired: (action: DelegationAction) => void;
  delegationTriggered: (action: DelegationAction) => void;
  error: (error: { message: string; error: any }) => void;
}

// Extend EventEmitter with typed events
interface SonnetUsageMonitor {
  on<U extends keyof SonnetUsageMonitorEvents>(
    event: U, listener: SonnetUsageMonitorEvents[U]
  ): this;
  
  emit<U extends keyof SonnetUsageMonitorEvents>(
    event: U, ...args: Parameters<SonnetUsageMonitorEvents[U]>
  ): boolean;
}

export {
  SonnetUsageMonitor,
  UsageMetrics,
  UsageThresholds,
  DelegationAction,
  UsageHistory,
  CognitiveDatabase,
  ClaudeCodeAnalytics
};

// Example usage:
/*
const cognitiveDb: CognitiveDatabase = {
  saveUsageHistory: async (history) => { /* implementation *\/ },
  getUsagePatterns: async (userId) => { /* implementation *\/ },
  updateUsageMetrics: async (metrics) => { /* implementation *\/ }
};

const claudeAnalytics: ClaudeCodeAnalytics = {
  reportUsage: async (metrics) => { /* implementation *\/ },
  getOptimizationSuggestions: async () => { /* implementation *\/ }
};

const monitor = new SonnetUsageMonitor(cognitiveDb, claudeAnalytics);

monitor.on('warningThresholdReached', (data) => {
  console.warn('Approaching usage limits:', data);
});

monitor.on('delegationRequired', (action) => {
  console.log('Delegation required:', action);
});

monitor.startMonitoring();

// Simulate usage
monitor.recordTokenUsage(5000);
monitor.recordApiCall();
*/