// Predictive Cost Modeling Types

export interface CostDataPoint {
  taskId: string;
  platform: 'claude' | 'codex' | 'synthetic';
  executionTime: number; // in milliseconds
  cost: number; // in USD
  tokensUsed: number;
  complexity: number; // 1-10 scale
  timestamp: number;
}

export interface CostPrediction {
  platform: 'claude' | 'codex' | 'synthetic';
  predictedCost: number;
  confidence: number; // 0-1 scale
  executionTimeEstimate: number; // in milliseconds
}

export interface ModelPerformance {
  accuracy: number;
  mae: number; // Mean Absolute Error
  rmse: number; // Root Mean Square Error
  lastUpdated: number;
}

export interface TrainingData {
  features: number[][];
  labels: number[];
}

export interface CostModelConfig {
  learningRate: number;
  trainingInterval: number; // in milliseconds
  historyLimit: number; // max data points to keep
  minTrainingSamples: number;
}

export interface RoutingDecision {
  selectedPlatform: 'claude' | 'codex' | 'synthetic';
  costSavings: number; // compared to default
  reason: string;
}