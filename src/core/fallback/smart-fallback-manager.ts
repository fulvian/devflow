import { HealthMonitor } from './health-monitor';
import { PlatformRouter } from './platform-router';
import { HealthStatus, FallbackDecision, PlatformType } from './fallback-types';

export class SmartFallbackManager {
  private healthMonitor: HealthMonitor;
  private platformRouter: PlatformRouter;
  private isFallbackActive: boolean = false;
  private fallbackStartTime: number | null = null;
  private performanceHistory: { timestamp: number; responseTime: number }[] = [];

  constructor(healthMonitor: HealthMonitor, platformRouter: PlatformRouter) {
    this.healthMonitor = healthMonitor;
    this.platformRouter = platformRouter;
  }

  async handleRequest(taskType: string, payload: any): Promise<any> {
    const claudeHealth = this.healthMonitor.getCurrentHealth();
    
    if (this.shouldFallback(claudeHealth)) {
      this.activateFallback();
      const alternativePlatform = this.platformRouter.selectPlatform(taskType);
      return this.routeToPlatform(alternativePlatform, taskType, payload);
    }

    try {
      const startTime = Date.now();
      // Simulate Claude Code request
      const result = await this.executeClaudeRequest(taskType, payload);
      const responseTime = Date.now() - startTime;
      
      this.performanceHistory.push({ timestamp: Date.now(), responseTime });
      this.checkRecovery(responseTime);
      
      return result;
    } catch (error) {
      if (this.isThrottlingError(error)) {
        this.activateFallback();
        const alternativePlatform = this.platformRouter.selectPlatform(taskType);
        return this.routeToPlatform(alternativePlatform, taskType, payload);
      }
      throw error;
    }
  }

  private shouldFallback(health: HealthStatus): boolean {
    return health.isDegraded || 
           health.errorRate > 0.3 || 
           health.avgResponseTime > 5000 ||
           this.isFallbackActive;
  }

  private activateFallback(): void {
    if (!this.isFallbackActive) {
      this.isFallbackActive = true;
      this.fallbackStartTime = Date.now();
      console.warn('Activating fallback mode due to Claude Code degradation');
    }
  }

  private async routeToPlatform(platform: PlatformType, taskType: string, payload: any): Promise<any> {
    switch (platform) {
      case 'synthetic':
        return this.executeSyntheticRequest(taskType, payload);
      case 'gemini':
        return this.executeGeminiRequest(taskType, payload);
      case 'codex':
        return this.executeCodexRequest(taskType, payload);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private checkRecovery(responseTime: number): void {
    if (!this.isFallbackActive) return;
    
    // Check if performance has recovered
    const recentPerformance = this.performanceHistory
      .slice(-10)
      .reduce((acc, curr) => acc + curr.responseTime, 0) / 10;
      
    if (recentPerformance < 2000 && this.fallbackStartTime && 
        Date.now() - this.fallbackStartTime > 60000) {
      this.deactivateFallback();
    }
  }

  private deactivateFallback(): void {
    this.isFallbackActive = false;
    this.fallbackStartTime = null;
    console.info('Deactivating fallback mode - Claude Code performance recovered');
  }

  // Placeholder methods for actual platform implementations
  private async executeClaudeRequest(taskType: string, payload: any): Promise<any> {
    // Implementation would integrate with Claude Code API
    return Promise.resolve({ result: `Claude processed ${taskType}` });
  }

  private async executeSyntheticRequest(taskType: string, payload: any): Promise<any> {
    // Implementation would integrate with Synthetic API
    return Promise.resolve({ result: `Synthetic processed ${taskType}` });
  }

  private async executeGeminiRequest(taskType: string, payload: any): Promise<any> {
    // Implementation would integrate with Gemini API
    return Promise.resolve({ result: `Gemini processed ${taskType}` });
  }

  private async executeCodexRequest(taskType: string, payload: any): Promise<any> {
    // Implementation would integrate with Codex API
    return Promise.resolve({ result: `Codex processed ${taskType}` });
  }

  private isThrottlingError(error: any): boolean {
    // Implementation would check for specific throttling error codes
    return error?.code === 'THROTTLED' || error?.status === 429;
  }
}
