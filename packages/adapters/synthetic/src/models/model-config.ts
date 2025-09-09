export interface SyntheticModelSpec {
  readonly id: string;
  readonly provider: 'synthetic';
  readonly displayName: string;
  readonly contextLimit: number;
  readonly capabilities: ReadonlyArray<string>;
  readonly specialty: 'code' | 'reasoning' | 'context' | 'general';
  readonly costPerMonth: number; // Flat fee model
}

export const SYNTHETIC_MODELS: ReadonlyArray<SyntheticModelSpec> = [
  // Code Specialists
  {
    id: 'hf:Qwen/Qwen2.5-Coder-32B-Instruct',
    provider: 'synthetic',
    displayName: 'Qwen 2.5 Coder 32B',
    contextLimit: 32768,
    capabilities: ['code', 'implementation', 'refactoring'],
    specialty: 'code',
    costPerMonth: 20, // $20/month flat
  },
  {
    id: 'hf:deepseek-ai/DeepSeek-Coder-V2-Instruct',
    provider: 'synthetic',
    displayName: 'DeepSeek Coder V2',
    contextLimit: 163840,
    capabilities: ['code', 'implementation', 'debugging'],
    specialty: 'code',
    costPerMonth: 20,
  },
  // Reasoning Specialists  
  {
    id: 'hf:deepseek-ai/DeepSeek-V3',
    provider: 'synthetic',
    displayName: 'DeepSeek V3',
    contextLimit: 65536,
    capabilities: ['reasoning', 'analysis', 'problem_solving'],
    specialty: 'reasoning',
    costPerMonth: 20,
  },
  {
    id: 'hf:meta-llama/Llama-3.1-405B-Instruct',
    provider: 'synthetic',
    displayName: 'Llama 3.1 405B',
    contextLimit: 131072,
    capabilities: ['reasoning', 'creative', 'analysis'],
    specialty: 'reasoning',
    costPerMonth: 20,
  },
  // Large Context Specialists
  {
    id: 'hf:Qwen/Qwen2.5-72B-Instruct',
    provider: 'synthetic',
    displayName: 'Qwen 2.5 72B',
    contextLimit: 524288, // 512K context
    capabilities: ['large_context', 'analysis', 'documentation'],
    specialty: 'context',
    costPerMonth: 20,
  },
  // General Purpose
  {
    id: 'hf:meta-llama/Llama-3.1-70B-Instruct',
    provider: 'synthetic',
    displayName: 'Llama 3.1 70B',
    contextLimit: 131072,
    capabilities: ['general', 'chat', 'assistance'],
    specialty: 'general',
    costPerMonth: 20,
  },
];

export const DEFAULT_SYNTHETIC_MODELS = {
  code: 'hf:Qwen/Qwen2.5-Coder-32B-Instruct',
  reasoning: 'hf:deepseek-ai/DeepSeek-V3', 
  context: 'hf:Qwen/Qwen2.5-72B-Instruct',
  general: 'hf:meta-llama/Llama-3.1-70B-Instruct',
};

export function findSyntheticModel(modelId: string): SyntheticModelSpec | undefined {
  return SYNTHETIC_MODELS.find(m => m.id === modelId);
}

export function getModelsBySpecialty(specialty: SyntheticModelSpec['specialty']): ReadonlyArray<SyntheticModelSpec> {
  return SYNTHETIC_MODELS.filter(m => m.specialty === specialty);
}