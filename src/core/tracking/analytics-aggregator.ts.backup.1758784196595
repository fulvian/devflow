import { UsageStatistics, AnalyticsReport, MetricEvent } from './tracking-types';
import { MetricsCollector } from './metrics-collector';

export class AnalyticsAggregator {
  private metricsCollector: MetricsCollector | null = null;
  private isInitialized: boolean = false;
  private retentionPeriod: number; // in days

  constructor(retentionPeriod: number = 30) {
    this.retentionPeriod = retentionPeriod;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    this.metricsCollector = new MetricsCollector();
    await this.metricsCollector.initialize();
    
    this.isInitialized = true;
    console.log('Analytics aggregator initialized');
  }

  getAggregatedData(): UsageStatistics {
    if (!this.isInitialized || !this.metricsCollector) {
      throw new Error('AnalyticsAggregator not initialized');
    }
    
    const metricsData = this.metricsCollector.getMetricsData();
    
    // Apply data retention policies
    const filteredData = this.applyDataRetention(metricsData);
    
    // Generate aggregated statistics
    return {
      performance: this.aggregatePerformanceMetrics(filteredData.performance),
      systemHealth: this.aggregateSystemHealthMetrics(filteredData.systemHealth),
      userBehavior: this.aggregateUserBehaviorMetrics(filteredData.userBehavior),
      featureAdoption: this.aggregateFeatureUsageMetrics(filteredData.featureUsage),
      errorRates: this.aggregateErrorMetrics(filteredData.errors),
      resourceUtilization: this.aggregateResourceUtilizationMetrics(filteredData.resourceUtilization),
      generatedAt: new Date().toISOString()
    };
  }

  generateReport(): AnalyticsReport {
    const stats = this.getAggregatedData();
    
    return {
      id: `report_${Date.now()}`,
      generatedAt: stats.generatedAt,
      period: 'last_30_days',
      statistics: stats,
      trends: this.detectTrends(stats),
      insights: this.generateInsights(stats)
    };
  }

