import { EventEmitter } from 'events';

export interface PlatformStatus {
  name: string;
  active: boolean;
  lastExecution?: number;
  executionCount: number;
  successRate: number;
  averageResponseTime: number;
  currentLoad: number;
}

export interface ExecutionMetrics {
  model: string;
  success: boolean;
  executionTime: number;
  timestamp: number;
}

export class PlatformStatusTracker extends EventEmitter {
  private platformStatuses: Map<string, PlatformStatus> = new Map();
  private executionHistory: Map<string, ExecutionMetrics[]> = new Map();
  private maxHistoryPerPlatform: number = 100;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initializeDefaultPlatforms();
    this.startPeriodicUpdates();
  }

  private initializeDefaultPlatforms(): void {
    const defaultPlatforms = ['codex', 'gemini', 'qwen'];
    
    for (const platform of defaultPlatforms) {
      this.platformStatuses.set(platform, {
        name: platform,
        active: false,
        executionCount: 0,
        successRate: 100,
        averageResponseTime: 0,
        currentLoad: 0
      });
      
      this.executionHistory.set(platform, []);
    }
  }

  public updatePlatformStatus(platform: string, status: Partial<PlatformStatus>): void {
    const currentStatus = this.platformStatuses.get(platform);
    
    if (currentStatus) {
      this.platformStatuses.set(platform, {
        ...currentStatus,
        ...status,
        lastExecution: status.active ? Date.now() : currentStatus.lastExecution
      });
      
      this.emit('statusUpdate', { platform, status: this.platformStatuses.get(platform) });
      this.emit(`statusUpdate:${platform}`, this.platformStatuses.get(platform));
    }
  }

  public recordExecution(metrics: ExecutionMetrics): void {
    const { model, success, executionTime } = metrics;
    
    // Update execution history
    const history = this.executionHistory.get(model) || [];
    history.push(metrics);
    
    // Limit history size
    if (history.length > this.maxHistoryPerPlatform) {
      history.shift();
    }
    
    this.executionHistory.set(model, history);
    
    // Update platform status
    const currentStatus = this.platformStatuses.get(model);
    if (currentStatus) {
      const totalExecutions = currentStatus.executionCount + 1;
      const successfulExecutions = currentStatus.successRate * currentStatus.executionCount / 100;
      const newSuccessfulExecutions = success ? successfulExecutions + 1 : successfulExecutions;
      const newSuccessRate = (newSuccessfulExecutions / totalExecutions) * 100;
      
      const totalResponseTime = currentStatus.averageResponseTime * currentStatus.executionCount;
      const newAverageResponseTime = (totalResponseTime + executionTime) / totalExecutions;
      
      this.updatePlatformStatus(model, {
        executionCount: totalExecutions,
        successRate: newSuccessRate,
        averageResponseTime: newAverageResponseTime,
        active: true
      });
    }
    
    this.emit('executionRecorded', metrics);
  }

  public setPlatformLoad(platform: string, load: number): void {
    this.updatePlatformStatus(platform, { currentLoad: load });
  }

  public getPlatformStatus(platform: string): PlatformStatus | undefined {
    return this.platformStatuses.get(platform);
  }

  public getAllStatuses(): PlatformStatus[] {
    return Array.from(this.platformStatuses.values());
  }

  public getActivePlatforms(): PlatformStatus[] {
    return Array.from(this.platformStatuses.values()).filter(status => status.active);
  }

  public getPlatformMetrics(platform: string): {
    recentSuccessRate: number;
    averageResponseTime: number;
    executionsLastHour: number;
  } {
    const history = this.executionHistory.get(platform) || [];
    const oneHourAgo = Date.now() - 3600000;
    
    const recentExecutions = history.filter(m => m.timestamp > oneHourAgo);
    const successfulExecutions = recentExecutions.filter(m => m.success).length;
    
    const recentSuccessRate = recentExecutions.length > 0 
      ? (successfulExecutions / recentExecutions.length) * 100 
      : 100;
      
    const totalResponseTime = recentExecutions.reduce((sum, m) => sum + m.executionTime, 0);
    const averageResponseTime = recentExecutions.length > 0 
      ? totalResponseTime / recentExecutions.length 
      : 0;
      
    return {
      recentSuccessRate,
      averageResponseTime,
      executionsLastHour: recentExecutions.length
    };
  }

  private startPeriodicUpdates(): void {
    this.updateInterval = setInterval(() => {
      // Update load metrics (decrease load over time)
      for (const [platformName, status] of this.platformStatuses.entries()) {
        if (status.currentLoad > 0) {
          const newLoad = Math.max(0, status.currentLoad - 5);
          if (newLoad !== status.currentLoad) {
            this.updatePlatformStatus(platformName, { currentLoad: newLoad });
          }
        }
      }
      
      // Emit periodic update
      this.emit('periodicUpdate', this.getAllStatuses());
    }, 5000); // Update every 5 seconds
  }

  public getOverallSystemHealth(): { healthy: boolean; message: string } {
    const statuses = this.getAllStatuses();
    const activePlatforms = statuses.filter(s => s.active);
    
    if (activePlatforms.length === 0) {
      return { healthy: false, message: 'No platforms are currently active' };
    }
    
    const avgSuccessRate = activePlatforms.reduce((sum, s) => sum + s.successRate, 0) / activePlatforms.length;
    
    if (avgSuccessRate < 80) {
      return { healthy: false, message: `Low success rate: ${avgSuccessRate.toFixed(2)}%` };
    }
    
    return { healthy: true, message: 'System operating normally' };
  }

  public resetPlatformMetrics(platform: string): void {
    const status = this.platformStatuses.get(platform);
    if (status) {
      this.platformStatuses.set(platform, {
        ...status,
        executionCount: 0,
        successRate: 100,
        averageResponseTime: 0
      });
      
      this.executionHistory.set(platform, []);
      
      this.emit('metricsReset', platform);
    }
  }

  public shutdown(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    this.emit('shutdown');
  }
}

export default PlatformStatusTracker;