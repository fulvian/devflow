import { performance } from 'perf_hooks';
import { existsSync } from 'fs';

interface HealthMetrics {
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  resourceStatus: Record<string, boolean>;
  lastHeartbeat: number;
}

interface HealthConfig {
  checkInterval: number;
  criticalResources: string[];
  heartbeatTimeout: number;
}

class HealthMonitor {
  private config: HealthConfig;
  private startTime: number;
  private lastCheck: number;
  private metrics: HealthMetrics;
  private isMonitoring: boolean;
  private checkTimer: NodeJS.Timeout | null;

  constructor(config: Partial<HealthConfig> = {}) {
    this.config = {
      checkInterval: config.checkInterval || 5000, // Standardized interval
      criticalResources: config.criticalResources || ['/tmp', '/var/log'],
      heartbeatTimeout: config.heartbeatTimeout || 10000
    };
    
    this.startTime = performance.timeOrigin;
    this.lastCheck = Date.now();
    this.metrics = this.initializeMetrics();
    this.isMonitoring = false;
    this.checkTimer = null;
  }

  start(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.performCheck(); // Initial check
    this.checkTimer = setInterval(() => {
      this.performCheck();
    }, this.config.checkInterval);
    
    console.log('Health monitoring started');
  }

  stop(): void {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    
    console.log('Health monitoring stopped');
  }

  getMetrics(): HealthMetrics {
    return { ...this.metrics };
  }

  isHealthy(): boolean {
    const now = Date.now();
    const timeSinceHeartbeat = now - this.metrics.lastHeartbeat;
    
    return (
      timeSinceHeartbeat < this.config.heartbeatTimeout &&
      Object.values(this.metrics.resourceStatus).every(status => status)
    );
  }

  private initializeMetrics(): HealthMetrics {
    return {
      uptime: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      resourceStatus: {},
      lastHeartbeat: Date.now()
    };
  }

  private performCheck(): void {
    try {
      this.metrics.uptime = (performance.timeOrigin + performance.now() - this.startTime) / 1000;
      this.metrics.memoryUsage = process.memoryUsage();
      this.metrics.cpuUsage = process.cpuUsage();
      this.metrics.resourceStatus = this.checkResources();
      this.metrics.lastHeartbeat = Date.now();
      this.lastCheck = Date.now();
      
      if (!this.isHealthy()) {
        console.warn('Health check failed:', this.getHealthIssues());
      }
    } catch (error) {
      console.error('Health check error:', error.message);
    }
  }

  private checkResources(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    
    for (const resource of this.config.criticalResources) {
      status[resource] = existsSync(resource);
    }
    
    return status;
  }

  private getHealthIssues(): string[] {
    const issues: string[] = [];
    
    const timeSinceHeartbeat = Date.now() - this.metrics.lastHeartbeat;
    if (timeSinceHeartbeat >= this.config.heartbeatTimeout) {
      issues.push(`Heartbeat timeout (${timeSinceHeartbeat}ms)`);
    }
    
    for (const [resource, status] of Object.entries(this.metrics.resourceStatus)) {
      if (!status) {
        issues.push(`Resource unavailable: ${resource}`);
      }
    }
    
    return issues;
  }
}

export default HealthMonitor;
export { HealthMetrics, HealthConfig };
