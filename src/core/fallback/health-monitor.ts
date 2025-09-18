import { HealthStatus, MonitoringMetrics, Alert } from './fallback-types';

type HealthCallback = (health: HealthStatus) => void;

class HealthMonitor {
  private healthStatus: HealthStatus = {
    isDegraded: false,
    avgResponseTime: 0,
    errorRate: 0,
    throttlingEvents: 0,
    lastUpdated: Date.now()
  };
  
  private metricsHistory: MonitoringMetrics[] = [];
  private alerts: Alert[] = [];
  private subscribers: HealthCallback[] = [];
  private responseTimes: number[] = [];
  private errorCount: number = 0;
  private totalCount: number = 0;

  subscribe(callback: HealthCallback): void {
    this.subscribers.push(callback);
  }

  recordResponseTime(responseTime: number): void {
    this.responseTimes.push(responseTime);
    this.totalCount++;
    
    // Keep only last 100 response times
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
    
    this.updateHealthStatus();
  }

  recordError(): void {
    this.errorCount++;
    this.totalCount++;
    this.updateHealthStatus();
  }

  recordThrottling(): void {
    this.healthStatus.throttlingEvents++;
    this.generateAlert('THROTTLING_DETECTED', 'Claude Code throttling detected');
    this.updateHealthStatus();
  }

  getCurrentHealth(): HealthStatus {
    return { ...this.healthStatus };
  }

  getHistoricalMetrics(hours: number = 24): MonitoringMetrics[] {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    return this.metricsHistory.filter(metric => metric.timestamp > cutoffTime);
  }

  private updateHealthStatus(): void {
    const avgResponseTime = this.calculateAverage(this.responseTimes);
    const errorRate = this.totalCount > 0 ? this.errorCount / this.totalCount : 0;
    
    this.healthStatus = {
      isDegraded: avgResponseTime > 3000 || errorRate > 0.2,
      avgResponseTime,
      errorRate,
      throttlingEvents: this.healthStatus.throttlingEvents,
      lastUpdated: Date.now()
    };
    
    this.metricsHistory.push({
      timestamp: Date.now(),
      avgResponseTime,
      errorRate,
      throttlingEvents: this.healthStatus.throttlingEvents
    });
    
    // Notify subscribers
    this.subscribers.forEach(callback => callback(this.healthStatus));
    
    // Generate alerts for critical conditions
    if (this.healthStatus.isDegraded) {
      this.generateAlert('DEGRADED_PERFORMANCE', 'Claude Code performance degradation detected');
    }
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private generateAlert(type: string, message: string): void {
    const alert: Alert = {
      id: `${type}-${Date.now()}`,
      type,
      message,
      timestamp: Date.now(),
      severity: this.determineSeverity(type)
    };
    
    this.alerts.push(alert);
    
    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }
    
    console.warn(`Health Alert: ${message}`);
  }

  private determineSeverity(type: string): 'low' | 'medium' | 'high' {
    switch (type) {
      case 'THROTTLING_DETECTED':
        return 'high';
      case 'DEGRADED_PERFORMANCE':
        return 'medium';
      default:
        return 'low';
    }
  }
}

export { HealthMonitor };
