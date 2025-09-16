/**
 * Task Types - Core type definitions for the orchestration system
 */

// Agent types
export enum AgentType {
  SONNET = 'sonnet',
  CODEX = 'codex',
  GEMINI = 'gemini',
  SYNTHETIC = 'synthetic'
}

// Task complexity levels
export enum TaskComplexity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

// Task request interface
export interface TaskRequest {
  id: string;
  content: string;
  type: string;
  priority?: number;
  context?: any;
}

// Task response interface
export interface TaskResponse {
  id: string;
  content: string;
  confidence: number;
  agent: AgentType;
}

// Task context interface
export interface TaskContext {
  originalTask: TaskRequest;
  executionHistory: Array<{
    agent: AgentType;
    timestamp: number;
    task: TaskRequest;
  }>;
  handoffCount: number;
  preservedState: Map<string, any>;
}