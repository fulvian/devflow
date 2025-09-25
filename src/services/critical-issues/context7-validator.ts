import { CriticalIssue } from '../../types/critical-issues';

export interface ValidationResults {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  issueId: string;
  field: string;
  message: string;
}

interface ValidationWarning {
  issueId: string;
  field: string;
  message: string;
}

export class Context7Validator {
  validateIssues(issues: CriticalIssue[]): ValidationResults {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    issues.forEach(issue => {
      // Validate required fields
      if (!issue.id) {
        errors.push({
          issueId: issue.id || 'unknown',
          field: 'id',
          message: 'Issue ID is required'
        });
      }
      
      if (!issue.title) {
        errors.push({
          issueId: issue.id || 'unknown',
          field: 'title',
          message: 'Issue title is required'
        });
      }
      
      if (!issue.description) {
        warnings.push({
          issueId: issue.id || 'unknown',
          field: 'description',
          message: 'Issue description is recommended'
        });
      }
      
      if (!issue.severity) {
        errors.push({
          issueId: issue.id || 'unknown',
          field: 'severity',
          message: 'Issue severity is required'
        });
      } else if (!['low', 'medium', 'high', 'critical'].includes(issue.severity)) {
        errors.push({
          issueId: issue.id || 'unknown',
          field: 'severity',
          message: 'Invalid severity value'
        });
      }
      
      if (!issue.priority) {
        errors.push({
          issueId: issue.id || 'unknown',
          field: 'priority',
          message: 'Issue priority is required'
        });
      } else if (!['low', 'medium', 'high', 'critical'].includes(issue.priority)) {
        errors.push({
          issueId: issue.id || 'unknown',
          field: 'priority',
          message: 'Invalid priority value'
        });
      }
      
      if (!issue.status) {
        errors.push({
          issueId: issue.id || 'unknown',
          field: 'status',
          message: 'Issue status is required'
        });
      } else if (!['open', 'in-progress', 'resolved', 'closed'].includes(issue.status)) {
        errors.push({
          issueId: issue.id || 'unknown',
          field: 'status',
          message: 'Invalid status value'
        });
      }
      
      if (!issue.createdAt) {
        errors.push({
          issueId: issue.id || 'unknown',
          field: 'createdAt',
          message: 'Creation date is required'
        });
      }
      
      // Context7 specific validations
      if (issue.severity === 'critical' && issue.priority !== 'critical') {
        warnings.push({
          issueId: issue.id || 'unknown',
          field: 'priority',
          message: 'Critical severity issues should typically have critical priority'
        });
      }
      
      if (issue.status === 'resolved' && !issue.resolvedAt) {
        errors.push({
          issueId: issue.id || 'unknown',
          field: 'resolvedAt',
          message: 'Resolved issues must have a resolution date'
        });
      }
      
      if (issue.resolvedAt && issue.resolvedAt < issue.createdAt) {
        errors.push({
          issueId: issue.id || 'unknown',
          field: 'resolvedAt',
          message: 'Resolution date cannot be before creation date'
        });
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}
