import { SessionData, SessionLimitConfig, SessionMetrics, RecoveryStrategy } from './types';
import { sessionEvents, SESSION_EVENTS } from './events';

export class SessionMonitor {
  private sessions: Map<string, SessionData> = new Map();
  private config: SessionLimitConfig;
  private metrics: Map<string, SessionMetrics> = new Map();
  private recoveryStrategies: RecoveryStrategy[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(config: SessionLimitConfig) {
    this.config = config;
    this.startMonitoring();
  }

  // Create a new session
  createSession(sessionId: string, userId: string, model: string): SessionData {
    const session: SessionData = {
      id: sessionId,
      userId,
      startTime: new Date(),
      lastActivity: new Date(),
      tokenCount: 0,
      maxTokens: this.config.maxTokensPerSession,
      status: 'active',
      costEstimate: 0,
      model
    };

    this.sessions.set(sessionId, session);
    this.metrics.set(sessionId, {
      currentTokens: 0,
      tokensPerMinute: 0,
      estimatedTimeToLimit: Infinity,
      costPerMinute: 0,
      sessionHealth: 'healthy'
    });

    sessionEvents.emitSessionEvent({
      sessionId,
      eventType: 'session_started',
      timestamp: new Date(),
      data: session
    });

    sessionEvents.emitSessionUpdate(session);
    return session;
  }

  // Update token usage for a session
  updateTokenUsage(sessionId: string, tokens: number, cost: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.tokenCount += tokens;
    session.lastActivity = new Date();
    session.costEstimate += cost;

    this.calculateMetrics(sessionId);
    this.checkLimits(sessionId);

    sessionEvents.emitSessionEvent({
      sessionId,
      eventType: 'token_usage',
      timestamp: new Date(),
      data: { tokens, cost }
    });

    sessionEvents.emitSessionUpdate(session);
  }

  // End a session
  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'inactive';
    this.sessions.delete(sessionId);
    this.metrics.delete(sessionId);

    sessionEvents.emitSessionEvent({
      sessionId,
      eventType: 'session_ended',
      timestamp: new Date()
    });

    sessionEvents.emitSessionUpdate(session);
  }

  // Get session data
  getSession(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  // Get all active sessions
  getActiveSessions(): SessionData[] {
    return Array.from(this.sessions.values()).filter(s => s.status !== 'inactive');
  }

  // Add a recovery strategy
  addRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
    this.recoveryStrategies.sort((a, b) => a.priority - b.priority);
  }

  // Attempt to recover a session
  async attemptRecovery(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    for (const strategy of this.recoveryStrategies) {
      try {
        const success = await strategy.execute(session);
        if (success) {
          session.status = 'active';
          sessionEvents.emitSessionRecovered(session);
          sessionEvents.emitSessionUpdate(session);
          return true;
        }
      } catch (error) {
        console.error(`Recovery strategy ${strategy.name} failed:`, error);
      }
    }

    return false;
  }

  // Private methods
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.checkInactivity();
      this.checkHealth();
    }, 30000); // Check every 30 seconds
  }

  private calculateMetrics(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    const metrics = this.metrics.get(sessionId);
    if (!session || !metrics) return;

    // Calculate tokens per minute
    const timeElapsed = (Date.now() - session.startTime.getTime()) / 60000; // in minutes
    metrics.tokensPerMinute = timeElapsed > 0 ? session.tokenCount / timeElapsed : 0;

    // Estimate time to limit
    const remainingTokens = session.maxTokens - session.tokenCount;
    metrics.estimatedTimeToLimit = metrics.tokensPerMinute > 0 
      ? (remainingTokens / metrics.tokensPerMinute) * 60000 // Convert to milliseconds
      : Infinity;

    // Update current tokens
    metrics.currentTokens = session.tokenCount;

    this.metrics.set(sessionId, metrics);
  }

  private checkLimits(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    const metrics = this.metrics.get(sessionId);
    if (!session || !metrics) return;

    const usagePercentage = (session.tokenCount / session.maxTokens) * 100;
    
    // Check if limit exceeded
    if (session.tokenCount >= session.maxTokens) {
      if (session.status !== 'limit_exceeded') {
        session.status = 'limit_exceeded';
        sessionEvents.emitLimitExceeded(session);
        sessionEvents.emitSessionUpdate(session);
      }
      return;
    }

    // Check warning threshold
    if (usagePercentage >= this.config.warningThreshold) {
      if (session.status === 'active') {
        session.status = 'warning';
        sessionEvents.emitLimitWarning(session, metrics.estimatedTimeToLimit);
        sessionEvents.emitSessionUpdate(session);
      }
    }
  }

  private checkInactivity(): void {
    const now = Date.now();
    const timeout = this.config.inactivityTimeout;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.status === 'inactive') continue;

      if (now - session.lastActivity.getTime() > timeout) {
        session.status = 'inactive';
        this.sessions.delete(sessionId);
        this.metrics.delete(sessionId);
        
        sessionEvents.emitSessionEvent({
          sessionId,
          eventType: 'session_ended',
          timestamp: new Date(),
          data: { reason: 'inactivity_timeout' }
        });
      }
    }
  }

  private checkHealth(): void {
    for (const [sessionId, metrics] of this.metrics.entries()) {
      const session = this.sessions.get(sessionId);
      if (!session) continue;

      // Determine health based on metrics
      let health: 'healthy' | 'degraded' | 'critical' = 'healthy';
      
      if (metrics.tokensPerMinute > session.maxTokens * 0.8) {
        health = 'critical';
      } else if (metrics.tokensPerMinute > session.maxTokens * 0.5) {
        health = 'degraded';
      }

      if (health !== metrics.sessionHealth) {
        metrics.sessionHealth = health;
        this.metrics.set(sessionId, metrics);
        
        if (health !== 'healthy') {
          sessionEvents.emitHealthDegraded(session, health);
        }
      }
    }
  }

  // Cleanup
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.sessions.clear();
    this.metrics.clear();
  }
}