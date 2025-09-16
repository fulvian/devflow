/**
 * DevFlow Types - Core type definitions for the orchestration system
 */

// Agent types
export enum Agent {
  Sonnet = 'sonnet',
  Codex = 'codex',
  Gemini = 'gemini',
  Synthetic = 'synthetic'
}

// Task types
export enum TaskType {
  ARCHITECTURE = 'architecture',
  TECH_LEAD = 'tech_lead',
  SYSTEM_DESIGN = 'system_design',
  CODE_GENERATION = 'code_generation',
  CODE_REVIEW = 'code_review',
  DEBUG = 'debug',
  TEST = 'test',
  BASH = 'bash'
}

// Agent capabilities
export enum AgentCapability {
  ARCHITECTURE_DESIGN = 'architecture_design',
  TECH_LEAD_DECISIONS = 'tech_lead_decisions',
  SYSTEM_OPTIMIZATION = 'system_optimization',
  COMPLEX_PROBLEM_SOLVING = 'complex_problem_solving',
  CODE_GENERATION = 'code_generation',
  CODE_REVIEW = 'code_review',
  BUG_FIXING = 'bug_fixing',
  TEST_IMPLEMENTATION = 'test_implementation',
  DOCUMENTATION = 'documentation',
  DEBUGGING = 'debugging',
  SIMPLE_TASKS = 'simple_tasks',
  BASIC_CODING = 'basic_coding',
  TEMPLATE_FILLING = 'template_filling',
  ROUTINE_TASKS = 'routine_tasks',
  SHELL_COMMANDS = 'shell_commands'
}

// Task interface
export interface Task {
  id: string;
  type: TaskType;
  content: string;
  priority?: number;
  metadata?: Record<string, any>;
}

// Classification result
export interface ClassificationResult {
  agent: Agent;
  confidence: number;
  reasoning: string;
  alternativeAgents: Agent[];
}