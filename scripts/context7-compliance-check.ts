// Context7 compliance check - simplified without external imports
interface CriticalIssue {
  id: string;
  title: string;
  description?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  createdAt: Date;
  resolvedAt?: Date;
  assignedTo?: string;
}

// Sample data for testing
const sampleIssues: CriticalIssue[] = [
  {
    id: 'ISSUE-001',
    title: 'Database connection failure',
    description: 'Unable to connect to primary database',
    severity: 'critical',
    priority: 'critical',
    status: 'open',
    createdAt: new Date('2023-05-15'),
    assignedTo: 'dev-team'
  },
  {
    id: 'ISSUE-002',
    title: 'UI rendering issue',
    description: 'Button alignment incorrect on mobile',
    severity: 'medium',
    priority: 'low',
    status: 'in-progress',
    createdAt: new Date('2023-05-16'),
    assignedTo: 'frontend-team'
  },
  {
    id: 'ISSUE-003',
    title: 'Security vulnerability',
    severity: 'critical',
    priority: 'high', // This should trigger a warning
    status: 'resolved',
    createdAt: new Date('2023-05-10'),
    resolvedAt: new Date('2023-05-12'),
    assignedTo: 'security-team'
  }
];

function validateIssues(issues: CriticalIssue[]) {
  const errors: Array<{ issueId: string; field: string; message: string }> = [];
  const warnings: Array<{ issueId: string; field: string; message: string }> = [];

  issues.forEach(issue => {
    // Check required fields
    if (!issue.id) errors.push({ issueId: issue.id, field: 'id', message: 'ID is required' });
    if (!issue.title) errors.push({ issueId: issue.id, field: 'title', message: 'Title is required' });

    // Check severity/priority alignment
    if (issue.severity === 'critical' && issue.priority !== 'critical') {
      warnings.push({ issueId: issue.id, field: 'priority', message: 'Critical severity should have critical priority' });
    }

    // Check resolved issues have resolvedAt
    if (issue.status === 'resolved' && !issue.resolvedAt) {
      warnings.push({ issueId: issue.id, field: 'resolvedAt', message: 'Resolved issues should have resolvedAt date' });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

function runComplianceCheck() {
  console.log('Running Context7 Compliance Check...');
  console.log('====================================');

  // Simplified validation without external dependencies
  const results = validateIssues(sampleIssues);
  
  console.log(`Compliance Status: ${results.isValid ? 'PASSED' : 'FAILED'}`);
  console.log(`Errors: ${results.errors.length}`);
  console.log(`Warnings: ${results.warnings.length}`);
  
  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach(error => {
      console.log(`  - Issue ${error.issueId}: ${error.field} - ${error.message}`);
    });
  }
  
  if (results.warnings.length > 0) {
    console.log('\nWarnings:');
    results.warnings.forEach(warning => {
      console.log(`  - Issue ${warning.issueId}: ${warning.field} - ${warning.message}`);
    });
  }
  
  console.log('\nCompliance check completed.');
}

// Run the compliance check if this script is executed directly
if (require.main === module) {
  runComplianceCheck();
}

export { runComplianceCheck };
