export interface MetricEvent {
  id: string;
  eventType: string;
  timestamp: number;
  userId?: string;
  userEmail?: string;
  userLocation?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface PerformanceMetrics extends MetricEvent {
  eventType: 'performance';
  duration: number;
  functionName?: string;
  resource?: string;
}

export interface SystemHealthMetrics extends MetricEvent {
  eventType: 'systemHealth';
  uptime: number;
  responseTime: number;
  status: 'healthy' | 'degraded' | 'down';
}

export interface UserBehaviorMetrics extends MetricEvent {
  eventType: 'userBehavior';
  action: string;
  elementId?: string;
  page?: string;
  referrer?: string;
}

export interface FeatureUsageMetrics extends MetricEvent {
  eventType: 'featureUsage';
  featureName: string;
  featureVersion?: string;
  context?: string;
}

export interface ErrorMetrics extends MetricEvent {
  eventType: 'error';
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ResourceUtilizationMetrics extends MetricEvent {
  eventType: 'resourceUtilization';
  cpuUsage: number;
  memoryUsage: number;
  diskUsage?: number;
  networkUsage?: number;
}

export interface UsageStatistics {
  performance: {
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    totalEvents: number;
  };
  systemHealth: {
    avgUptime: number;
    avgResponseTime: number;
    totalChecks: number;
  };
  userBehavior: {
    activeUsers: number;
    totalActions: number;
    popularActions: { action: string; count: number }[];
  };
  featureAdoption: {
    totalUsages: number;
    featureAdoption: { feature: string; count: number }[];
  };
  errorRates: {
    totalErrors: number;
    errorRate: number;
    commonErrors: { error: string; count: number }[];
  };
  resourceUtilization: {
    avgCpuUsage: number;
    avgMemoryUsage: number;
    peakCpuUsage: number;
    peakMemoryUsage: number;
  };
  generatedAt: string;
}

export interface AnalyticsReport {
  id: string;
  generatedAt: string;
  period: string;
  statistics: UsageStatistics;
  trends: {
    type: string;
    description: string;
    severity: 'info' | 'warning' | 'critical';
  }[];
  insights: string[];
}

export interface PrivacySettings {
  dataAnonymization: boolean;
  dataRetentionPeriod: number; // in days
  piiCollection: boolean;
  analyticsSharing: boolean;
}

export interface TrackingConfig {
  enabled: boolean;
  endpoint: string;
  batchSize: number;
  flushInterval: number; // in milliseconds
  privacySettings: PrivacySettings;
}
