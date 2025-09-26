/**
 * Model types used in ccusage blocks
 */
export type ModelType = 'sonnet-4' | 'gemini-1.5-pro-002' | 'qwen2.5-coder:7b' | 'synthetic' | string;

/**
 * Token classification types
 */
export enum TokenClassification {
  UserPrompt = 'user_prompt',
  UserResponse = 'user_response',
  UserInteraction = 'user_interaction',
  ContextRefresh = 'context_refresh',
  SystemPrompt = 'system_prompt',
  SyntheticAgent = 'synthetic_agent',
  SystemOverhead = 'system_overhead'
}

/**
 * Structure of a ccusage block
 */
export interface CcusageBlock {
  id: string;
  startTime: number;
  endTime: number;
  models: ModelType[];
  totalTokens: number;
  duration: number;
  tokenEntries: Array<{
    model: ModelType;
    inputTokens: number;
    outputTokens: number;
    prompt?: string;
    response?: string;
    timestamp?: number;
  }>;
}

/**
 * Result of token classification
 */
export interface ClassificationResult {
  blockId: string;
  totalTokens: number;
  classifications: Map<TokenClassification, number>;
  userInteractionTokens: number;
  systemOverheadTokens: number;
  modelBreakdown: Map<ModelType, number>;
  duration: number;
}

/**
 * Task token data structure
 */
export interface TaskTokenData {
  taskId: string;
  totalTokens: number;
  sessionTokens: number;
  startTime: Date;
  lastUpdated: Date;
}

/**
 * Task state enumeration
 */
export enum TaskState {
  CREATED = 'created',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed'
}

/**
 * Token history entry
 */
export interface TokenHistoryEntry {
  tokensAdded: number;
  timestamp: Date;
  sessionId: string;
}