import { CriticalIssue } from '../../types/critical-issues';
import { ValidationResults } from './context7-validator';

export interface DashboardMetrics {
  totalIssues: number;
  resolvedIssues: number;
  openIssues: number;
  criticalIssues: number;
  highPriorityIssues: number;
  avgResolutionTime: number;
  resolutionRate: number;
  teamEfficiency: number;
}

export interface TrendDataPoint {
  date: string;
  count: number;
  resolved: number;
  critical: number;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  prioritizedIssues: CriticalIssue[];
  trendData: TrendDataPoint[];
  validationResults: ValidationResults;
  lastUpdated: Date;
}
