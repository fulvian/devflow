// src/types/dashboard.ts
export interface SystemStatus {
  id: string;
  name: string;
  status: 'operational' | 'degraded' | 'down';
  lastUpdated: Date;
  metrics: {
    requestsPerSecond: number;
    errorRate: number;
    latency: number;
  };
}

export interface Alert {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  description: string;
  acknowledged: boolean;
}

export interface WebSocketMessage {
  type: 'status_update' | 'alert' | 'metrics';
  data: SystemStatus | Alert | any;
}