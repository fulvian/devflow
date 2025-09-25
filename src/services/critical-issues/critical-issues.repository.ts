import { CriticalIssue, CriticalIssueCreateDto, CriticalIssueUpdateDto } from './critical-issues.types';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../utils/logger';

// In-memory storage for demo purposes
// In a real implementation, this would connect to a database
let issues: CriticalIssue[] = [];

export class CriticalIssuesRepository {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('CriticalIssuesRepository');
  }

  async create(issueData: CriticalIssueCreateDto): Promise<CriticalIssue> {
    const issue: CriticalIssue = {
      id: uuidv4(),
      ...issueData,
      resolved: issueData.resolved || false
    };

    issues.push(issue);
    this.logger.debug(`Created issue ${issue.id}`);
    return issue;
  }

  async find(filters?: { type?: string; severity?: string; resolved?: boolean }): Promise<CriticalIssue[]> {
    let result = [...issues];

    if (filters) {
      if (filters.type) {
        result = result.filter(issue => issue.type === filters.type);
      }
      if (filters.severity) {
        result = result.filter(issue => issue.severity === filters.severity);
      }
      if (filters.resolved !== undefined) {
        result = result.filter(issue => issue.resolved === filters.resolved);
      }
    }

    this.logger.debug(`Found ${result.length} issues`);
    return result;
  }

  async findById(id: string): Promise<CriticalIssue | null> {
    const issue = issues.find(issue => issue.id === id);
    return issue || null;
  }

  async update(id: string, updates: CriticalIssueUpdateDto): Promise<boolean> {
    const index = issues.findIndex(issue => issue.id === id);
    
    if (index === -1) {
      return false;
    }

    issues[index] = { ...issues[index], ...updates };
    this.logger.debug(`Updated issue ${id}`);
    return true;
  }

  async delete(id: string): Promise<boolean> {
    const initialLength = issues.length;
    issues = issues.filter(issue => issue.id !== id);
    
    if (issues.length < initialLength) {
      this.logger.debug(`Deleted issue ${id}`);
      return true;
    }
    
    return false;
  }

  // For testing purposes
  async clear(): Promise<void> {
    issues = [];
  }

  async getAll(): Promise<CriticalIssue[]> {
    return [...issues];
  }
}
