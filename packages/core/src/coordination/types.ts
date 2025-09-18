export interface AgentContext {
  sessionId: string;
  taskId: string;
  metadata: Record<string, any>;
  timestamp: number;
  agentId: string;
  requestId: string;
}

export enum FallbackStrategy {
  SWITCH_AGENT = 'SWITCH_AGENT',
  RETRY = 'RETRY',
  SYNTHETIC_RESPONSE = 'SYNTHETIC_RESPONSE',
  GEMINI_CLI = 'GEMINI_CLI'
}

export interface FallbackStrategyConfig {
  type: FallbackStrategy;
  targetAgent?: string;
  maxRetries?: number;
  baseDelay?: number;
  responseGenerator?: () => any;
  defaultData?: any;
  command?: string;
}

export interface FallbackChain {
  strategies: FallbackStrategyConfig[];
  context: AgentContext;
  maxRetries: number;
}

export interface StrategyConfig {
  enabled: boolean;
  priority: number;
  timeout?: number;
}

export interface SwitchAgentConfig extends StrategyConfig {
  targetAgents: string[];
  loadBalancing: 'ROUND_ROBIN' | 'RANDOM' | 'LEAST_BUSY';
}

export interface RetryConfig extends StrategyConfig {
  maxAttempts: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface SyntheticResponseConfig extends StrategyConfig {
  template?: string;
  defaultContent: string;
  includeContext: boolean;
}

export interface GeminiCLIConfig extends StrategyConfig {
  commandTemplate: string;
  timeout: number;
  captureOutput: boolean;
}

export interface FallbackError {
  code: string;
  message: string;
  timestamp: number;
  context: AgentContext;
  strategy: FallbackStrategy;
  attempt: number;
}

export interface FallbackMetrics {
  strategy: FallbackStrategy;
  success: boolean;
  duration: number;
  timestamp: number;
  context: AgentContext;
  error?: FallbackError;
}

export interface ContextPreservation {
  originalContext: AgentContext;
  preservedState: Record<string, any>;
  recoveryPoint: string;
  timestamp: number;
}
