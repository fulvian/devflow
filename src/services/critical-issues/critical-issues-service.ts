import { CriticalIssue, CriticalIssueCreateDto } from './critical-issues.types';
import { CriticalIssuesRepository } from './critical-issues.repository';
import { Logger } from '../../utils/logger';

export class CriticalIssuesService {
  private repository: CriticalIssuesRepository;
  private logger: Logger;

  constructor() {
    this.repository = new CriticalIssuesRepository();
    this.logger = new Logger('CriticalIssuesService');
  }

  async createIssue(issueData: any): Promise<CriticalIssue | null> {
    try {
      // Transform Python issue data to TypeScript format
      const transformedIssue: CriticalIssueCreateDto = {
        type: issueData.type,
        file: issueData.file,
        line: issueData.line || 0,
        content: issueData.content || '',
        pattern: issueData.pattern || '',
        severity: issueData.severity || 'medium',
        timestamp: new Date().toISOString(),
        resolved: false
      };

      const issue = await this.repository.create(transformedIssue);
      this.logger.info(`Created critical issue: ${issue.id}`);
      return issue;
    } catch (error) {
      this.logger.error('Failed to create critical issue', error);
      return null;
    }
  }

  async getIssues(filters?: { type?: string; severity?: string; resolved?: boolean }): Promise<CriticalIssue[]> {
    try {
      return await this.repository.find(filters);
    } catch (error) {
      this.logger.error('Failed to fetch critical issues', error);
      return [];
    }
  }

  async getIssueById(id: string): Promise<CriticalIssue | null> {
    try {
      return await this.repository.findById(id);
    } catch (error) {
      this.logger.error(`Failed to fetch critical issue ${id}`, error);
      return null;
    }
  }

  async markAsResolved(id: string): Promise<boolean> {
    try {
      const updated = await this.repository.update(id, { resolved: true });
      if (updated) {
        this.logger.info(`Marked critical issue ${id} as resolved`);
      }
      return updated;
    } catch (error) {
      this.logger.error(`Failed to resolve critical issue ${id}`, error);
      return false;
    }
  }

  async getIssueStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    unresolved: number;
  }> {
    try {
      const issues = await this.repository.find({});
      
      const stats = {
        total: issues.length,
        byType: {} as Record<string, number>,
        bySeverity: {} as Record<string, number>,
        unresolved: issues.filter(i => !i.resolved).length
      };

      issues.forEach(issue => {
        stats.byType[issue.type] = (stats.byType[issue.type] || 0) + 1;
        stats.bySeverity[issue.severity] = (stats.bySeverity[issue.severity] || 0) + 1;
      });

      return stats;
    } catch (error) {
      this.logger.error('Failed to fetch issue stats', error);
      return {
        total: 0,
        byType: {},
        bySeverity: {},
        unresolved: 0
      };
    }
  }
}
