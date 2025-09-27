import { Pool } from 'pg';
import { CriticalIssuesRepository } from './repository';
import { CriticalIssue, CreateCriticalIssueInput, UpdateCriticalIssueInput } from './types';

export class CriticalIssuesService {
  private repository: CriticalIssuesRepository;

  constructor(db: Pool) {
    this.repository = new CriticalIssuesRepository(db);
  }

  async createIssue(input: CreateCriticalIssueInput): Promise<CriticalIssue> {
    // Validate input
    if (!input.title) {
      throw new Error('Title is required');
    }
    
    if (!input.severity) {
      throw new Error('Severity is required');
    }
    
    if (!input.category) {
      throw new Error('Category is required');
    }
    
    // Validate technical debt score if provided
    if (input.technicalDebtScore !== undefined && 
        (input.technicalDebtScore < 0 || input.technicalDebtScore > 100)) {
      throw new Error('Technical debt score must be between 0 and 100');
    }
    
    return await this.repository.create(input);
  }

  async getIssueById(id: string): Promise<CriticalIssue | null> {
    if (!id) {
      throw new Error('Issue ID is required');
    }
    
    return await this.repository.findById(id);
  }

  async getAllIssues(filters?: {
    severity?: string;
    status?: string;
    category?: string;
    projectId?: string;
  }): Promise<CriticalIssue[]> {
    return await this.repository.findAll(filters);
  }

  async updateIssue(id: string, updates: UpdateCriticalIssueInput): Promise<CriticalIssue | null> {
    if (!id) {
      throw new Error('Issue ID is required');
    }
    
    // Validate technical debt score if provided
    if (updates.technicalDebtScore !== undefined && 
        (updates.technicalDebtScore < 0 || updates.technicalDebtScore > 100)) {
      throw new Error('Technical debt score must be between 0 and 100');
    }
    
    return await this.repository.update(id, updates);
  }

  async deleteIssue(id: string): Promise<boolean> {
    if (!id) {
      throw new Error('Issue ID is required');
    }
    
    return await this.repository.delete(id);
  }

  // Placeholder for Cometa Brain integration
  async analyzeWithCometaBrain(issue: CriticalIssue): Promise<any> {
    // This would integrate with the Cometa Brain service
    // For now, we'll just return a placeholder
    console.log(`Analyzing issue ${issue.id} with Cometa Brain`);
    
    // In a real implementation, this would:
    // 1. Send issue data to Cometa Brain API
    // 2. Receive analysis results
    // 3. Process and return insights
    
    return {
      issueId: issue.id,
      analysisTimestamp: new Date(),
      recommendations: [
        'Review related code patterns',
        'Check for similar issues in codebase',
        'Consider refactoring affected components'
      ],
      riskScore: Math.floor(Math.random() * 100), // Placeholder
      predictedResolutionTime: Math.floor(Math.random() * 20) // Placeholder in hours
    };
  }

  async getIssueStatistics(): Promise<any> {
    // Return statistics about critical issues
    const issues = await this.repository.findAll();
    
    const stats = {
      total: issues.length,
      bySeverity: {
        critical: issues.filter(i => i.severity === 'critical').length,
        high: issues.filter(i => i.severity === 'high').length,
        medium: issues.filter(i => i.severity === 'medium').length,
        low: issues.filter(i => i.severity === 'low').length
      },
      byStatus: {
        open: issues.filter(i => i.status === 'open').length,
        in_progress: issues.filter(i => i.status === 'in_progress').length,
        resolved: issues.filter(i => i.status === 'resolved').length,
        closed: issues.filter(i => i.status === 'closed').length
      },
      byCategory: {} as Record<string, number>
    };
    
    // Calculate category statistics
    issues.forEach(issue => {
      if (!stats.byCategory[issue.category]) {
        stats.byCategory[issue.category] = 0;
      }
      stats.byCategory[issue.category]++;
    });
    
    return stats;
  }
}