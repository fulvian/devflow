/**
 * Real-Time Token Monitor - ccusage Integration for DevFlow Enhanced Footer
 * Provides hybrid token tracking combining ccusage data with intelligent analytics
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tokenCache } from './robust-token-cache';

const execAsync = promisify(exec);

// Types based on ccusage API response structure
interface CcusageTokenCounts {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

interface CcusageBlock {
  id: string;
  startTime: string;
  endTime: string;
  actualEndTime: string | null;
  isActive: boolean;
  isGap: boolean;
  entries: number;
  tokenCounts: CcusageTokenCounts;
  totalTokens: number;
  costUSD: number;
  models: string[];
  burnRate: number | null;
  projection: number | null;
}

interface CcusageResponse {
  blocks: CcusageBlock[];
}

interface TokenUsageData {
  sessionTokens: number;
  taskTokens: number;
  burnRate: number;
  costUSD: number;
  planLimit: number;
  remainingTokens: number;
  projectedExhaustion: Date | null;
}

interface FooterTokenData {
  session: {
    total: number;
    formatted: string;
  };
  task: {
    current: number;
    formatted: string;
  };
  burnRate: number;
  costUSD: number;
}

export class RealTimeTokenMonitor {
  private readonly tokenStateFile = '.devflow/token-usage-state.json';
  private readonly ccusageTimeout = 5000; // 5 second timeout
  private readonly planLimits = {
    pro: 7000,
    max5: 35000,
    max20: 140000,
    custom_max: 140000 // Default to Max plan
  };

  /**
   * Get raw usage data from ccusage WITHOUT caching for real-time debug
   */
  async getRawUsage(): Promise<CcusageResponse | null> {
    try {
      const { stdout } = await execAsync('ccusage blocks --json', {
        timeout: this.ccusageTimeout
      });
      return JSON.parse(stdout) as CcusageResponse;
    } catch (error) {
      console.error('ccusage fetch failed:', error);
      return null;
    }
  }

  /**
   * Calculate current session tokens from active session
   */
  private calculateSessionTokens(blocks: CcusageBlock[]): number {
    // Find the most recent active block (current session)
    const activeBlocks = blocks.filter(block => !block.isGap && block.totalTokens > 0);

    if (activeBlocks.length === 0) return 0;

    // Get the most recent active session
    const currentSession = activeBlocks[activeBlocks.length - 1];

    // Check if this session is still active (within last 30 minutes)
    const now = new Date();
    const sessionEnd = currentSession.actualEndTime ?
      new Date(currentSession.actualEndTime) : now;
    const timeSinceEnd = now.getTime() - sessionEnd.getTime();
    const thirtyMinutes = 30 * 60 * 1000;

    if (timeSinceEnd <= thirtyMinutes) {
      // This is the current active session
      return currentSession.totalTokens;
    } else {
      // No active session, return today's total as fallback
      const today = new Date().toISOString().split('T')[0];
      return blocks
        .filter(block =>
          !block.isGap &&
          block.startTime.includes(today)
        )
        .reduce((total, block) => total + block.totalTokens, 0);
    }
  }

  /**
   * Calculate current task tokens based on actual task start time
   */
  private async calculateTaskTokens(blocks: CcusageBlock[]): Promise<number> {
    try {
      // Read current task info
      const taskData = await fs.readFile('.claude/state/current_task.json', 'utf-8');
      const task = JSON.parse(taskData);

      if (!task.created_at) {
        console.warn('No task start time found, using session estimation');
        return this.estimateTaskFromSession(blocks);
      }

      // Parse task start time (format: "2025-09-26 07:48:34")
      // Convert local time to UTC for comparison with ccusage
      const taskStartTime = new Date(task.created_at.replace(' ', 'T'));

      // Find current active session
      const activeBlocks = blocks.filter(block => !block.isGap && block.totalTokens > 0);
      if (activeBlocks.length === 0) return 0;

      const currentSession = activeBlocks[activeBlocks.length - 1];
      const sessionStart = new Date(currentSession.startTime);
      const sessionEnd = currentSession.actualEndTime ?
        new Date(currentSession.actualEndTime) : new Date();

      // If task started before current session, task tokens = entire session
      if (taskStartTime <= sessionStart) {
        return currentSession.totalTokens;
      }

      // If task started during current session, calculate proportional tokens
      if (taskStartTime >= sessionStart && taskStartTime <= sessionEnd) {
        const sessionDuration = sessionEnd.getTime() - sessionStart.getTime();
        const taskDuration = sessionEnd.getTime() - taskStartTime.getTime();

        if (sessionDuration <= 0) return 0;

        // Proportional calculation based on time
        const taskProportion = taskDuration / sessionDuration;
        return Math.floor(currentSession.totalTokens * Math.min(taskProportion, 1.0));
      }

      // Task started after session (shouldn't happen, but fallback)
      return 0;

    } catch (error) {
      console.error('Error calculating task tokens:', error);
      return this.estimateTaskFromSession(blocks);
    }
  }

  /**
   * Fallback estimation when task data unavailable
   */
  private estimateTaskFromSession(blocks: CcusageBlock[]): number {
    const activeBlocks = blocks.filter(block => !block.isGap && block.totalTokens > 0);
    if (activeBlocks.length === 0) return 0;

    const currentSession = activeBlocks[activeBlocks.length - 1];
    // Conservative estimate: 30% of session for current task
    return Math.floor(currentSession.totalTokens * 0.3);
  }

  /**
   * Calculate burn rate from active blocks
   */
  private calculateBurnRate(blocks: CcusageBlock[]): number {
    const activeBlocks = blocks.filter(block => !block.isGap && block.totalTokens > 0);

    if (activeBlocks.length === 0) return 0;

    // Calculate tokens per minute from recent activity
    const recentBlock = activeBlocks[activeBlocks.length - 1];
    if (!recentBlock.actualEndTime) return 0;

    const start = new Date(recentBlock.startTime);
    const end = new Date(recentBlock.actualEndTime);
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

    return durationMinutes > 0 ? recentBlock.totalTokens / durationMinutes : 0;
  }

  /**
   * Estimate plan limit based on usage patterns
   */
  private estimatePlanLimit(blocks: CcusageBlock[]): number {
    const dailyTotals = this.getDailyTotals(blocks);
    const maxDaily = Math.max(...Object.values(dailyTotals));

    // Estimate plan based on peak daily usage
    if (maxDaily > 100000) return this.planLimits.max20;
    if (maxDaily > 20000) return this.planLimits.max5;
    return this.planLimits.pro;
  }

  /**
   * Get daily usage totals for pattern analysis
   */
  private getDailyTotals(blocks: CcusageBlock[]): Record<string, number> {
    const dailyTotals: Record<string, number> = {};

    blocks.forEach(block => {
      if (block.isGap) return;

      const date = block.startTime.split('T')[0];
      dailyTotals[date] = (dailyTotals[date] || 0) + block.totalTokens;
    });

    return dailyTotals;
  }

  /**
   * Format token count for display
   */
  private formatTokens(count: number): string {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(2)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  }

  /**
   * Get comprehensive usage data
   */
  async getUsageData(): Promise<TokenUsageData> {
    const rawData = await this.getRawUsage();

    if (!rawData || !rawData.blocks) {
      // Fallback to cached data or estimates
      return this.getFallbackUsageData();
    }

    const blocks = rawData.blocks;
    const sessionTokens = this.calculateSessionTokens(blocks);
    const taskTokens = await this.calculateTaskTokens(blocks);
    const burnRate = this.calculateBurnRate(blocks);
    const totalCost = blocks.reduce((sum, block) => sum + block.costUSD, 0);
    const planLimit = this.estimatePlanLimit(blocks);
    const remainingTokens = planLimit - sessionTokens;

    let projectedExhaustion: Date | null = null;
    if (burnRate > 0 && remainingTokens > 0) {
      const minutesToExhaustion = remainingTokens / burnRate;
      projectedExhaustion = new Date(Date.now() + minutesToExhaustion * 60 * 1000);
    }

    return {
      sessionTokens,
      taskTokens,
      burnRate,
      costUSD: totalCost,
      planLimit,
      remainingTokens,
      projectedExhaustion
    };
  }

  /**
   * Fallback usage data when ccusage unavailable
   */
  private async getFallbackUsageData(): Promise<TokenUsageData> {
    try {
      const cached = await fs.readFile(this.tokenStateFile, 'utf-8');
      const data = JSON.parse(cached);

      return {
        sessionTokens: data.session?.total || 0,
        taskTokens: data.task?.current || 0,
        burnRate: 0,
        costUSD: 0,
        planLimit: this.planLimits.custom_max,
        remainingTokens: this.planLimits.custom_max,
        projectedExhaustion: null
      };
    } catch {
      return {
        sessionTokens: 0,
        taskTokens: 0,
        burnRate: 0,
        costUSD: 0,
        planLimit: this.planLimits.custom_max,
        remainingTokens: this.planLimits.custom_max,
        projectedExhaustion: null
      };
    }
  }

  /**
   * Update footer data with real-time usage
   */
  async updateFooter(): Promise<FooterTokenData> {
    const usage = await this.getUsageData();

    const footerData: FooterTokenData = {
      session: {
        total: usage.sessionTokens,
        formatted: this.formatTokens(usage.sessionTokens)
      },
      task: {
        current: usage.taskTokens,
        formatted: this.formatTokens(usage.taskTokens)
      },
      burnRate: usage.burnRate,
      costUSD: usage.costUSD
    };

    // Persist data for fallback
    await this.persistUsageData(footerData);

    return footerData;
  }

  /**
   * Persist usage data to state file
   */
  private async persistUsageData(data: FooterTokenData): Promise<void> {
    try {
      const stateData = {
        session: {
          total: data.session.total,
          timestamp: new Date().toISOString()
        },
        task: {
          current: data.task.current,
          timestamp: new Date().toISOString()
        },
        burnRate: data.burnRate,
        costUSD: data.costUSD,
        lastUpdate: new Date().toISOString()
      };

      // Ensure directory exists
      const dir = path.dirname(this.tokenStateFile);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(this.tokenStateFile, JSON.stringify(stateData, null, 2));
    } catch (error) {
      console.error('Failed to persist usage data:', error);
    }
  }

  /**
   * Get quick token counts for footer display WITHOUT caching for real-time debug
   */
  async getQuickTokenCounts(): Promise<{ session: string; task: string }> {
    try {
      const footerData = await this.updateFooter();
      return {
        session: footerData.session.formatted,
        task: footerData.task.formatted
      };
    } catch (error) {
      console.error('Quick token fetch failed:', error);
      return { session: '0', task: '0' };
    }
  }
}

// Export singleton instance
export const tokenMonitor = new RealTimeTokenMonitor();