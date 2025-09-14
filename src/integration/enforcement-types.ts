export interface EnforcementRule {
  id: string;
  name: string;
  description: string;
  requiresDAICMode?: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  validator: (context: any) => Promise<boolean>;
}

export interface ViolationReport {
  ruleId: string;
  ruleName: string;
  description: string;
  context: any;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export enum EnforcementAction {
  NONE = 'none',
  WARN = 'warn', 
  DELEGATE = 'delegate',
  BLOCK = 'block'
}