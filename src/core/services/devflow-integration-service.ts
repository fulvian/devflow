#!/usr/bin/env node
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import DAICContextManager from './daic-context-manager';
import DevFlowBranchManager from './devflow-branch-manager';

export interface FooterIntegrationConfig {
  footer_line_path: string;
  footer_state_path: string;
  update_interval: number;
  enable_task_sync: boolean;
  enable_branch_sync: boolean;
}

export interface FooterState {
  timestamp: string;
  version: string;
  progress: {
    percentage: number;
    current_task: string;
    token_count: number;
  };
  system: {
    status: string;
    services_active: number;
    services_total: number;
  };
  mode: string;
  last_tool: string;
  services: Array<{
    name: string;
    status: string;
  }>;
}

export class DevFlowIntegrationService extends EventEmitter {
  private contextManager: DAICContextManager;
  private branchManager: DevFlowBranchManager;
  private config: FooterIntegrationConfig;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(
    contextManager: DAICContextManager,
    branchManager: DevFlowBranchManager,
    config?: Partial<FooterIntegrationConfig>
  ) {
    super();
    this.contextManager = contextManager;
    this.branchManager = branchManager;
    this.config = {
      footer_line_path: path.join(process.cwd(), '.devflow', 'footer-line.txt'),
      footer_state_path: path.join(process.cwd(), '.devflow', 'footer-state.json'),
      update_interval: 5000, // 5 seconds
      enable_task_sync: true,
      enable_branch_sync: true,
      ...config
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen to context manager events
    this.contextManager.on('workflowStateUpdated', this.handleWorkflowStateUpdate.bind(this));
    this.contextManager.on('interventionRecorded', this.handleDAICIntervention.bind(this));

    // Listen to branch manager events
    this.branchManager.on('branchCreated', this.handleBranchCreated.bind(this));
    this.branchManager.on('branchSwitched', this.handleBranchSwitched.bind(this));
  }

  // Footer Integration Methods
  async updateFooterState(): Promise<void> {
    try {
      const currentFooterState = await this.readFooterState();
      const updatedState = await this.generateUpdatedFooterState(currentFooterState);

      await this.writeFooterState(updatedState);
      await this.updateFooterLine(updatedState);

      this.emit('footerUpdated', updatedState);
    } catch (error) {
      console.error('[DevFlow Integration] Error updating footer:', error);
    }
  }

  private async readFooterState(): Promise<FooterState> {
    try {
      const data = await fs.readFile(this.config.footer_state_path, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // Return default state if file doesn't exist
      return this.getDefaultFooterState();
    }
  }

  private async writeFooterState(state: FooterState): Promise<void> {
    await fs.writeFile(this.config.footer_state_path, JSON.stringify(state, null, 2));
  }

  private async updateFooterLine(state: FooterState): Promise<void> {
    const footerLine = this.generateFooterLine(state);
    await fs.writeFile(this.config.footer_line_path, footerLine);
  }

  private async generateUpdatedFooterState(currentState: FooterState): Promise<FooterState> {
    const updatedState = { ...currentState };

    // Update timestamp
    updatedState.timestamp = new Date().toISOString();

    // Update task information if enabled
    if (this.config.enable_task_sync) {
      const currentTask = await this.contextManager.getCurrentTask();
      if (currentTask) {
        updatedState.progress.current_task = currentTask.title || currentTask.id;

        // Calculate progress based on task status
        const workflowState = await this.contextManager.getTaskWorkflowState(currentTask.id);
        if (workflowState) {
          updatedState.progress.percentage = this.calculateTaskProgress(workflowState.workflow_phase);
          updatedState.mode = this.mapWorkflowPhaseToMode(workflowState.workflow_phase);
        }
      }
    }

    // Update branch information if enabled
    if (this.config.enable_branch_sync) {
      try {
        const branchSync = await this.branchManager.syncCurrentBranchWithTask();
        updatedState.last_tool = branchSync.action || 'unknown';
      } catch (error) {
        console.error('[DevFlow Integration] Branch sync error:', error);
      }
    }

    // Update DAIC context
    const daicSuggestion = await this.getDAICContextForFooter();
    if (daicSuggestion) {
      updatedState.mode = daicSuggestion.mode;
    }

    return updatedState;
  }

  private calculateTaskProgress(workflowPhase: string): number {
    const phaseProgress = {
      'planning': 20,
      'implementation': 60,
      'testing': 80,
      'review': 90,
      'completed': 100
    };
    return phaseProgress[workflowPhase] || 0;
  }

  private mapWorkflowPhaseToMode(workflowPhase: string): string {
    const phaseToMode = {
      'planning': 'PLAN',
      'implementation': 'IMPL',
      'testing': 'TEST',
      'review': 'REVIEW',
      'completed': 'DONE'
    };
    return phaseToMode[workflowPhase] || 'DEV';
  }

  private async getDAICContextForFooter(): Promise<{ mode: string } | null> {
    try {
      const currentTask = await this.contextManager.getCurrentTask();
      if (!currentTask) return null;

      const suggestion = await this.contextManager.suggestDAICMode(currentTask.id);
      return {
        mode: suggestion === 'implementation' ? 'IMPL' : 'DISC'
      };
    } catch (error) {
      return null;
    }
  }

  private generateFooterLine(state: FooterState): string {
    const progressBar = this.generateProgressBar(state.progress.percentage);
    const serviceStatus = `${state.system.services_active}/${state.system.services_total}`;

    return `DevFlow v${state.version} · ${state.system.status} · 🔥 ${serviceStatus} · ${state.mode} · 📌 ${state.progress.current_task} · ${progressBar} ${state.progress.percentage}% (${state.progress.token_count} tokens) · 🛠 ${state.last_tool}`;
  }

  private generateProgressBar(percentage: number, length: number = 10): string {
    const filled = Math.floor((percentage / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  private getDefaultFooterState(): FooterState {
    return {
      timestamp: new Date().toISOString(),
      version: "3.1",
      progress: {
        percentage: 0,
        current_task: "initialization",
        token_count: 0
      },
      system: {
        status: "STARTING",
        services_active: 0,
        services_total: 8
      },
      mode: "INIT",
      last_tool: "unknown",
      services: []
    };
  }

  // Event Handlers
  private async handleWorkflowStateUpdate(data: any): Promise<void> {
    console.log(`[DevFlow Integration] Workflow state updated for task ${data.taskId}: ${data.phase}`);
    await this.updateFooterState();
  }

  private async handleDAICIntervention(data: any): Promise<void> {
    console.log(`[DevFlow Integration] DAIC intervention: ${data.intervention_type}`);
    await this.updateFooterState();
  }

  private async handleBranchCreated(data: any): Promise<void> {
    console.log(`[DevFlow Integration] Branch created: ${data.branchName} for task ${data.taskId}`);
    await this.updateFooterState();
  }

  private async handleBranchSwitched(data: any): Promise<void> {
    console.log(`[DevFlow Integration] Switched to branch: ${data.branchName}`);
    await this.updateFooterState();
  }

  // Smart DAIC Integration
  async suggestDAICAction(userInput?: string): Promise<{
    suggestion: 'discussion' | 'implementation' | 'none';
    reason: string;
    confidence: number;
  }> {
    try {
      const currentTask = await this.contextManager.getCurrentTask();
      if (!currentTask) {
        return {
          suggestion: 'discussion',
          reason: 'No active task found',
          confidence: 0.5
        };
      }

      const workflowState = await this.contextManager.getTaskWorkflowState(currentTask.id);
      const branchSync = await this.branchManager.syncCurrentBranchWithTask();

      // Analyze context for smart suggestion
      const suggestion = await this.contextManager.suggestDAICMode(currentTask.id, userInput);
      const interventionHistory = await this.contextManager.getDAICInterventionHistory(currentTask.id, 5);

      // Calculate confidence based on various factors
      const confidence = this.calculateSuggestionConfidence(
        workflowState,
        branchSync,
        interventionHistory,
        userInput
      );

      const reason = this.generateSuggestionReason(suggestion, workflowState, branchSync);

      return { suggestion, reason, confidence };
    } catch (error) {
      console.error('[DevFlow Integration] Error suggesting DAIC action:', error);
      return {
        suggestion: 'discussion',
        reason: 'Error analyzing context',
        confidence: 0.1
      };
    }
  }

  private calculateSuggestionConfidence(
    workflowState: any,
    branchSync: any,
    interventionHistory: any[],
    userInput?: string
  ): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence if workflow state is clear
    if (workflowState) {
      confidence += 0.2;
      if (workflowState.workflow_phase === 'implementation') {
        confidence += 0.2;
      }
    }

    // Increase confidence if branch is properly synced
    if (branchSync && branchSync.synced) {
      confidence += 0.15;
    }

    // Adjust based on user acceptance history
    if (interventionHistory.length > 0) {
      const acceptanceRate = interventionHistory.filter(i => i.user_accepted).length / interventionHistory.length;
      confidence += (acceptanceRate - 0.5) * 0.3;
    }

    // Increase confidence if user input is clear
    if (userInput && userInput.length > 10) {
      confidence += 0.1;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private generateSuggestionReason(
    suggestion: string,
    workflowState: any,
    branchSync: any
  ): string {
    const reasons = [];

    if (workflowState) {
      reasons.push(`Task in ${workflowState.workflow_phase} phase`);
    }

    if (branchSync && branchSync.synced) {
      reasons.push(`Working on task branch: ${branchSync.branchName}`);
    }

    if (suggestion === 'implementation') {
      reasons.push('Context suggests implementation work');
    } else if (suggestion === 'discussion') {
      reasons.push('Context suggests discussion/planning');
    }

    return reasons.join(', ') || 'Based on current context';
  }

  // Lifecycle Management
  public start(): void {
    console.log('[DevFlow Integration] Starting integration service...');

    // Start periodic footer updates
    this.updateInterval = setInterval(() => {
      this.updateFooterState();
    }, this.config.update_interval);

    // Initial footer update
    this.updateFooterState();

    this.emit('started');
    console.log('[DevFlow Integration] Integration service started');
  }

  public stop(): void {
    console.log('[DevFlow Integration] Stopping integration service...');

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.emit('stopped');
    console.log('[DevFlow Integration] Integration service stopped');
  }

  public async close(): Promise<void> {
    this.stop();
    await this.contextManager.close();
    await this.branchManager.close();
  }

  // Health Check
  async healthCheck(): Promise<{
    healthy: boolean;
    message: string;
    footer_accessible: boolean;
    context_healthy: boolean;
    branch_healthy: boolean;
  }> {
    try {
      const contextHealth = await this.contextManager.healthCheck();
      const branchHealth = await this.branchManager.healthCheck();

      let footerAccessible = false;
      try {
        await fs.access(this.config.footer_state_path);
        footerAccessible = true;
      } catch {
        footerAccessible = false;
      }

      const healthy = contextHealth.healthy && branchHealth.healthy && footerAccessible;

      return {
        healthy,
        message: healthy ? 'Integration service operational' : 'Some components have issues',
        footer_accessible: footerAccessible,
        context_healthy: contextHealth.healthy,
        branch_healthy: branchHealth.healthy
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed: ${error}`,
        footer_accessible: false,
        context_healthy: false,
        branch_healthy: false
      };
    }
  }
}

export default DevFlowIntegrationService;