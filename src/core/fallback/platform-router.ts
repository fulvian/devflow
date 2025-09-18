import { PlatformType, PlatformCapabilities, FallbackDecision } from './fallback-types';

class PlatformRouter {
  private platformCapabilities: Record<PlatformType, PlatformCapabilities> = {
    claude: {
      supportedTasks: ['code-generation', 'code-review', 'refactoring', 'explanation'],
      maxPayloadSize: 100000,
      costPerRequest: 0.02,
      performanceScore: 95
    },
    synthetic: {
      supportedTasks: ['code-generation', 'refactoring', 'testing'],
      maxPayloadSize: 50000,
      costPerRequest: 0.01,
      performanceScore: 80
    },
    gemini: {
      supportedTasks: ['code-generation', 'explanation', 'documentation'],
      maxPayloadSize: 200000,
      costPerRequest: 0.015,
      performanceScore: 85
    },
    codex: {
      supportedTasks: ['code-generation', 'completion', 'translation'],
      maxPayloadSize: 80000,
      costPerRequest: 0.018,
      performanceScore: 75
    }
  };

  private platformLoad: Record<PlatformType, number> = {
    claude: 0,
    synthetic: 0,
    gemini: 0,
    codex: 0
  };

  selectPlatform(taskType: string, payloadSize: number = 0): PlatformType {
    // Get platforms that support the task type
    const capablePlatforms = Object.entries(this.platformCapabilities)
      .filter(([platform, capabilities]) => 
        capabilities.supportedTasks.includes(taskType) && 
        capabilities.maxPayloadSize >= payloadSize
      ) as [PlatformType, PlatformCapabilities][];

    if (capablePlatforms.length === 0) {
      throw new Error(`No platform supports task type: ${taskType}`);
    }

    // Sort by performance score (descending) and load (ascending)
    const sortedPlatforms = capablePlatforms.sort(([a, aCaps], [b, bCaps]) => {
      const aScore = aCaps.performanceScore - this.platformLoad[a];
      const bScore = bCaps.performanceScore - this.platformLoad[b];
      return bScore - aScore;
    });

    return sortedPlatforms[0][0];
  }

  getFallbackChain(taskType: string, payloadSize: number = 0): PlatformType[] {
    const capablePlatforms = Object.entries(this.platformCapabilities)
      .filter(([platform, capabilities]) => 
        capabilities.supportedTasks.includes(taskType) && 
        capabilities.maxPayloadSize >= payloadSize
      ) as [PlatformType, PlatformCapabilities][];

    return capablePlatforms
      .sort(([a, aCaps], [b, bCaps]) => {
        // Primary sort: cost (ascending)
        if (aCaps.costPerRequest !== bCaps.costPerRequest) {
          return aCaps.costPerRequest - bCaps.costPerRequest;
        }
        // Secondary sort: performance (descending)
        return bCaps.performanceScore - aCaps.performanceScore;
      })
      .map(([platform]) => platform);
  }

  updatePlatformLoad(platform: PlatformType, load: number): void {
    if (this.platformLoad.hasOwnProperty(platform)) {
      this.platformLoad[platform] = Math.max(0, load);
    }
  }

  getPlatformCapabilities(platform: PlatformType): PlatformCapabilities {
    return { ...this.platformCapabilities[platform] };
  }

  makeRoutingDecision(
    taskType: string, 
    payloadSize: number = 0,
    priority: 'cost' | 'performance' = 'performance'
  ): FallbackDecision {
    const primaryPlatform = this.selectPlatform(taskType, payloadSize);
    const fallbackChain = this.getFallbackChain(taskType, payloadSize)
      .filter(platform => platform !== primaryPlatform);

    const capabilities = this.platformCapabilities[primaryPlatform];
    
    return {
      primaryPlatform,
      fallbackChain,
      estimatedCost: capabilities.costPerRequest,
      estimatedPerformance: capabilities.performanceScore,
      routingReason: priority === 'cost' ? 'COST_OPTIMIZATION' : 'PERFORMANCE'
    };
  }
}

export { PlatformRouter };
