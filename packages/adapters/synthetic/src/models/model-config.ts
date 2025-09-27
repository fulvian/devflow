import { ModelCapabilities, ModelConfig } from '@shared/types/model';

export interface SyntheticModelConfig extends ModelConfig {
  specialization?: 'strategic_analyst' | 'autonomous_coding' | 'enterprise_workflow' | 'agentic_hybrid';
}

export const SYNTHETIC_MODEL_CONFIGS: Record<string, SyntheticModelConfig> = {
  'hf:deepseek-ai/DeepSeek-V3.1': {
    id: 'hf:deepseek-ai/DeepSeek-V3.1',
    name: 'DeepSeek-V3.1',
    provider: 'huggingface',
    capabilities: ['text-generation', 'analysis', 'reasoning'],
    contextLimit: 128000,
    specialization: 'strategic_analyst'
  },
  'hf:Qwen/Qwen3-Coder-480B-A35B-Instruct': {
    id: 'hf:Qwen/Qwen3-Coder-480B-A35B-Instruct',
    name: 'Qwen3-Coder',
    provider: 'huggingface',
    capabilities: ['code-generation', 'code-review', 'debugging'],
    contextLimit: 32768,
    specialization: 'autonomous_coding'
  },
  'hf:moonshotai/Kimi-K2-Instruct-0905': {
    id: 'hf:moonshotai/Kimi-K2-Instruct-0905',
    name: 'Kimi-K2',
    provider: 'huggingface',
    capabilities: ['enterprise-workflow', 'process-optimization', 'business-analysis'],
    contextLimit: 65536,
    specialization: 'enterprise_workflow'
  },
  'hf:zai-org/GLM-4.5': {
    id: 'hf:zai-org/GLM-4.5',
    name: 'GLM-4.5',
    provider: 'huggingface',
    capabilities: ['multi-agent-coordination', 'hybrid-reasoning', 'task-planning'],
    contextLimit: 98304,
    specialization: 'agentic_hybrid'
  }
};

export const DEFAULT_SYNTHETIC_MODELS: Record<string, string> = {
  strategic_analyst: 'hf:deepseek-ai/DeepSeek-V3.1',
  autonomous_coder: 'hf:Qwen/Qwen3-Coder-480B-A35B-Instruct',
  enterprise_workflow: 'hf:moonshotai/Kimi-K2-Instruct-0905',
  agentic_hybrid: 'hf:zai-org/GLM-4.5'
};
