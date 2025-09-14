export interface Tool {
  name: string;
  execute: (context: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
  operation: string;
  daicMode?: { isActive: boolean };
  delegation?: { isSynthetic: boolean };
  resource?: string;
  user?: any;
  [key: string]: any;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  violations?: any[];
}