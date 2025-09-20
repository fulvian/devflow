#!/usr/bin/env node
import { EventEmitter } from 'events';
import { execSync } from 'child_process';
import path from 'path';
import DAICContextManager, { TaskContext, BranchGovernanceRule } from './daic-context-manager';

export interface TaskBranch {
  id: string;
  task_id: string;
  branch_name: string;
  branch_type: 'feature' | 'hotfix' | 'bugfix' | 'task';
  created_at: string;
  updated_at: string;
  status: 'active' | 'completed' | 'merged' | 'abandoned';
  commit_count: number;
  last_commit_sha?: string;
  merged_to?: string;
}

export interface BranchValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface AutoBranchConfig {
  auto_create: boolean;
  naming_strategy: 'task_based' | 'feature_date' | 'custom';
  validate_task_exists: boolean;
  enforce_naming: boolean;
}

export class DevFlowBranchManager extends EventEmitter {
  private contextManager: DAICContextManager;
  private gitRepo: string;

  constructor(contextManager: DAICContextManager, gitRepo?: string) {
    super();
    this.contextManager = contextManager;
    this.gitRepo = gitRepo || process.cwd();
  }

  // Git Operations
  private runGitCommand(command: string): string {
    try {
      return execSync(command, {
        cwd: this.gitRepo,
        encoding: 'utf8'
      }).trim();
    } catch (error) {
      throw new Error(`Git command failed: ${command} - ${error}`);
    }
  }

  private getCurrentBranch(): string {
    return this.runGitCommand('git branch --show-current');
  }

  private branchExists(branchName: string): boolean {
    try {
      this.runGitCommand(`git rev-parse --verify ${branchName}`);
      return true;
    } catch {
      return false;
    }
  }

  private createGitBranch(branchName: string, fromBranch?: string): void {
    const baseCommand = fromBranch
      ? `git checkout -b ${branchName} ${fromBranch}`
      : `git checkout -b ${branchName}`;

    this.runGitCommand(baseCommand);
  }

  // Task-Branch Mapping
  async createTaskBranch(taskId: string, branchType: TaskBranch['branch_type'] = 'task'): Promise<string> {
    try {
      const task = await this.contextManager.getTaskById(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      // Generate branch name based on governance rules
      const branchName = await this.generateBranchName(task, branchType);

      // Validate branch name
      const validation = await this.validateBranchName(branchName, task);
      if (!validation.valid) {
        throw new Error(`Branch validation failed: ${validation.errors.join(', ')}`);
      }

      // Check if branch already exists
      if (this.branchExists(branchName)) {
        console.log(`[Branch Manager] Branch ${branchName} already exists`);
        return branchName;
      }

      // Get base branch from governance rules
      const governanceRules = await this.contextManager.getBranchGovernanceRules('automation');
      const autoConfig = this.parseAutoConfig(governanceRules);

      // Create git branch
      this.createGitBranch(branchName);

      // Record in database
      await this.recordTaskBranch({
        task_id: taskId,
        branch_name: branchName,
        branch_type: branchType,
        status: 'active',
        commit_count: 0
      });

      this.emit('branchCreated', { taskId, branchName, branchType });
      console.log(`[Branch Manager] Created branch: ${branchName} for task: ${taskId}`);

      return branchName;
    } catch (error) {
      console.error('[Branch Manager] Error creating task branch:', error);
      throw error;
    }
  }

  async switchToTaskBranch(taskId: string): Promise<string> {
    try {
      const taskBranch = await this.getTaskBranch(taskId);
      if (!taskBranch) {
        // Auto-create if governance allows
        const autoConfig = await this.getAutoConfig();
        if (autoConfig.auto_create) {
          return await this.createTaskBranch(taskId);
        } else {
          throw new Error(`No branch found for task ${taskId} and auto-creation disabled`);
        }
      }

      // Switch to branch
      this.runGitCommand(`git checkout ${taskBranch.branch_name}`);

      // Update last accessed
      await this.updateTaskBranch(taskBranch.id, { updated_at: new Date().toISOString() });

      this.emit('branchSwitched', { taskId, branchName: taskBranch.branch_name });
      console.log(`[Branch Manager] Switched to branch: ${taskBranch.branch_name}`);

      return taskBranch.branch_name;
    } catch (error) {
      console.error('[Branch Manager] Error switching to task branch:', error);
      throw error;
    }
  }

  // Branch Name Generation
  async generateBranchName(task: TaskContext, branchType: TaskBranch['branch_type']): Promise<string> {
    const namingRules = await this.contextManager.getBranchGovernanceRules('naming');

    // Find applicable naming rule
    const applicableRule = namingRules.find(rule => {
      const config = JSON.parse(rule.rule_config);
      return this.ruleApplies(config, branchType);
    });

    if (!applicableRule) {
      // Fallback to task-based naming
      return `task/${this.sanitizeBranchName(task.title || task.id)}`;
    }

    const config = JSON.parse(applicableRule.rule_config);
    return this.applyNamingPattern(config.pattern, task, branchType);
  }

  private ruleApplies(config: any, branchType: string): boolean {
    // Rule applies if no specific type constraint or matches current type
    return !config.branch_types || config.branch_types.includes(branchType);
  }

  private applyNamingPattern(pattern: string, task: TaskContext, branchType: string): string {
    const now = new Date();
    const replacements = {
      '{task-name}': this.sanitizeBranchName(task.title || task.id),
      '{task-id}': task.id,
      '{type}': branchType,
      'YYYY': now.getFullYear().toString(),
      'MM': (now.getMonth() + 1).toString().padStart(2, '0'),
      'DD': now.getDate().toString().padStart(2, '0'),
      '{description}': this.sanitizeBranchName(task.description?.slice(0, 20) || task.title || 'task')
    };

    let result = pattern;
    Object.entries(replacements).forEach(([placeholder, value]) => {
      result = result.replace(new RegExp(placeholder, 'g'), value);
    });

    return result;
  }

  private sanitizeBranchName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }

