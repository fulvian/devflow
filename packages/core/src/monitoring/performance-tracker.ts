/**
 * Performance Tracking Utilities for CCR Fallback Chain
 * 
 * This module provides comprehensive performance monitoring capabilities including:
 * - Agent latency measurement
 * - Throughput calculation
 * - Success rate tracking
 * - Resource utilization monitoring
 * - Performance baseline comparison
 * - Anomaly detection
 * - Statistical analysis utilities
 * - Real-time performance alerts
 */

// Interfaces for type safety
interface PerformanceMetrics {
  latency: number; // in milliseconds
  timestamp: number;
  success: boolean;
  resourceUtilization: ResourceUtilization;
  agentId: string;
  requestId: string;
}

interface ResourceUtilization {
  cpu: number; // percentage 0-100
  memory: number; // percentage 0-100
  network: number; // bytes per second
}

interface ThroughputMetrics {
  requestsPerSecond: number;
  requestsPerMinute: number;
  requestsPerHour: number;
}

interface SuccessRateMetrics {
  successRate: number; // percentage 0-100
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
}

interface BaselineComparison {
  currentLatency: number;
  baselineLatency: number;
  latencyDeviation: number;
  isWithinThreshold: boolean;
}

interface AnomalyDetectionResult {
  isAnomaly: boolean;
  metricType: 'latency' | 'throughput' | 'successRate' | 'resourceUtilization';
  value: number;
  threshold: number;
  timestamp: number;
}

interface AlertConfig {
  latencyThreshold: number; // milliseconds
  successRateThreshold: number; // percentage
  resourceUtilizationThreshold: number; // percentage
  throughputThreshold: number; // requests per second
  alertCallback: (alert: PerformanceAlert) => void;
}

interface PerformanceAlert {
  type: 'latency' | 'successRate' | 'resourceUtilization' | 'throughput';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  agentId?: string;
}

interface StatisticalSummary {
  mean: number;
  median: number;
  mode: number;
  standardDeviation: number;
  percentile95: number;
  percentile99: number;
  min: number;
  max: number;
}

// Main Performance Tracker Class
class PerformanceTracker {
  private metrics: PerformanceMetrics[] = [];
  private alertConfig: AlertConfig | null = null;
  private baselineMetrics: Map<string, number[]> = new Map();
  private alertCooldowns: Map<string, number> = new Map();

  /**
   * Record a performance metric for an agent
   * @param metric The performance metric to record
   */
  recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
    
    // Clean up old metrics (keep only last 24 hours)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp > oneDayAgo);
    
