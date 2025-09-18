import { EventEmitter } from 'events';
import { ModelStatus } from './statusline-types';

interface TrackedModel {
  id: string;
  name: string;
  tokensUsed: number;
  lastActive: number;
  agent?: string;
}

interface TokenUsageRecord {
  modelId: string;
  tokens: number;
  timestamp: number;
}

export class ModelTracker extends EventEmitter {
  private trackedModels: Map<string, TrackedModel> = new Map();
  private activeModelId: string | null = null;
  private tokenUsageHistory: TokenUsageRecord[] = [];
  private sessionStartTime: number = Date.now();
  private totalTokensUsed: number = 0;

  constructor() {
    super();
  }

  public initialize(): void {
    console.log('Model Tracker initialized');
    // In a real implementation, this might connect to model orchestration services
  }

  public registerModel(modelId: string, modelName: string, agent?: string): void {
    const model: TrackedModel = {
      id: modelId,
      name: modelName,
      tokensUsed: 0,
      lastActive: Date.now(),
      agent
    };
    
    this.trackedModels.set(modelId, model);
    console.log(`Registered model: ${modelName} (${modelId})`);
  }

  public setActiveModel(modelId: string): void {
    if (!this.trackedModels.has(modelId)) {
      console.warn(`Attempted to set unregistered model as active: ${modelId}`);
      return;
    }
    
    this.activeModelId = modelId;
    const model = this.trackedModels.get(modelId);
    if (model) {
      model.lastActive = Date.now();
    }
    
    this.emit('modelUpdate');
  }

  public recordTokenUsage(modelId: string, tokens: number): void {
    if (!this.trackedModels.has(modelId)) {
      console.warn(`Attempted to record tokens for unregistered model: ${modelId}`);
      return;
    }
    
    const model = this.trackedModels.get(modelId);
    if (model) {
      model.tokensUsed += tokens;
      model.lastActive = Date.now();
      this.totalTokensUsed += tokens;
      
      // Record in history
      this.tokenUsageHistory.push({
        modelId,
        tokens,
        timestamp: Date.now()
      });
      
      // Keep only last 100 records
      if (this.tokenUsageHistory.length > 100) {
        this.tokenUsageHistory.shift();
      }
      
      this.emit('modelUpdate');
    }
  }

  public assignAgentToModel(modelId: string, agent: string): void {
    const model = this.trackedModels.get(modelId);
    if (model) {
      model.agent = agent;
      this.emit('modelUpdate');
    }
  }

  public getStatus(): ModelStatus {
    const activeModel = this.activeModelId ? this.trackedModels.get(this.activeModelId) : null;
    
    return {
      activeModel: activeModel ? activeModel.name : '',
      activeAgent: activeModel?.agent || '',
      tokenUsage: this.totalTokensUsed,
      estimatedCost: this.calculateEstimatedCost()
    };
  }

  private calculateEstimatedCost(): number {
    // Simplified cost calculation
    // In a real implementation, this would use actual pricing from model providers
    const COST_PER_MILLION_TOKENS = 0.01; // $0.01 per million tokens as example
    return (this.totalTokensUsed / 1000000) * COST_PER_MILLION_TOKENS;
  }

  public getSessionDuration(): number {
    return Date.now() - this.sessionStartTime;
  }

  public getMostActiveModel(): string | null {
    let mostActive: TrackedModel | null = null;
    
    for (const model of this.trackedModels.values()) {
      if (!mostActive || model.lastActive > mostActive.lastActive) {
        mostActive = model;
      }
    }
    
    return mostActive ? mostActive.name : null;
  }

  public resetSession(): void {
    this.sessionStartTime = Date.now();
    this.totalTokensUsed = 0;
    this.tokenUsageHistory = [];
    
    // Reset model usage
    for (const model of this.trackedModels.values()) {
      model.tokensUsed = 0;
      model.lastActive = Date.now();
    }
    
    this.emit('modelUpdate');
  }
}
