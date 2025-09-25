export interface CriticalIssue {
  id: string;
  title: string;
  description?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  projectContext?: Record<string, any>;
  technicalDebtScore?: number;
  patternHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TechnicalDebt {
  id: string;
  issueId: string;
  score: number;
  componentsAffected: string[];
  estimatedResolutionTime: number; // in hours
  costImpact: number; // monetary impact
  createdAt: Date;
  updatedAt: Date;
}

export interface IssuePattern {
  id: string;
  hash: string;
  pattern: string;
  description: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCriticalIssueInput {
  title: string;
  description?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  projectContext?: Record<string, any>;
  technicalDebtScore?: number;
  patternHash?: string;
}

export interface UpdateCriticalIssueInput {
  title?: string;
  description?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  status?: 'open' | 'in_progress' | 'resolved' | 'closed';
  projectContext?: Record<string, any>;
  technicalDebtScore?: number;
  patternHash?: string;
}