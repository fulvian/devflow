import { CriticalIssue } from '../../types/critical-issues';
import { DashboardMetrics } from './dashboard-data';

export class MetricsCalculator {
  calculateAllMetrics(issues: CriticalIssue[]): DashboardMetrics {
    return {
      totalIssues: this.calculateTotalIssues(issues),
      resolvedIssues: this.calculateResolvedIssues(issues),
      openIssues: this.calculateOpenIssues(issues),
      criticalIssues: this.calculateCriticalIssues(issues),
      highPriorityIssues: this.calculateHighPriorityIssues(issues),
      avgResolutionTime: this.calculateAvgResolutionTime(issues),
      resolutionRate: this.calculateResolutionRate(issues),
      teamEfficiency: this.calculateTeamEfficiency(issues)
    };
  }

  private calculateTotalIssues(issues: CriticalIssue[]): number {
    return issues.length;
  }

  private calculateResolvedIssues(issues: CriticalIssue[]): number {
    return issues.filter(issue => issue.status === 'resolved').length;
  }

  private calculateOpenIssues(issues: CriticalIssue[]): number {
    return issues.filter(issue => issue.status === 'open' || issue.status === 'in-progress').length;
  }

  private calculateCriticalIssues(issues: CriticalIssue[]): number {
    return issues.filter(issue => issue.severity === 'critical').length;
  }

  private calculateHighPriorityIssues(issues: CriticalIssue[]): number {
    return issues.filter(issue => issue.priority === 'high' || issue.priority === 'critical').length;
  }

  private calculateAvgResolutionTime(issues: CriticalIssue[]): number {
    const resolvedIssues = issues.filter(issue => issue.status === 'resolved' && issue.resolvedAt);
    if (resolvedIssues.length === 0) return 0;
    
    const totalResolutionTime = resolvedIssues.reduce((sum, issue) => {
      const resolutionTime = (issue.resolvedAt!.getTime() - issue.createdAt.getTime()) / (1000 * 60 * 60); // in hours
      return sum + resolutionTime;
    }, 0);
    
    return totalResolutionTime / resolvedIssues.length;
  }

  private calculateResolutionRate(issues: CriticalIssue[]): number {
    if (issues.length === 0) return 0;
    const resolved = issues.filter(issue => issue.status === 'resolved').length;
    return (resolved / issues.length) * 100;
  }

  private calculateTeamEfficiency(issues: CriticalIssue[]): number {
    // Simplified calculation - in a real implementation, this would consider
    // team capacity, workload distribution, etc.
    const resolvedIssues = issues.filter(issue => issue.status === 'resolved');
    const highPriorityResolved = resolvedIssues.filter(issue => 
      issue.priority === 'high' || issue.priority === 'critical'
    ).length;
    
    if (resolvedIssues.length === 0) return 0;
    return (highPriorityResolved / resolvedIssues.length) * 100;
  }
}
