import { CriticalIssue } from '../../types/critical-issues';
import { DashboardData } from './dashboard-data';
import { MetricsCalculator } from './metrics-calculator';
import { OptimizationEngine } from './optimization-engine';
import { Context7Validator } from './context7-validator';

export class AnalyticsService {
  private metricsCalculator: MetricsCalculator;
  private optimizationEngine: OptimizationEngine;
  private context7Validator: Context7Validator;

  constructor() {
    this.metricsCalculator = new MetricsCalculator();
    this.optimizationEngine = new OptimizationEngine();
    this.context7Validator = new Context7Validator();
  }

  async generateDashboardData(issues: CriticalIssue[]): Promise<DashboardData> {
    // Validate Context7 compliance
    const validationResults = this.context7Validator.validateIssues(issues);
    
    // Calculate metrics
    const metrics = this.metricsCalculator.calculateAllMetrics(issues);
    
    // Optimize issue prioritization
    const prioritizedIssues = this.optimizationEngine.prioritizeIssues(issues);
    
    // Generate trend data
    const trendData = this.generateTrendData(issues);
    
    return {
      metrics,
      prioritizedIssues,
      trendData,
      validationResults,
      lastUpdated: new Date()
    };
  }

  private generateTrendData(issues: CriticalIssue[]) {
    // Group issues by date
    const issuesByDate: Record<string, CriticalIssue[]> = {};
    
    issues.forEach(issue => {
      const date = issue.createdAt.toISOString().split('T')[0];
      if (!issuesByDate[date]) {
        issuesByDate[date] = [];
      }
      issuesByDate[date].push(issue);
    });
    
    // Convert to array and sort by date
    const trendData = Object.entries(issuesByDate)
      .map(([date, issues]) => ({
        date,
        count: issues.length,
        resolved: issues.filter(i => i.status === 'resolved').length,
        critical: issues.filter(i => i.severity === 'critical').length
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return trendData;
  }

  async exportReport(data: DashboardData): Promise<Blob> {
    const reportData = {
      summary: {
        totalIssues: data.metrics.totalIssues,
        resolvedIssues: data.metrics.resolvedIssues,
        avgResolutionTime: data.metrics.avgResolutionTime,
        complianceStatus: data.validationResults.isValid
      },
      issues: data.prioritizedIssues.map(issue => ({
        id: issue.id,
        title: issue.title,
        severity: issue.severity,
        status: issue.status,
        priority: issue.priority,
        createdAt: issue.createdAt,
        resolvedAt: issue.resolvedAt
      })),
      trends: data.trendData
    };
    
    const json = JSON.stringify(reportData, null, 2);
    return new Blob([json], { type: 'application/json' });
  }
}
