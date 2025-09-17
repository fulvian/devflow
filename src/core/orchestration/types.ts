// src/core/orchestration/types.ts
// Type definitions for Dream Team Orchestrator

export type AgentStatus = 'healthy' | 'unhealthy' | 'error' | 'unknown';

export interface HealthMetrics {
  responseTime: number;
  successRate: number;
  errorCount: number;
  totalRequests: number;
}

export interface DelegationRequest {
  task: string;
  agentPreferences?: string[];
  timeout?: number;
  context?: any;
}

export interface DelegationResult {
  success: boolean;
  agentUsed: string;
  result?: any;
  error?: string;
  timestamp: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  timeout: number;
  resetTimeout: number;
}

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';