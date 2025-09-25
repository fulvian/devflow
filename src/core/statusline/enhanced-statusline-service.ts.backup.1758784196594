import { GitStatusProvider } from './git-status-provider';
import { ModelTracker } from './model-tracker';
import { StatusLineState, PerformanceMetrics } from './statusline-types';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

export class EnhancedStatusLineService extends EventEmitter {
  private gitProvider: GitStatusProvider;
  private modelTracker: ModelTracker;
  private currentState: StatusLineState;
  private footerStatePath: string;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(footerStatePath: string = '.devflow/footer-state.json') {
    super();
    this.gitProvider = new GitStatusProvider();
    this.modelTracker = new ModelTracker();
    this.footerStatePath = footerStatePath;
    this.currentState = this.initializeState();
    
    // Bind context for event handlers
    this.handleGitUpdate = this.handleGitUpdate.bind(this);
    this.handleModelUpdate = this.handleModelUpdate.bind(this);
  }

  private initializeState(): StatusLineState {
    return {
      timestamp: Date.now(),
      git: {
        branch: '',
        uncommittedChanges: 0,
        isSynced: true,
        repositoryRoot: ''
      },
      model: {
        activeModel: '',
        activeAgent: '',
        tokenUsage: 0,
        estimatedCost: 0
      },
      performance: {
        responseTime: 0,
        memoryUsage: 0,
        cpuUsage: 0
      }
    };
  }

  public async initialize(): Promise<void> {
    try {
      // Initialize providers
      await this.gitProvider.initialize();
      this.modelTracker.initialize();
      
      // Setup event listeners
      this.gitProvider.on('gitUpdate', this.handleGitUpdate);
      this.modelTracker.on('modelUpdate', this.handleModelUpdate);
      
      // Start periodic updates
      this.startPeriodicUpdates();
      
      // Initial state update
      await this.updateAll();
      
      console.log('Enhanced StatusLine Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Enhanced StatusLine Service:', error);
      throw error;
    }
  }

  private startPeriodicUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.updateInterval = setInterval(() => {
      this.updatePerformanceMetrics();
    }, 5000); // Update performance metrics every 5 seconds
  }

  private async updateAll(): Promise<void> {
    try {
      await this.updateGitStatus();
      this.updateModelStatus();
      this.updatePerformanceMetrics();
      this.updateFooterState();
    } catch (error) {
      console.error('Error during status update:', error);
    }
  }

  private async updateGitStatus(): Promise<void> {
    try {
      const gitStatus = await this.gitProvider.getStatus();
      this.currentState.git = gitStatus;
      this.emit('statusUpdate', this.currentState);
    } catch (error) {
      console.error('Failed to update Git status:', error);
    }
  }

  private updateModelStatus(): void {
    try {
      const modelStatus = this.modelTracker.getStatus();
      this.currentState.model = modelStatus;
      this.emit('statusUpdate', this.currentState);
    } catch (error) {
      console.error('Failed to update model status:', error);
    }
  }

  private updatePerformanceMetrics(): void {
    try {
      const metrics: PerformanceMetrics = {
        responseTime: this.calculateAverageResponseTime(),
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
        cpuUsage: this.calculateCPUUsage()
      };
      
      this.currentState.performance = metrics;
      this.emit('statusUpdate', this.currentState);
    } catch (error) {
      console.error('Failed to update performance metrics:', error);
    }
  }

  private calculateAverageResponseTime(): number {
    // Placeholder for actual response time calculation
    // In a real implementation, this would track API response times
    return Math.floor(Math.random() * 200) + 50; // Random value between 50-250ms for demo
  }

  private calculateCPUUsage(): number {
    // Placeholder for actual CPU usage calculation
    return Math.floor(Math.random() * 50) + 10; // Random value between 10-60% for demo
  }

  private updateFooterState(): void {
    try {
      const footerState = {
        statusLine: this.currentState,
        lastUpdated: new Date().toISOString()
      };
      
      // Ensure directory exists
      const dir = path.dirname(this.footerStatePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.footerStatePath, JSON.stringify(footerState, null, 2));
    } catch (error) {
      console.error('Failed to update footer state file:', error);
    }
  }

  private handleGitUpdate(): void {
    this.updateGitStatus();
  }

  private handleModelUpdate(): void {
    this.updateModelStatus();
  }

  public getCurrentState(): StatusLineState {
    return { ...this.currentState };
  }

  public async forceUpdate(): Promise<void> {
    await this.updateAll();
  }

  public destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.gitProvider.removeAllListeners();
    this.modelTracker.removeAllListeners();
    this.removeAllListeners();
  }
}
