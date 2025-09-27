/**
 * Type definitions for CLAUDE.md configuration
 */

export interface CLAUDEConfig {
  version: string;
  rules?: RuleConfig[];
  tools?: ToolConfig[];
  enforcement?: EnforcementConfig;
}

export interface RuleConfig {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  pattern?: string;
  // Add other rule-specific properties as needed
}

export interface ToolConfig {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  // Add other tool-specific properties as needed
}

export interface EnforcementConfig {
  enabled: boolean;
  mode: 'strict' | 'permissive' | 'report-only';
  // Add other enforcement-specific properties as needed
}