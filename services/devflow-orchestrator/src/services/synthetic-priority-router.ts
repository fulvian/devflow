/**
 * Synthetic Priority Router
 * DevFlow v3.1 - Synthetic agents as primary coders with CLI fallback
 */

import { PlatformConfig, UnifiedRequest, UnifiedResponse, RouteStrategy } from '../../../../src/types/cross-platform';
import { CrossPlatformRouter } from './cross-platform-router';

export interface SyntheticUsageLimits {
  daily: { used: number; limit: number };
  hourly: { used: number; limit: number };
  costBudget: { used: number; limit: number };
}

export interface PlatformUsageLimits {
  [platform: string]: {
    daily: { used: number; limit: number };
    hourly: { used: number; limit: number };
    costSensitive: boolean;
  };
}

export class SyntheticPriorityRouter {
  private crossPlatformRouter: CrossPlatformRouter;
  private syntheticLimits: SyntheticUsageLimits;
  private platformLimits: PlatformUsageLimits;

  constructor() {
    this.crossPlatformRouter = new CrossPlatformRouter();
    this.initializeLimits();
  }

  private initializeLimits(): void {
    // Synthetic usage limits
    this.syntheticLimits = {
      daily: { used: 0, limit: 1000 },
      hourly: { used: 0, limit: 100 },
      costBudget: { used: 0, limit: 20.0 } // $20 daily budget
    };

    // CLI platform limits (conservative for premium platforms)
    this.platformLimits = {
      'claude-code': {
        daily: { used: 0, limit: 200 }, // Conservative for paid tier
        hourly: { used: 0, limit: 20 },
        costSensitive: true
      },
      'codex': {
        daily: { used: 0, limit: 300 },
        hourly: { used: 0, limit: 30 },
        costSensitive: true
      },
      'gemini': {
        daily: { used: 0, limit: 1000 }, // Free tier generous
        hourly: { used: 0, limit: 60 },
        costSensitive: false
      },
      'qwen': {
        daily: { used: 0, limit: 2000 }, // Free tier very generous
        hourly: { used: 0, limit: 100 },
        costSensitive: false
      }
    };
  }

  public async route(request: UnifiedRequest): Promise<UnifiedResponse> {
    const startTime = Date.now();

    try {
      // 1. Check if Synthetic should handle this request (primary choice)
      if (await this.shouldUseSynthetic(request)) {
        try {
          const syntheticResponse = await this.routeToSynthetic(request);
          this.updateSyntheticUsage(syntheticResponse);
          return syntheticResponse;
        } catch (syntheticError) {
          console.warn('Synthetic routing failed, falling back to CLI:', syntheticError);
        }
      }

      // 2. Fallback to CLI platforms with usage optimization
      const optimizedRequest = this.optimizeForCLI(request);
      const cliResponse = await this.crossPlatformRouter.route(optimizedRequest);
      this.updatePlatformUsage(cliResponse.platform, cliResponse);

      return cliResponse;

    } catch (error) {
      // Last resort: try any available platform
      return await this.handleEmergencyFallback(request, startTime, error);
    }
  }

  private async shouldUseSynthetic(request: UnifiedRequest): Promise<boolean> {
    // Check Synthetic availability and limits
    if (!await this.isSyntheticAvailable()) {
      return false;
    }

    // Check usage limits
    if (this.syntheticLimits.hourly.used >= this.syntheticLimits.hourly.limit) {
      return false;
    }

    if (this.syntheticLimits.daily.used >= this.syntheticLimits.daily.limit) {
      return false;
    }

    // Cost budget check
    if (this.syntheticLimits.costBudget.used >= this.syntheticLimits.costBudget.limit) {
      return false;
    }

    // Task type suitability for Synthetic
    const syntheticOptimalTasks = ['generation', 'refactoring', 'completion', 'explanation'];
    if (!syntheticOptimalTasks.includes(request.type)) {
      return false;
    }

    // Cost sensitivity check
    if (request.preferences.costSensitive && this.syntheticLimits.costBudget.used > this.syntheticLimits.costBudget.limit * 0.8) {
      return false;
    }

    return true;
  }

  private async isSyntheticAvailable(): Promise<boolean> {
    try {
      // Check if Synthetic API key is configured
      const apiKey = process.env.SYNTHETIC_API_KEY;
      if (!apiKey || apiKey.trim() === '') {
        return false;
      }

      // Simple health check could be added here
      return true;
    } catch (error) {
      return false;
    }
  }