    // Check for anomalies and alerts
    this.checkAnomalies(metric);
    this.checkAlerts(metric);
  }

  /**
   * Calculate throughput metrics
   * @param agentId Optional agent ID to filter metrics
   * @param timeWindow Time window in milliseconds (default: 60000ms = 1 minute)
   * @returns Throughput metrics
   */
  calculateThroughput(agentId?: string, timeWindow: number = 60000): ThroughputMetrics {
    const now = Date.now();
    const windowStart = now - timeWindow;
    
    const relevantMetrics = agentId 
      ? this.metrics.filter(m => m.agentId === agentId && m.timestamp >= windowStart)
      : this.metrics.filter(m => m.timestamp >= windowStart);
    
    const requestCount = relevantMetrics.length;
    const timeWindowSeconds = timeWindow / 1000;
    const timeWindowMinutes = timeWindowSeconds / 60;
    const timeWindowHours = timeWindowMinutes / 60;
    
    return {
      requestsPerSecond: requestCount / timeWindowSeconds,
      requestsPerMinute: requestCount / timeWindowMinutes,
      requestsPerHour: requestCount / timeWindowHours
    };
  }

  /**
   * Calculate success rate metrics
   * @param agentId Optional agent ID to filter metrics
   * @param timeWindow Time window in milliseconds (default: 3600000ms = 1 hour)
   * @returns Success rate metrics
   */
  calculateSuccessRate(agentId?: string, timeWindow: number = 3600000): SuccessRateMetrics {
    const now = Date.now();
    const windowStart = now - timeWindow;
    
    const relevantMetrics = agentId 
      ? this.metrics.filter(m => m.agentId === agentId && m.timestamp >= windowStart)
      : this.metrics.filter(m => m.timestamp >= windowStart);
    
    const totalRequests = relevantMetrics.length;
    const successfulRequests = relevantMetrics.filter(m => m.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
    
    return {
      successRate,
      totalRequests,
      successfulRequests,
      failedRequests
    };
  }

  /**
   * Get average latency for a given agent or overall
   * @param agentId Optional agent ID to filter metrics
   * @param timeWindow Time window in milliseconds (default: 3600000ms = 1 hour)
   * @returns Average latency in milliseconds
   */
  getAverageLatency(agentId?: string, timeWindow: number = 3600000): number {
    const now = Date.now();
    const windowStart = now - timeWindow;
    
    const relevantMetrics = agentId 
      ? this.metrics.filter(m => m.agentId === agentId && m.timestamp >= windowStart)
      : this.metrics.filter(m => m.timestamp >= windowStart);
    
    if (relevantMetrics.length === 0) return 0;
    
    const totalLatency = relevantMetrics.reduce((sum, metric) => sum + metric.latency, 0);
    return totalLatency / relevantMetrics.length;
  }

  /**
   * Get average resource utilization
   * @param agentId Optional agent ID to filter metrics
   * @param timeWindow Time window in milliseconds (default: 3600000ms = 1 hour)
   * @returns Average resource utilization
   */
  getAverageResourceUtilization(agentId?: string, timeWindow: number = 3600000): ResourceUtilization {
    const now = Date.now();
    const windowStart = now - timeWindow;
    
    const relevantMetrics = agentId 
      ? this.metrics.filter(m => m.agentId === agentId && m.timestamp >= windowStart)
      : this.metrics.filter(m => m.timestamp >= windowStart);
    
    if (relevantMetrics.length === 0) {
      return { cpu: 0, memory: 0, network: 0 };
    }
    
    const totalCpu = relevantMetrics.reduce((sum, metric) => sum + metric.resourceUtilization.cpu, 0);
    const totalMemory = relevantMetrics.reduce((sum, metric) => sum + metric.resourceUtilization.memory, 0);
    const totalNetwork = relevantMetrics.reduce((sum, metric) => sum + metric.resourceUtilization.network, 0);
    
    return {
      cpu: totalCpu / relevantMetrics.length,
      memory: totalMemory / relevantMetrics.length,
      network: totalNetwork / relevantMetrics.length
    };
  }

  /**
   * Set performance baseline for comparison
   * @param agentId Agent ID to set baseline for
   * @param metrics Array of latency metrics to establish baseline
   */
  setBaseline(agentId: string, metrics: number[]): void {
    this.baselineMetrics.set(agentId, [...metrics]);
  }

  /**
   * Compare current performance with baseline
   * @param agentId Agent ID to compare
   * @param timeWindow Time window in milliseconds (default: 3600000ms = 1 hour)
   * @param threshold Threshold for deviation detection (default: 0.2 = 20%)
   * @returns Baseline comparison result
   */
  compareWithBaseline(
    agentId: string, 
    timeWindow: number = 3600000,
    threshold: number = 0.2
  ): BaselineComparison | null {
    const baseline = this.baselineMetrics.get(agentId);
    if (!baseline || baseline.length === 0) {
      return null;
    }
    
    const currentLatency = this.getAverageLatency(agentId, timeWindow);
    const baselineLatency = baseline.reduce((sum, val) => sum + val, 0) / baseline.length;
    const latencyDeviation = Math.abs(currentLatency - baselineLatency) / baselineLatency;
    const isWithinThreshold = latencyDeviation <= threshold;
    
    return {
      currentLatency,
      baselineLatency,
      latencyDeviation,
      isWithinThreshold
    };
  }

  /**
   * Detect anomalies in performance metrics
   * @param metric Performance metric to check
   * @param threshold Standard deviation threshold (default: 2)
   * @returns Anomaly detection result
   */
  detectAnomalies(metric: PerformanceMetrics, threshold: number = 2): AnomalyDetectionResult[] {
    const results: AnomalyDetectionResult[] = [];
    
    // Check latency anomaly
    const latencyValues = this.metrics
      .filter(m => m.agentId === metric.agentId)
      .map(m => m.latency);
    
    if (latencyValues.length > 10) { // Need sufficient data
      const stats = this.calculateStatistics(latencyValues);
      const latencyZScore = Math.abs((metric.latency - stats.mean) / stats.standardDeviation);
      
      if (latencyZScore > threshold) {
        results.push({
          isAnomaly: true,
          metricType: 'latency',
          value: metric.latency,
          threshold: stats.mean + (threshold * stats.standardDeviation),
          timestamp: metric.timestamp
        });
      }
    }
    
    return results;
  }

  /**
   * Calculate statistical summary for a dataset
   * @param data Array of numeric values
   * @returns Statistical summary
   */
  calculateStatistics(data: number[]): StatisticalSummary {
    if (data.length === 0) {
      return {
        mean: 0,
        median: 0,
        mode: 0,
        standardDeviation: 0,
        percentile95: 0,
        percentile99: 0,
        min: 0,
        max: 0
      };
    }
    
    const sorted = [...data].sort((a, b) => a - b);
    const mean = sorted.reduce((sum, val) => sum + val, 0) / sorted.length;
    
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    
    const mode = this.calculateMode(sorted);
    const standardDeviation = Math.sqrt(
      sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / sorted.length
    );
    
    const percentile95 = sorted[Math.floor(sorted.length * 0.95)];
    const percentile99 = sorted[Math.floor(sorted.length * 0.99)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    
    return {
      mean,
      median,
      mode,
      standardDeviation,
      percentile95,
      percentile99,
      min,
      max
    };
  }

  /**
   * Configure real-time performance alerts
   * @param config Alert configuration
   */
  configureAlerts(config: AlertConfig): void {
    this.alertConfig = config;
  }

  /**
   * Get recent performance alerts
   * @param limit Maximum number of alerts to return (default: 100)
   * @returns Array of recent alerts
   */
  getRecentAlerts(limit: number = 100): PerformanceAlert[] {
    // In a real implementation, this would retrieve from a persistent store
    // For now, we'll return an empty array as alerts are handled via callbacks
    return [];
  }

  // Private helper methods
  private calculateMode(data: number[]): number {
    const frequencyMap = new Map<number, number>();
    let maxFrequency = 0;
    let mode = data[0];
    
    for (const value of data) {
      const frequency = (frequencyMap.get(value) || 0) + 1;
      frequencyMap.set(value, frequency);
      
      if (frequency > maxFrequency) {
        maxFrequency = frequency;
        mode = value;
      }
    }
    
    return mode;
  }

  private checkAnomalies(metric: PerformanceMetrics): void {
    const anomalies = this.detectAnomalies(metric);
    // In a real implementation, you might want to log or handle anomalies here
    anomalies.forEach(anomaly => {
      // Handle anomaly detection (e.g., log, send to monitoring system)
    });
  }

  private checkAlerts(metric: PerformanceMetrics): void {
    if (!this.alertConfig) return;
    
    const { 
      latencyThreshold, 
      successRateThreshold, 
      resourceUtilizationThreshold, 
      throughputThreshold,
      alertCallback
    } = this.alertConfig;
    
    const alertKey = `${metric.agentId}-${Math.floor(Date.now() / 60000)}`; // Alert per agent per minute
    
    // Check if we're in cooldown period
    const lastAlertTime = this.alertCooldowns.get(alertKey) || 0;
    const cooldownPeriod = 60000; // 1 minute cooldown
    
    if (Date.now() - lastAlertTime < cooldownPeriod) {
      return;
    }
    
    // Check latency threshold
    if (metric.latency > latencyThreshold) {
      const alert: PerformanceAlert = {
        type: 'latency',
        message: `High latency detected for agent ${metric.agentId}: ${metric.latency}ms`,
        value: metric.latency,
        threshold: latencyThreshold,
        timestamp: metric.timestamp,
        agentId: metric.agentId
      };
      
      alertCallback(alert);
      this.alertCooldowns.set(alertKey, Date.now());
      return;
    }
    
    // Check resource utilization threshold
    const avgResourceUtil = this.getAverageResourceUtilization(metric.agentId);
    if (avgResourceUtil.cpu > resourceUtilizationThreshold || 
        avgResourceUtil.memory > resourceUtilizationThreshold) {
      const alert: PerformanceAlert = {
        type: 'resourceUtilization',
        message: `High resource utilization detected for agent ${metric.agentId}`,
        value: Math.max(avgResourceUtil.cpu, avgResourceUtil.memory),
        threshold: resourceUtilizationThreshold,
        timestamp: metric.timestamp,
        agentId: metric.agentId
      };
      
      alertCallback(alert);
      this.alertCooldowns.set(alertKey, Date.now());
      return;
    }
    
    // Check success rate (using recent data)
    const successMetrics = this.calculateSuccessRate(metric.agentId, 300000); // 5 minutes
    if (successMetrics.successRate < successRateThreshold) {
      const alert: PerformanceAlert = {
        type: 'successRate',
        message: `Low success rate detected for agent ${metric.agentId}: ${successMetrics.successRate.toFixed(2)}%`,
        value: successMetrics.successRate,
        threshold: successRateThreshold,
        timestamp: metric.timestamp,
        agentId: metric.agentId
      };
      
      alertCallback(alert);
      this.alertCooldowns.set(alertKey, Date.now());
      return;
    }
    
    // Check throughput threshold
    const throughput = this.calculateThroughput(metric.agentId, 60000); // 1 minute
    if (throughput.requestsPerSecond < throughputThreshold) {
      const alert: PerformanceAlert = {
        type: 'throughput',
        message: `Low throughput detected for agent ${metric.agentId}: ${throughput.requestsPerSecond.toFixed(2)} req/s`,
        value: throughput.requestsPerSecond,
        threshold: throughputThreshold,
        timestamp: metric.timestamp,
        agentId: metric.agentId
      };
      
      alertCallback(alert);
      this.alertCooldowns.set(alertKey, Date.now());
    }
  }
}

// Export types and class
export {
  PerformanceMetrics,
  ResourceUtilization,
  ThroughputMetrics,
  SuccessRateMetrics,
  BaselineComparison,
  AnomalyDetectionResult,
  AlertConfig,
  PerformanceAlert,
  StatisticalSummary,
  PerformanceTracker
};

// Export a default instance for convenience
export default new PerformanceTracker();