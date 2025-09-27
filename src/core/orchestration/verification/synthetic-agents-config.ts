/**
 * Synthetic Verification Agents Configuration
 * DevFlow Production DAIC System - Verification Agent Defaults
 */

export interface SyntheticAgentConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
}

export interface VerificationSystemConfig {
  enabled: boolean;
  checkInterval: number;
  inactivityThreshold: number;
}

export const syntheticAgentsConfig = {
  architectureAgent: {
    model: 'hf:Qwen/Qwen3-Coder-480B-A35B-Instruct',
    temperature: 0.1,
    maxTokens: 2048,
    timeout: 45000
  },
  qualityAgent: {
    model: 'hf:Qwen/Qwen2.5-Coder-32B-Instruct',
    temperature: 0.2,
    maxTokens: 1536,
    timeout: 35000
  },
  logicAgent: {
    model: 'hf:deepseek-ai/DeepSeek-V3.1',
    temperature: 0.1,
    maxTokens: 2048,
    timeout: 40000
  },
  integrationAgent: {
    model: 'hf:zai-org/GLM-4.5',
    temperature: 0.3,
    maxTokens: 1024,
    timeout: 20000
  }
} as const;

export const verificationSystemDefaults: VerificationSystemConfig = {
  enabled: true,
  checkInterval: 10000,
  inactivityThreshold: 300000
};

export const SYNTHETIC_VERIFICATION_CONFIG = {
  ...syntheticAgentsConfig,
  system: verificationSystemDefaults
} as const;