  // Branch Validation
  async validateBranchName(branchName: string, task?: TaskContext): Promise<BranchValidationResult> {
    const result: BranchValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    const validationRules = await this.contextManager.getBranchGovernanceRules('validation');

    for (const rule of validationRules) {
      const config = JSON.parse(rule.rule_config);
      const ruleResult = this.applyValidationRule(config, branchName, task);

      result.errors.push(...ruleResult.errors);
      result.warnings.push(...ruleResult.warnings);
      result.suggestions.push(...ruleResult.suggestions);
    }

    result.valid = result.errors.length === 0;
    return result;
  }

  private applyValidationRule(config: any, branchName: string, task?: TaskContext): BranchValidationResult {
    const result: BranchValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Pattern validation
    if (config.pattern_regex) {
      const regex = new RegExp(config.pattern_regex);
      if (!regex.test(branchName)) {
        result.errors.push(`Branch name doesn't match required pattern: ${config.pattern_regex}`);
      }
    }

    // Length validation
    if (config.max_length && branchName.length > config.max_length) {
      result.errors.push(`Branch name too long: ${branchName.length} > ${config.max_length}`);
    }

    // Forbidden patterns
    if (config.forbidden_patterns) {
      for (const forbidden of config.forbidden_patterns) {
        if (branchName.includes(forbidden)) {
          result.errors.push(`Branch name contains forbidden pattern: ${forbidden}`);
        }
      }
    }

    // Task existence validation
    if (config.require_task_reference && task && !branchName.includes(task.id)) {
      result.warnings.push(`Branch name should reference task ID: ${task.id}`);
    }

    return result;
  }

  // Database Operations
  private async recordTaskBranch(branchData: Omit<TaskBranch, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    // Since DAICContextManager doesn't have this method, we'll add it there or implement here
    // For now, let's implement a direct database operation
    const id = this.generateId();
    const now = new Date().toISOString();

    // We need to add this method to DAICContextManager
    // For now, return the generated ID
    this.emit('taskBranchRecorded', { id, ...branchData });
    return id;
  }

  private async getTaskBranch(taskId: string): Promise<TaskBranch | null> {
    // This would query the task_branches table
    // Implementation depends on extending DAICContextManager
    return null;
  }

  private async updateTaskBranch(branchId: string, updates: Partial<TaskBranch>): Promise<void> {
    // This would update the task_branches table
    // Implementation depends on extending DAICContextManager
    this.emit('taskBranchUpdated', { branchId, updates });
  }

