/**
 * Codex MCP Server - Core Types and Interfaces
 */

export interface MCPRequest {
  method: string;
  params: any;
  id: string;
}

export interface MCPResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
  };
  id: string;
}

export interface CodexQuery {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface CodexResponse {
  completion: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}