// Predictive Cost Model Implementation

import { CostDataPoint, CostPrediction, ModelPerformance, CostModelConfig, RoutingDecision } from './types';
import { normalizeFeatures, LinearRegression, calculatePerformance, calculatePlatformCost } from './utils';

export class PredictiveCostModel {
  private historicalData: CostDataPoint[] = [];
  private models: Map<'claude' | 'codex' | 'synthetic', LinearRegression> = new Map();
  private performance: Map<'claude' | 'codex' | 'synthetic', ModelPerformance> = new Map();
  private config: CostModelConfig;
  private isTraining: boolean = false;
  
  constructor(config?: Partial<CostModelConfig>) {
    this.config = {
      learningRate: config?.learningRate ?? 0.01,
      trainingInterval: config?.trainingInterval ?? 3600000, // 1 hour
      historyLimit: config?.historyLimit ?? 10000,
      minTrainingSamples: config?.minTrainingSamples ?? 50
    };
    
    // Initialize models
    this.models.set('claude', new LinearRegression());
    this.models.set('codex', new LinearRegression());
    this.models.set('synthetic', new LinearRegression());
    
    // Start periodic training
    this.startPeriodicTraining();
  }
  
  /**
   * Add new cost data point
   */
  public addDataPoint(data: CostDataPoint): void {
    this.historicalData.push(data);
    
    // Maintain history limit
    if (this.historicalData.length > this.config.historyLimit) {
      this.historicalData = this.historicalData.slice(-this.config.historyLimit);
    }
    
    // Trigger training if we have enough data
    if (this.historicalData.length % 10 === 0 && 
        this.historicalData.length >= this.config.minTrainingSamples) {
      this.trainModels();
    }
  }
  
  /**
   * Predict costs for all platforms
   */
  public predictCosts(complexity: number, tokensEstimate: number, executionTimeEstimate: number): CostPrediction[] {
    // Create normalized feature vector
    const features = [
      (executionTimeEstimate - this.getExecutionTimeStats().min) / 
      (this.getExecutionTimeStats().max - this.getExecutionTimeStats().min || 1),
      (complexity - 1) / 9, // Normalize complexity 1-10 to 0-1
      (tokensEstimate - this.getTokenStats().min) / 
      (this.getTokenStats().max - this.getTokenStats().min || 1)
    ];
    
    const predictions: CostPrediction[] = [];
    
    for (const [platform, model] of this.models.entries()) {
      try {
        const predictedCost = model.predict([features])[0];
        
        // Calculate confidence based on model performance
        const perf = this.performance.get(platform);
        const confidence = perf ? 1 - (perf.mae / (predictedCost || 1)) : 0.5;
        
        predictions.push({
          platform,
          predictedCost: Math.max(0, predictedCost),
          confidence: Math.min(1, Math.max(0, confidence)),
          executionTimeEstimate
        });
      } catch (error) {
        // Fallback to simple calculation if model fails
        const cost = calculatePlatformCost(platform, tokensEstimate, executionTimeEstimate);
        predictions.push({
          platform,
          predictedCost: cost,
          confidence: 0.3,
          executionTimeEstimate
        });
      }
    }
    
    return predictions;
  }
  
  /**
   * Make routing decision based on cost predictions
   */
  public makeRoutingDecision(
    complexity: number,
    tokensEstimate: number,
    executionTimeEstimate: number
  ): RoutingDecision {
    const predictions = this.predictCosts(complexity, tokensEstimate, executionTimeEstimate);
    
    // Sort by predicted cost (ascending)
    predictions.sort((a, b) => a.predictedCost - b.predictedCost);
    
    const best = predictions[0];
    const defaultPlatform = 'synthetic'; // Default to synthetic
    const defaultPrediction = predictions.find(p => p.platform === defaultPlatform) || 
                            predictions.find(p => p.platform === 'claude') || 
                            best;
    
    const costSavings = defaultPrediction ? 
      defaultPrediction.predictedCost - best.predictedCost : 0;
    
    let reason = `Selected ${best.platform} for lowest predicted cost`;
    if (best.confidence < 0.7) {
      reason += ` (low confidence: ${(best.confidence * 100).toFixed(1)}%)`;
    }
    
    return {
      selectedPlatform: best.platform,
      costSavings: Math.max(0, costSavings),
      reason
    };
  }
  
  /**
   * Train models with historical data
   */
  public async trainModels(): Promise<void> {
    if (this.isTraining || this.historicalData.length < this.config.minTrainingSamples) {
      return;
    }
    
    this.isTraining = true;
    
    try {
      // Group data by platform
      const platformData = new Map<'claude' | 'codex' | 'synthetic', CostDataPoint[]>();
      
      for (const data of this.historicalData) {
        if (!platformData.has(data.platform)) {
          platformData.set(data.platform, []);
        }
        platformData.get(data.platform)?.push(data);
      }
      
      // Train each model
      for (const [platform, data] of platformData.entries()) {
        if (data.length < 10) continue; // Need minimum data
        
        const model = this.models.get(platform);
        if (!model) continue;
        
        // Prepare training data
        const features = normalizeFeatures(data);
        const labels = data.map(d => d.cost);
        
        // Train model
        model.fit(features, labels, this.config.learningRate, 500);
        
        // Calculate performance
        const predictions = model.predict(features);
        const perf = calculatePerformance(
          predictions.map((p, i) => ({
            platform,
            predictedCost: p,
            confidence: 1,
            executionTimeEstimate: data[i].executionTime
          })),
          labels
        );
        
        this.performance.set(platform, {
          accuracy: perf.accuracy,
          mae: perf.mae,
          rmse: perf.rmse,
          lastUpdated: Date.now()
        });
      }
    } catch (error) {
      console.error('Error training cost models:', error);
    } finally {
      this.isTraining = false;
    }
  }
  
  /**
   * Start periodic model training
   */
  private startPeriodicTraining(): void {
    setInterval(() => {
      if (this.historicalData.length >= this.config.minTrainingSamples) {
        this.trainModels();
      }
    }, this.config.trainingInterval);
  }
  
  /**
   * Get execution time statistics
   */
  private getExecutionTimeStats(): { min: number; max: number } {
    if (this.historicalData.length === 0) {
      return { min: 0, max: 1000 };
    }
    
    const times = this.historicalData.map(d => d.executionTime);
    return {
      min: Math.min(...times),
      max: Math.max(...times)
    };
  }
  
  /**
   * Get token statistics
   */
  private getTokenStats(): { min: number; max: number } {
    if (this.historicalData.length === 0) {
      return { min: 0, max: 1000 };
    }
    
    const tokens = this.historicalData.map(d => d.tokensUsed);
    return {
      min: Math.min(...tokens),
      max: Math.max(...tokens)
    };
  }
  
  /**
   * Get model performance metrics
   */
  public getPerformance(): Map<'claude' | 'codex' | 'synthetic', ModelPerformance> {
    return new Map(this.performance);
  }
  
  /**
   * Get historical data size
   */
  public getDataSize(): number {
    return this.historicalData.length;
  }
}

// Export singleton instance
export const costModel = new PredictiveCostModel();