  // Configuration
  private parseAutoConfig(rules: BranchGovernanceRule[]): AutoBranchConfig {
    const autoRule = rules.find(rule => rule.rule_name === 'auto_branch_creation');
    if (!autoRule) {
      return {
        auto_create: false,
        naming_strategy: 'task_based',
        validate_task_exists: true,
        enforce_naming: true
      };
    }

    return JSON.parse(autoRule.rule_config);
  }

  private async getAutoConfig(): Promise<AutoBranchConfig> {
    const rules = await this.contextManager.getBranchGovernanceRules('automation');
    return this.parseAutoConfig(rules);
  }

  // Smart Branch Management
  async suggestBranchForTask(taskId: string): Promise<{
    suggestion: string;
    reason: string;
    autoCreate: boolean;
  }> {
    try {
      const task = await this.contextManager.getTaskById(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      const existingBranch = await this.getTaskBranch(taskId);
      if (existingBranch) {
        return {
          suggestion: existingBranch.branch_name,
          reason: 'Existing branch found for this task',
          autoCreate: false
        };
      }

      const suggestedName = await this.generateBranchName(task, 'task');
      const autoConfig = await this.getAutoConfig();

      return {
        suggestion: suggestedName,
        reason: `Generated from task: ${task.title}`,
        autoCreate: autoConfig.auto_create
      };
    } catch (error) {
      console.error('[Branch Manager] Error suggesting branch:', error);
      throw error;
    }
  }

  // Integration with Current Workflow
  async syncCurrentBranchWithTask(): Promise<{
    taskId?: string;
    branchName: string;
    synced: boolean;
    action?: string;
  }> {
    try {
      const currentBranch = this.getCurrentBranch();

      // Check if current branch is associated with a task
      const taskBranch = await this.findTaskByBranch(currentBranch);

      if (taskBranch) {
        // Update task workflow state
        await this.contextManager.updateTaskWorkflowState(
          taskBranch.task_id,
          'implementation',
          'implementation',
          { current_branch: currentBranch }
        );

        return {
          taskId: taskBranch.task_id,
          branchName: currentBranch,
          synced: true,
          action: 'Updated task workflow state'
        };
      }

      // Try to extract task info from branch name
      const taskInfo = this.extractTaskFromBranchName(currentBranch);
      if (taskInfo) {
        return {
          taskId: taskInfo.taskId,
          branchName: currentBranch,
          synced: false,
          action: 'Task extracted from branch name but not synced'
        };
      }

      return {
        branchName: currentBranch,
        synced: false,
        action: 'No task association found'
      };
    } catch (error) {
      console.error('[Branch Manager] Error syncing branch with task:', error);
      throw error;
    }
  }

  private async findTaskByBranch(branchName: string): Promise<TaskBranch | null> {
    // This would query task_branches by branch_name
    // Implementation depends on extending DAICContextManager
    return null;
  }

  private extractTaskFromBranchName(branchName: string): { taskId: string } | null {
    // Extract task ID from common branch naming patterns
    const patterns = [
      /task\/(.+)/,
      /feature\/.*-(.+)/,
      /^(.+)-.*/
    ];

    for (const pattern of patterns) {
      const match = branchName.match(pattern);
      if (match) {
        return { taskId: match[1] };
      }
    }

    return null;
  }

  // Utility Methods
  private generateId(): string {
    return Math.random().toString(36).substr(2, 16);
  }

  // Health Check
  async healthCheck(): Promise<{
    healthy: boolean;
    message: string;
    currentBranch: string;
    gitRepo: string;
  }> {
    try {
      const currentBranch = this.getCurrentBranch();
      const contextHealth = await this.contextManager.healthCheck();

      return {
        healthy: contextHealth.healthy,
        message: contextHealth.healthy ? 'Branch manager operational' : 'Context manager issues',
        currentBranch,
        gitRepo: this.gitRepo
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Git operations failed: ${error}`,
        currentBranch: 'unknown',
        gitRepo: this.gitRepo
      };
    }
  }

  async close(): Promise<void> {
    await this.contextManager.close();
  }
}

export default DevFlowBranchManager;