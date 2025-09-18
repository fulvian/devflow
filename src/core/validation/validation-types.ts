export enum ProjectType {
  NPM = 'npm',
  YARN = 'yarn',
  PNPM = 'pnpm',
  CARGO = 'cargo',
  MAKE = 'make',
  GRADLE = 'gradle',
  MAVEN = 'maven',
  UNKNOWN = 'unknown'
}

export interface ProjectInfo {
  path: string;
  type: ProjectType;
  name: string;
  config: any;
}

export interface ValidationResult {
  projectPath: string;
  projectType: ProjectType;
  command: string;
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number; // in milliseconds
  timestamp: number;
}

export interface ValidationError {
  projectPath: string;
  error: Error;
  timestamp: number;
}

export interface ValidationRule {
  commands: string[];
  timeout?: number;
  concurrency?: number;
}

export interface ValidationConfig {
  timeout?: number;
  concurrency?: number;
  rules?: Partial<Record<ProjectType, ValidationRule>>;
}

export interface ValidationMetrics {
  projectType: ProjectType;
  avgDuration: number;
  successRate: number;
  totalRuns: number;
}
