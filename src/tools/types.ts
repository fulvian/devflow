export interface ToolExecutor {
  (context: ToolContext): Promise<ToolExecutionResult>;
}

export interface ToolContext {
  operation: string;
  daicMode?: { isActive: boolean };
  delegation?: { isSynthetic: boolean };
  resource?: string;
  user?: any;
  [key: string]: any;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: {
    type: string;
    message: string;
    details?: any;
  };
  metadata?: {
    enforcementDelegated?: boolean;
    enforcementWarnings?: any[];
    violations?: any[];
    [key: string]: any;
  };
}