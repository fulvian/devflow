export interface CriticalIssue {
  id: string;
  type: string; // 'security' | 'performance' | 'technical_debt'
  file: string;
  line: number;
  content: string;
  pattern: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
  resolved: boolean;
}

export interface CriticalIssueCreateDto {
  type: string;
  file: string;
  line: number;
  content: string;
  pattern: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
  resolved?: boolean;
}

export interface CriticalIssueUpdateDto {
  resolved?: boolean;
}
