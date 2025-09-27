// Cost Prediction Utilities

import { CostDataPoint, CostPrediction } from './types';

/**
 * Normalize features for ML model
 */
export function normalizeFeatures(data: CostDataPoint[]): number[][] {
  if (data.length === 0) return [];
  
  // Extract feature values
  const executionTimes = data.map(d => d.executionTime);
  const complexities = data.map(d => d.complexity);
  const tokensUsed = data.map(d => d.tokensUsed);
  
  // Calculate min/max for normalization
  const execTimeMin = Math.min(...executionTimes);
  const execTimeMax = Math.max(...executionTimes);
  const complexityMin = Math.min(...complexities);
  const complexityMax = Math.max(...complexities);
  const tokensMin = Math.min(...tokensUsed);
  const tokensMax = Math.max(...tokensUsed);
  
  // Normalize features to 0-1 range
  return data.map(d => [
    (d.executionTime - execTimeMin) / (execTimeMax - execTimeMin || 1),
    (d.complexity - complexityMin) / (complexityMax - complexityMin || 1),
    (d.tokensUsed - tokensMin) / (tokensMax - tokensMin || 1)
  ]);
}

/**
 * Calculate performance metrics
 */
export function calculatePerformance(
  predictions: CostPrediction[],
  actuals: number[]
): { mae: number; rmse: number; accuracy: number } {
  if (predictions.length === 0 || predictions.length !== actuals.length) {
    return { mae: 0, rmse: 0, accuracy: 0 };
  }
  
  let absoluteErrorSum = 0;
  let squaredErrorSum = 0;
  let correctPredictions = 0;
  
  predictions.forEach((pred, index) => {
    const actual = actuals[index];
    const error = Math.abs(pred.predictedCost - actual);
    absoluteErrorSum += error;
    squaredErrorSum += error * error;
    
    // Accuracy within 10% considered correct
    if (error / actual <= 0.1) {
      correctPredictions++;
    }
  });
  
  const mae = absoluteErrorSum / predictions.length;
  const rmse = Math.sqrt(squaredErrorSum / predictions.length);
  const accuracy = correctPredictions / predictions.length;
  
  return { mae, rmse, accuracy };
}

/**
 * Simple linear regression implementation
 */
export class LinearRegression {
  private weights: number[] = [];
  private bias: number = 0;
  
  public fit(features: number[][], labels: number[], learningRate: number = 0.01, iterations: number = 1000): void {
    const n = features.length;
    const m = features[0].length;
    
    // Initialize weights
    this.weights = Array(m).fill(0);
    this.bias = 0;
    
    // Gradient descent
    for (let i = 0; i < iterations; i++) {
      let predictions = features.map(f => this.predictSingle(f));
      
      // Calculate gradients
      let dw = Array(m).fill(0);
      let db = 0;
      
      for (let j = 0; j < n; j++) {
        const error = predictions[j] - labels[j];
        db += error;
        
        for (let k = 0; k < m; k++) {
          dw[k] += error * features[j][k];
        }
      }
      
      // Update weights
      for (let k = 0; k < m; k++) {
        this.weights[k] -= learningRate * dw[k] / n;
      }
      this.bias -= learningRate * db / n;
    }
  }
  
  public predict(features: number[][]): number[] {
    return features.map(f => this.predictSingle(f));
  }
  
  private predictSingle(feature: number[]): number {
    let result = this.bias;
    for (let i = 0; i < feature.length; i++) {
      result += this.weights[i] * feature[i];
    }
    return Math.max(0, result); // Ensure non-negative cost
  }
  
  public getWeights(): number[] {
    return [...this.weights];
  }
  
  public getBias(): number {
    return this.bias;
  }
}

/**
 * Calculate cost based on platform pricing
 */
export function calculatePlatformCost(
  platform: 'claude' | 'codex' | 'synthetic',
  tokens: number,
  executionTime: number
): number {
  // Simplified pricing model (in USD)
  switch (platform) {
    case 'claude':
      return tokens * 0.000015 + executionTime * 0.000001;
    case 'codex':
      return tokens * 0.000030 + executionTime * 0.000002;
    case 'synthetic':
      return tokens * 0.000005 + executionTime * 0.0000005;
    default:
      return 0;
  }
}