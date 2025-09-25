import { CriticalIssue } from '../../types/critical-issues';

export class OptimizationEngine {
  prioritizeIssues(issues: CriticalIssue[]): CriticalIssue[] {
    return [...issues].sort((a, b) => {
      // First sort by priority
      const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by severity
      const severityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      
      // Then by age (older issues first)
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  calculateIssueImpact(issue: CriticalIssue): number {
    // Calculate impact score based on severity, priority, and age
    const severityScore = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 }[issue.severity];
    const priorityScore = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 }[issue.priority];
    
    // Age factor (in days)
    const ageInDays = (Date.now() - issue.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const ageScore = Math.min(ageInDays / 7, 5); // Cap at 5 points for age
    
    return (severityScore * 0.4) + (priorityScore * 0.4) + (ageScore * 0.2);
  }

  recommendActions(issues: CriticalIssue[]): string[] {
    const recommendations: string[] = [];
    
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const overdueIssues = issues.filter(i => 
      i.priority === 'high' && 
      Date.now() - i.createdAt.getTime() > 7 * 24 * 60 * 60 * 1000 // Older than 7 days
    );
    
    if (criticalIssues.length > 5) {
      recommendations.push(`Attention needed: ${criticalIssues.length} critical issues require immediate action`);
    }
    
    if (overdueIssues.length > 10) {
      recommendations.push(`${overdueIssues.length} high priority issues are overdue for resolution`);
    }
    
    const avgResolutionTime = this.calculateAvgResolutionTime(issues);
    if (avgResolutionTime > 48) { // More than 2 days
      recommendations.push('Average resolution time is high. Consider resource reallocation.');
    }
    
    return recommendations;
  }

  private calculateAvgResolutionTime(issues: CriticalIssue[]): number {
    const resolvedIssues = issues.filter(issue => issue.status === 'resolved' && issue.resolvedAt);
    if (resolvedIssues.length === 0) return 0;
    
    const totalResolutionTime = resolvedIssues.reduce((sum, issue) => {
      return sum + (issue.resolvedAt!.getTime() - issue.createdAt.getTime());
    }, 0);
    
    return totalResolutionTime / resolvedIssues.length;
  }
}
