// src/types/monitoring.ts
export interface MetricData {
  id: string;
  timestamp: Date;
  metricName: string;
  value: number;
  tags?: Record<string, string>;
}

export interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: {
    in: number;
    out: number;
  };
  timestamp: Date;
}

export interface Alert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
}