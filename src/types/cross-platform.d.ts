/**
 * Cross-Platform AI Coding Hub - Type Definitions
 * DevFlow v3.1 - Universal Interface for 4 AI Coding Platforms
 */

export interface PlatformConfig {
  name: 'claude-code' | 'cursor' | 'codeium' | 'copilot';
  displayName: string;
  apiVersion: string;
  enabled: boolean;
  priority: number;
  capabilities: PlatformCapability[];
  authMethod: 'token' | 'oauth' | 'api-key';
  endpoints: PlatformEndpoints;
}

export interface PlatformCapability {
  feature: 'code-completion' | 'chat' | 'refactoring' | 'debugging' | 'explanation' | 'generation';
  quality: 'high' | 'medium' | 'low';
  latency: 'fast' | 'medium' | 'slow';
  costTier: 'free' | 'paid' | 'premium';
}

export interface PlatformEndpoints {
  completion?: string;
  chat?: string;
  analysis?: string;
  health?: string;
}

export interface UnifiedRequest {
  id: string;
  timestamp: string;
  platform?: string; // Auto-route if not specified
  type: 'completion' | 'chat' | 'analysis' | 'refactor';
  context: RequestContext;
  preferences: UserPreferences;
}

export interface RequestContext {
  language: string;
  framework?: string;
  fileContent?: string;
  selection?: TextSelection;
  projectType?: string;
  dependencies?: string[];
}

export interface TextSelection {
  start: { line: number; character: number };
  end: { line: number; character: number };
  text: string;
}

export interface UserPreferences {
  preferredPlatforms: string[];
  fallbackBehavior: 'cascade' | 'parallel' | 'best-match';
  qualityThreshold: number;
  maxLatency: number;
  costSensitive: boolean;
}

export interface UnifiedResponse {
  id: string;
  platform: string;
  success: boolean;
  data?: any;
  error?: PlatformError;
  metadata: ResponseMetadata;
}

export interface ResponseMetadata {
  latency: number;
  tokens?: TokenUsage;
  quality?: QualityMetrics;
  cached: boolean;
  fallbackUsed: boolean;
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
  cost?: number;
}

export interface QualityMetrics {
  relevance: number;
  accuracy: number;
  completeness: number;
  confidence: number;
}

export interface PlatformError {
  code: string;
  message: string;
  retryable: boolean;
  platform: string;
}

export interface RouteStrategy {
  algorithm: 'round-robin' | 'quality-based' | 'cost-optimized' | 'latency-first';
  parameters: Record<string, any>;
  fallback: string[];
}

export interface CrossPlatformMetrics {
  totalRequests: number;
  platformUsage: Record<string, number>;
  averageLatency: Record<string, number>;
  successRates: Record<string, number>;
  costTracking: Record<string, number>;
  qualityScores: Record<string, QualityMetrics>;
}