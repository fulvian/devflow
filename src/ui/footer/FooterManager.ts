import { FooterRenderer } from './FooterRenderer';
import { ModelService } from '../../services/ModelService';
import { CallLimitService } from '../../services/CallLimitService';
import { ContextService } from '../../services/ContextService';
import { TaskHierarchyService } from '../../services/TaskHierarchyService';
import { EventEmitter } from 'events';

export interface FooterData {
  model: {
    current: string;
    fallbackChain: string[];
    status: 'active' | 'fallback' | 'error';
  };
  calls: {
    current: number;
    limit: number;
    percentage: number;
    resetTime?: Date;
  };
  context: {
    percentage: number;
    used: number;
    total: number;
    warning: boolean;
    critical: boolean;
  };
  hierarchy: {
    project: string;
    macroTask: string;
    microTask: string;
  };
  timestamp: number;
}

export class FooterManager extends EventEmitter {
  private renderer: FooterRenderer;
  private modelService: ModelService;
  private callLimitService: CallLimitService;
  private contextService: ContextService;
  private taskHierarchyService: TaskHierarchyService;
  
  private updateInterval: NodeJS.Timeout | null = null;
  private isActive: boolean = false;
  private lastUpdate: number = 0;
  private updateFrequency: number = 2000; // 2 seconds
  private perfThreshold: number = 16; // 60fps target

  constructor(
    renderer: FooterRenderer,
    modelService: ModelService,
    callLimitService: CallLimitService,
    contextService: ContextService,
    taskHierarchyService: TaskHierarchyService
  ) {
    super();
    this.renderer = renderer;
    this.modelService = modelService;
    this.callLimitService = callLimitService;
    this.contextService = contextService;
    this.taskHierarchyService = taskHierarchyService;
  }

  /**
   * Start real-time footer monitoring
   */
  public start(): void {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.updateFooter(); // Initial update
    
    this.updateInterval = setInterval(() => {
      this.updateFooter();
    }, this.updateFrequency);

    this.emit('started');
  }

  /**
   * Stop footer monitoring
   */
  public stop(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.emit('stopped');
  }

  /**
   * Update footer data and render
   */
  private async updateFooter(): Promise<void> {
    const startTime = performance.now();
    
    try {
      const footerData = await this.collectFooterData();
      this.renderer.render(footerData);
      this.lastUpdate = Date.now();
      
      const updateTime = performance.now() - startTime;
      
      // Performance monitoring
      if (updateTime > this.perfThreshold) {
        console.warn(`Footer update took ${updateTime.toFixed(2)}ms (threshold: ${this.perfThreshold}ms)`);
        this.emit('performance-warning', { updateTime, threshold: this.perfThreshold });
      }
      
      this.emit('updated', footerData);
      
    } catch (error) {
      console.error('Failed to update footer:', error);
      this.emit('error', error);
    }
  }

  /**
   * Collect data from all services
   */
  private async collectFooterData(): Promise<FooterData> {
    const [modelData, callData, contextData, hierarchyData] = await Promise.all([
      this.collectModelData(),
      this.collectCallData(),
      this.collectContextData(),
      this.collectHierarchyData()
    ]);

    return {
      model: modelData,
      calls: callData,
      context: contextData,
      hierarchy: hierarchyData,
      timestamp: Date.now()
    };
  }

  /**
   * Collect model service data
   */
  private async collectModelData(): Promise<FooterData['model']> {
    try {
      const currentModel = await this.modelService.getCurrentModel();
      const fallbackChain = await this.modelService.getFallbackChain();
      const status = await this.modelService.getModelStatus();

      return {
        current: this.formatModelName(currentModel),
        fallbackChain: fallbackChain.map(m => this.formatModelName(m)),
        status: status
      };
    } catch (error) {
      return {
        current: 'Unknown',
        fallbackChain: ['Claude', 'Codex', 'Gemini', 'Qwen3'],
        status: 'error'
      };
    }
  }

  /**
   * Collect call limit data
   */
  private async collectCallData(): Promise<FooterData['calls']> {
    try {
      const current = await this.callLimitService.getCurrentCalls();
      const limit = await this.callLimitService.getCallLimit();
      const resetTime = await this.callLimitService.getResetTime();

      const percentage = Math.round((current / limit) * 100);

      return {
        current,
        limit,
        percentage,
        resetTime
      };
    } catch (error) {
      return {
        current: 0,
        limit: 60,
        percentage: 0
      };
    }
  }

  /**
   * Collect context usage data
   */
  private async collectContextData(): Promise<FooterData['context']> {
    try {
      const used = await this.contextService.getUsedTokens();
      const total = await this.contextService.getTotalTokens();
      const percentage = Math.round((used / total) * 100);
      
      const warning = percentage >= 80;
      const critical = percentage >= 95;

      return {
        percentage,
        used,
        total,
        warning,
        critical
      };
    } catch (error) {
      return {
        percentage: 0,
        used: 0,
        total: 100000,
        warning: false,
        critical: false
      };
    }
  }

  /**
   * Collect task hierarchy data
   */
  private async collectHierarchyData(): Promise<FooterData['hierarchy']> {
    try {
      const currentTask = await this.taskHierarchyService.getCurrentTask();
      
      if (!currentTask) {
        return {
          project: 'No Project',
          macroTask: 'No Task',
          microTask: 'No Task'
        };
      }

      const hierarchy = await this.taskHierarchyService.getTaskHierarchy(currentTask.id);
      
      return {
        project: hierarchy.project?.name || 'Unknown Project',
        macroTask: hierarchy.macroTask?.name || currentTask.name,
        microTask: hierarchy.microTask?.name || 'Current'
      };
    } catch (error) {
      return {
        project: 'Error',
        macroTask: 'Error',
        microTask: 'Error'
      };
    }
  }

  /**
   * Format model name for display
   */
  private formatModelName(modelName: string): string {
    const modelMap: Record<string, string> = {
      'claude-3-5-sonnet-20241022': 'Sonnet-3.5',
      'claude-3-5-sonnet': 'Sonnet-3.5', 
      'claude-4-sonnet': 'Sonnet-4',
      'gpt-4-turbo': 'GPT-4T',
      'gpt-4': 'GPT-4',
      'gemini-pro': 'Gemini-Pro',
      'gemini-2.0-flash': 'Gemini-2.0',
      'qwen-3-coder-480b': 'Qwen3-Coder',
      'qwen3-coder': 'Qwen3-Coder'
    };

    return modelMap[modelName.toLowerCase()] || modelName.substring(0, 10);
  }

  /**
   * Get current footer data without triggering update
   */
  public async getCurrentData(): Promise<FooterData> {
    return await this.collectFooterData();
  }

  /**
   * Set update frequency (in milliseconds)
   */
  public setUpdateFrequency(frequency: number): void {
    if (frequency < 500) {
      throw new Error('Update frequency must be at least 500ms to avoid performance issues');
    }

    this.updateFrequency = frequency;
    
    if (this.isActive) {
      this.stop();
      this.start();
    }
  }

  /**
   * Get last update timestamp
   */
  public getLastUpdate(): number {
    return this.lastUpdate;
  }

  /**
   * Check if footer manager is active
   */
  public isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Force immediate footer update
   */
  public async forceUpdate(): Promise<void> {
    await this.updateFooter();
  }
}