  private async routeToSynthetic(request: UnifiedRequest): Promise<UnifiedResponse> {
    const startTime = Date.now();

    // Simulate Synthetic API call based on request type
    let syntheticEndpoint: string;
    let taskId: string;

    switch (request.type) {
      case 'generation':
        syntheticEndpoint = 'synthetic_code';
        taskId = `DEVFLOW-SYNTHETIC-GEN-${Date.now()}`;
        break;
      case 'refactoring':
        syntheticEndpoint = 'synthetic_code';
        taskId = `DEVFLOW-SYNTHETIC-REF-${Date.now()}`;
        break;
      case 'explanation':
        syntheticEndpoint = 'synthetic_context';
        taskId = `DEVFLOW-SYNTHETIC-EXP-${Date.now()}`;
        break;
      case 'completion':
        syntheticEndpoint = 'synthetic_code';
        taskId = `DEVFLOW-SYNTHETIC-COMP-${Date.now()}`;
        break;
      default:
        syntheticEndpoint = 'synthetic_auto';
        taskId = `DEVFLOW-SYNTHETIC-AUTO-${Date.now()}`;
    }

    // Simulate Synthetic response (in real implementation, this would call MCP Synthetic tools)
    const latency = Math.random() * 3000 + 1000; // 1-4 seconds
    await new Promise(resolve => setTimeout(resolve, latency));

    const estimatedCost = this.estimateSyntheticCost(request);

    return {
      id: request.id,
      platform: 'synthetic',
      success: true,
      data: {
        result: `Synthetic ${syntheticEndpoint} result for: ${request.context.naturalLanguageQuery || request.type}`,
        taskId,
        endpoint: syntheticEndpoint,
        quality: 'high',
        confidence: 0.92
      },
      metadata: {
        latency: Date.now() - startTime,
        tokens: { input: 150, output: 300, total: 450, cost: estimatedCost },
        quality: { relevance: 0.95, accuracy: 0.92, completeness: 0.88, confidence: 0.92 },
        cached: false,
        fallbackUsed: false
      }
    };
  }

  private optimizeForCLI(request: UnifiedRequest): UnifiedRequest {
    // Optimize request for CLI platforms based on usage limits
    const availablePlatforms = this.getAvailableCLIPlatforms();

    // Update preferred platforms based on availability and limits
    const optimizedRequest = { ...request };
    optimizedRequest.preferences = {
      ...request.preferences,
      preferredPlatforms: availablePlatforms,
      fallbackBehavior: 'cascade',
      costSensitive: true // Always cost-sensitive for CLI
    };

    return optimizedRequest;
  }

  private getAvailableCLIPlatforms(): string[] {
    const available: string[] = [];

    for (const [platform, limits] of Object.entries(this.platformLimits)) {
      // Check hourly limits
      if (limits.hourly.used < limits.hourly.limit) {
        // Check daily limits
        if (limits.daily.used < limits.daily.limit) {
          available.push(platform);
        }
      }
    }

    // Sort by cost sensitivity and usage
    return available.sort((a, b) => {
      const aLimits = this.platformLimits[a];
      const bLimits = this.platformLimits[b];

      // Prefer free platforms when cost-sensitive
      if (aLimits.costSensitive !== bLimits.costSensitive) {
        return aLimits.costSensitive ? 1 : -1;
      }

      // Prefer platforms with lower usage percentage
      const aUsage = aLimits.hourly.used / aLimits.hourly.limit;
      const bUsage = bLimits.hourly.used / bLimits.hourly.limit;

      return aUsage - bUsage;
    });
  }

  private async handleEmergencyFallback(request: UnifiedRequest, startTime: number, error: any): Promise<UnifiedResponse> {
    return {
      id: request.id,
      platform: 'synthetic-priority-router',
      success: false,
      error: {
        code: 'ALL_PLATFORMS_EXHAUSTED',
        message: 'All platforms reached usage limits or are unavailable',
        retryable: true,
        platform: 'synthetic-priority-router'
      },
      metadata: {
        latency: Date.now() - startTime,
        cached: false,
        fallbackUsed: true
      }
    };
  }

  private updateSyntheticUsage(response: UnifiedResponse): void {
    this.syntheticLimits.hourly.used += 1;
    this.syntheticLimits.daily.used += 1;

    if (response.metadata.tokens?.cost) {
      this.syntheticLimits.costBudget.used += response.metadata.tokens.cost;
    }
  }

  private updatePlatformUsage(platform: string, response: UnifiedResponse): void {
    if (this.platformLimits[platform]) {
      this.platformLimits[platform].hourly.used += 1;
      this.platformLimits[platform].daily.used += 1;
    }
  }

  private estimateSyntheticCost(request: UnifiedRequest): number {
    // Rough cost estimation based on request complexity
    const baseCost = 0.002; // $0.002 base
    const complexityMultiplier = request.context.fileContent ?
      Math.min(request.context.fileContent.length / 1000, 3) : 1;

    return baseCost * complexityMultiplier;
  }

  public getUsageStatus(): { synthetic: SyntheticUsageLimits; platforms: PlatformUsageLimits } {
    return {
      synthetic: { ...this.syntheticLimits },
      platforms: { ...this.platformLimits }
    };
  }

  public resetHourlyLimits(): void {
    this.syntheticLimits.hourly.used = 0;
    for (const platform of Object.keys(this.platformLimits)) {
      this.platformLimits[platform].hourly.used = 0;
    }
  }

  public resetDailyLimits(): void {
    this.syntheticLimits.daily.used = 0;
    this.syntheticLimits.costBudget.used = 0;
    for (const platform of Object.keys(this.platformLimits)) {
      this.platformLimits[platform].daily.used = 0;
    }
  }
}