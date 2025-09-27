export type PlatformType = 'claude' | 'synthetic' | 'gemini' | 'codex';

export interface HealthStatus {
  isDegraded: boolean;
  avgResponseTime: number;
  errorRate: number;
  throttlingEvents: number;
  lastUpdated: number;
}

export interface MonitoringMetrics {
  timestamp: number;
  avgResponseTime: number;
  errorRate: number;
  throttlingEvents: number;
}

export interface Alert {
  id: string;
  type: string;
  message: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high';
}

export interface PlatformCapabilities {
  supportedTasks: string[];
  maxPayloadSize: number;
  costPerRequest: number;
  performanceScore: number;
}

export interface FallbackDecision {
  primaryPlatform: PlatformType;
  fallbackChain: PlatformType[];
  estimatedCost: number;
  estimatedPerformance: number;
  routingReason: 'PERFORMANCE' | 'COST_OPTIMIZATION' | 'THROTTLING' | 'ERROR_RECOVERY';
}

export interface FallbackConfig {
  enableFallback: boolean;
  performanceThreshold: number;
  errorRateThreshold: number;
  recoveryWindowMs: number;
  healthCheckIntervalMs: number;
}
