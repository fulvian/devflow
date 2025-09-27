/**
 * Type definitions for CCR monitoring system
 */

import { CircuitBreakerState } from '../../../packages/core/src/coordination/circuit-breaker';

// Base event interface
export interface CCREvent {
  id: string;
  type: 'fallback_triggered' | 'circuit_breaker_change' | 'session_timeout' | 'error' | 'recovery';
  timestamp: number;
  sessionId?: string;
  taskId?: string;
  agentId?: string;
  data: Record<string, any>;
}

// Fallback event data
export interface FallbackEvent extends CCREvent {
  type: 'fallback_triggered';
  data: {
    fromAgent: string;
    toAgent: string;
    reason: string;
    context: Record<string, any>;
    timeUtilization: number;
  };
}

// Circuit breaker event data
export interface CircuitBreakerEvent extends CCREvent {
  type: 'circuit_breaker_change';
  data: {
    serviceId: string;
    fromState: CircuitBreakerState;
    toState: CircuitBreakerState;
    failureCount: number;
  };
}

// Error event data
export interface ErrorEvent extends CCREvent {
  type: 'error';
  data: {
    error: string;
    stack?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    component: string;
  };
}

// Metrics data interface
export interface MetricsData {
  timestamp: number;
  ccr: {
    sessionsActive: number;
    fallbacksTriggered: number;
    errors: number;
    avgResponseTime: number;
  };
  circuitBreakers: Array<{
    serviceId: string;
    state: CircuitBreakerState;
    failureCount: number;
    successCount: number;
  }>;
  performance: {
    memoryUsage: number;
    cpuUsage: number;
    uptime: number;
  };
}

// Alert interface
export interface Alert {
  id: string;
  type: 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: number;
  data?: Record<string, any>;
  acknowledged: boolean;
  resolvedAt?: number;
}

// Service health status
export interface ServiceHealth {
  serviceId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: number;
  responseTime: number;
  errorRate: number;
}

export { CircuitBreakerState };