  exportData(data: UsageStatistics, format: 'json' | 'csv'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this.convertToCSV(data);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private applyDataRetention(metricsData: any): any {
    const cutoffDate = Date.now() - (this.retentionPeriod * 24 * 60 * 60 * 1000);
    
    const filterByDate = (items: MetricEvent[]) => 
      items.filter(item => (item.timestamp || 0) > cutoffDate);
    
    return {
      performance: filterByDate(metricsData.performance),
      systemHealth: filterByDate(metricsData.systemHealth),
      userBehavior: filterByDate(metricsData.userBehavior),
      featureUsage: filterByDate(metricsData.featureUsage),
      errors: filterByDate(metricsData.errors),
      resourceUtilization: filterByDate(metricsData.resourceUtilization)
    };
  }

  private aggregatePerformanceMetrics(metrics: any[]): any {
    if (metrics.length === 0) return {};
    
    const durations = metrics.map(m => m.duration || 0);
    return {
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      totalEvents: metrics.length
    };
  }

  private aggregateSystemHealthMetrics(metrics: any[]): any {
    if (metrics.length === 0) return {};
    
    const uptimes = metrics.map(m => m.uptime || 0);
    const responseTimes = metrics.map(m => m.responseTime || 0);
    
    return {
      avgUptime: uptimes.reduce((a, b) => a + b, 0) / uptimes.length,
      avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      totalChecks: metrics.length
    };
  }

  private aggregateUserBehaviorMetrics(metrics: any[]): any {
    if (metrics.length === 0) return {};
    
    const userCounts: Record<string, number> = {};
    const actionCounts: Record<string, number> = {};
    
    metrics.forEach(metric => {
      // Count unique users
      if (metric.userId) {
        userCounts[metric.userId] = (userCounts[metric.userId] || 0) + 1;
      }
      
      // Count actions
      if (metric.action) {
        actionCounts[metric.action] = (actionCounts[metric.action] || 0) + 1;
      }
    });
    
    return {
      activeUsers: Object.keys(userCounts).length,
      totalActions: metrics.length,
      popularActions: Object.entries(actionCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([action, count]) => ({ action, count }))
    };
  }

  private aggregateFeatureUsageMetrics(metrics: any[]): any {
    if (metrics.length === 0) return {};
    
    const featureCounts: Record<string, number> = {};
    
    metrics.forEach(metric => {
      if (metric.featureName) {
        featureCounts[metric.featureName] = (featureCounts[metric.featureName] || 0) + 1;
      }
    });
    
    return {
      totalUsages: metrics.length,
      featureAdoption: Object.entries(featureCounts)
        .map(([feature, count]) => ({ feature, count }))
        .sort((a, b) => b.count - a.count)
    };
  }

  private aggregateErrorMetrics(metrics: any[]): any {
    if (metrics.length === 0) return {};
    
    const errorCounts: Record<string, number> = {};
    
    metrics.forEach(metric => {
      if (metric.errorType) {
        errorCounts[metric.errorType] = (errorCounts[metric.errorType] || 0) + 1;
      }
    });
    
    return {
      totalErrors: metrics.length,
      errorRate: metrics.length / (metrics.length + 100), // Simplified calculation
      commonErrors: Object.entries(errorCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([error, count]) => ({ error, count }))
    };
  }

  private aggregateResourceUtilizationMetrics(metrics: any[]): any {
    if (metrics.length === 0) return {};
    
    const cpuUsages = metrics.map(m => m.cpuUsage || 0);
    const memoryUsages = metrics.map(m => m.memoryUsage || 0);
    
    return {
      avgCpuUsage: cpuUsages.reduce((a, b) => a + b, 0) / cpuUsages.length,
      avgMemoryUsage: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
      peakCpuUsage: Math.max(...cpuUsages),
      peakMemoryUsage: Math.max(...memoryUsages)
    };
  }

  private detectTrends(stats: UsageStatistics): any[] {
    // Simplified trend detection
    const trends = [];
    
    if (stats.performance.avgDuration && stats.performance.avgDuration > 1000) {
      trends.push({
        type: 'performance',
        description: 'Average performance duration has increased',
        severity: 'warning'
      });
    }
    
    if (stats.errorRates.totalErrors && stats.errorRates.totalErrors > 50) {
      trends.push({
        type: 'error',
        description: 'Error rate has increased significantly',
        severity: 'critical'
      });
    }
    
    return trends;
  }

  private generateInsights(stats: UsageStatistics): string[] {
    const insights = [];
    
    if (stats.userBehavior.activeUsers && stats.userBehavior.activeUsers > 1000) {
      insights.push('High user engagement detected');
    }
    
    if (stats.featureAdoption.featureAdoption.length > 0) {
      const topFeature = stats.featureAdoption.featureAdoption[0];
      insights.push(`Top adopted feature: ${topFeature.feature} (${topFeature.count} usages)`);
    }
    
    if (stats.resourceUtilization.avgCpuUsage && stats.resourceUtilization.avgCpuUsage > 80) {
      insights.push('High CPU utilization detected');
    }
    
    return insights;
  }

  private convertToCSV(data: UsageStatistics): string {
    // Simplified CSV conversion
    let csv = 'Metric,Value\n';
    
    // Add performance metrics
    if (data.performance.avgDuration) {
      csv += `Average Duration,${data.performance.avgDuration}\n`;
      csv += `Min Duration,${data.performance.minDuration}\n`;
      csv += `Max Duration,${data.performance.maxDuration}\n`;
    }
    
    // Add system health metrics
    if (data.systemHealth.avgUptime) {
      csv += `Average Uptime,${data.systemHealth.avgUptime}\n`;
      csv += `Average Response Time,${data.systemHealth.avgResponseTime}\n`;
    }
    
    // Add user behavior metrics
    csv += `Active Users,${data.userBehavior.activeUsers || 0}\n`;
    csv += `Total Actions,${data.userBehavior.totalActions || 0}\n`;
    
    // Add error metrics
    csv += `Total Errors,${data.errorRates.totalErrors || 0}\n`;
    
    return csv;
  }

  async cleanup(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }
    
    await this.metricsCollector?.cleanup();
    this.isInitialized = false;
  }
}
