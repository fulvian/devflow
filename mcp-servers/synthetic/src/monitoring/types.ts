export interface SessionData {
  id: string;
  userId: string;
  startTime: Date;
  lastActivity: Date;
  tokenCount: number;
  maxTokens: number;
  status: 'active' | 'warning' | 'limit_exceeded' | 'inactive';
  costEstimate: number;
  model: string;
}

export interface SessionLimitConfig {
  maxTokensPerSession: number;
  warningThreshold: number; // Percentage (0-100)
  inactivityTimeout: number; // In milliseconds
  predictionWindow: number; // Time window for prediction in ms
}

export interface SessionMetrics {
  currentTokens: number;
  tokensPerMinute: number;
  estimatedTimeToLimit: number;
  costPerMinute: number;
  sessionHealth: 'healthy' | 'degraded' | 'critical';
}

export interface SessionEvent {
  sessionId: string;
  eventType: 'session_started' | 'token_usage' | 'limit_warning' | 'limit_exceeded' | 'session_ended' | 'session_recovered' | 'health_degraded';
  timestamp: Date;
  data?: any;
}

export interface RecoveryStrategy {
  name: string;
  execute: (session: SessionData) => Promise<boolean>;
  priority: number;
}