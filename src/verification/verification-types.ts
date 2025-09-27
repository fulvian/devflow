export interface FileScanResult {
  filePath: string;
  fullPath: string;
  lineCount: number;
  content: string;
  lines: string[];
}

export interface Violation {
  type: 'devflow-rule' | 'code-quality' | 'bug';
  rule: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  filePath: string;
  line: number;
  message: string;
  suggestion: string;
}

export interface VerificationResult {
  taskId: string | null;
  timestamp: string;
  passed: boolean;
  violations: Violation[];
  summary: {
    totalFiles: number;
    totalViolations: number;
    criticalViolations: number;
    highViolations: number;
    mediumViolations: number;
    lowViolations: number;
  };
}
