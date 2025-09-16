/**
 * Qwen CLI Quota Monitor
 *
 * Leverages Qwen CLI's generous 1000 req/day limits with conservative fallback trigger.
 * Supports both hosted and local deployment monitoring with performance metrics.
 *
 * FEATURES:
 * - 1000 req/day quota tracking (most generous among CLI tools)
 * - Conservative fallback trigger at 900 requests (90% threshold)
 * - Local deployment monitoring support for self-hosting scenarios
 * - Performance metrics collection (response time, success rate)
 * - Integration with atomic fallback system to Qwen 3 Synthetic
 * - Support for both hosted and local Qwen deployments
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { MonitoredPlatform, MultiPlatformUsageMonitor } from './multi-platform-usage-monitor';

/**
 * Defines the structure for Qwen CLI deployment types.
 */
export enum QwenDeploymentType {
  HOSTED = 'hosted',
  LOCAL = 'local',
  SELF_HOSTED = 'self_hosted'
}

/**
 * Defines the structure for Qwen CLI performance metrics.
 */
export interface QwenPerformanceMetrics {
  averageResponseTime: number; // in milliseconds
  successRate: number; // percentage (0-100)
  totalRequests: number;
  failedRequests: number;
  lastUpdated: string; // ISO timestamp
}

/**
 * Defines the structure for Qwen CLI usage statistics.
 */
export interface QwenUsageStats {
  requestsToday: number;
  totalRequests: number;
  tokensUsed: {
    input: number;
    output: number;
  };
  deploymentType: QwenDeploymentType;
  performanceMetrics: QwenPerformanceMetrics;
  quotaRemaining: number;
  lastReset: string; // ISO timestamp
}

/**
 * Defines the structure for parsed Qwen CLI log entries.
 */
export interface QwenLogEntry {
  timestamp: string;
  level: string;
  message: string;
  requestId?: string;
  model?: string;
  responseTime?: number;
  success?: boolean;
  tokens?: {
    input: number;
    output: number;
  };
}

/**
 * Qwen CLI Quota Monitor
 *
 * Monitors usage for Qwen CLI with its generous 1000 req/day limit and provides
 * conservative fallback recommendations at 900 requests to preserve capacity.
 */
export class QwenCliMonitor {
  private readonly logDirectory: string;
  private readonly configDirectory: string;
  private readonly monitor: MultiPlatformUsageMonitor;
  private readonly deploymentType: QwenDeploymentType;
  private lastStatsUpdate: number = 0;
  private statsCache: QwenUsageStats | null = null;
  private performanceCache: QwenPerformanceMetrics | null = null;

  // Cache duration: 2 minutes (shorter than Gemini for more precise monitoring)
  private static readonly STATS_CACHE_DURATION = 2 * 60 * 1000;
  private static readonly DAILY_QUOTA = 1000;
  private static readonly FALLBACK_THRESHOLD = 900; // 90% threshold for conservative fallback

  constructor(monitor: MultiPlatformUsageMonitor, deploymentType: QwenDeploymentType = QwenDeploymentType.HOSTED) {
    this.logDirectory = path.join(homedir(), '.qwen', 'logs');
    this.configDirectory = path.join(homedir(), '.qwen');
    this.monitor = monitor;
    this.deploymentType = deploymentType;

    this.ensureQwenPlatformRegistered();
    this.initializePerformanceTracking();
  }

  /**
   * Ensures the QwenCLI platform is registered in the MultiPlatformUsageMonitor.
   */
  private ensureQwenPlatformRegistered(): void {
    try {
      this.monitor.getThresholds(MonitoredPlatform.QwenCLI);
    } catch (error) {
      console.warn('QwenCLI platform not registered in MultiPlatformUsageMonitor');
    }
  }

  /**
   * Initializes performance tracking metrics.
   */
  private initializePerformanceTracking(): void {
    this.performanceCache = {
      averageResponseTime: 0,
      successRate: 100,
      totalRequests: 0,
      failedRequests: 0,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Determines the appropriate command based on deployment type.
   * @returns Command string for Qwen CLI
   */
  private getQwenCommand(): string {
    switch (this.deploymentType) {
      case QwenDeploymentType.LOCAL:
        return 'qwen-local';
      case QwenDeploymentType.SELF_HOSTED:
        return 'qwen-server';
      case QwenDeploymentType.HOSTED:
      default:
        return 'qwen';
    }
  }

  /**
   * Executes Qwen CLI stats command and parses the output.
   * @returns Promise resolving to parsed usage statistics
   */
  private async executeStatsCommand(): Promise<QwenUsageStats> {
    return new Promise((resolve, reject) => {
      const command = this.getQwenCommand();
      const startTime = Date.now();

      const child = spawn(command, ['stats'], {
        env: { ...process.env },
        timeout: 15000 // 15 second timeout (longer for potential local deployments)
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        const responseTime = Date.now() - startTime;

        if (code !== 0) {
          this.updatePerformanceMetrics(responseTime, false);
          reject(new Error(`Qwen stats command failed with exit code ${code}: ${stderr}`));
          return;
        }

        try {
          const data = JSON.parse(stdout);
          this.updatePerformanceMetrics(responseTime, true);

          const stats: QwenUsageStats = {
            requestsToday: data.requestsToday || 0,
            totalRequests: data.totalRequests || 0,
            tokensUsed: {
              input: data.tokensUsed?.input || 0,
              output: data.tokensUsed?.output || 0
            },
            deploymentType: this.deploymentType,
            performanceMetrics: this.performanceCache!,
            quotaRemaining: Math.max(0, QwenCliMonitor.DAILY_QUOTA - (data.requestsToday || 0)),
            lastReset: data.lastReset || new Date().toISOString()
          };

          resolve(stats);
        } catch (parseError) {
          this.updatePerformanceMetrics(responseTime, false);
          reject(new Error(`Failed to parse Qwen stats output: ${parseError instanceof Error ? parseError.message : String(parseError)}`));
        }
      });

      child.on('error', (error) => {
        const responseTime = Date.now() - startTime;
        this.updatePerformanceMetrics(responseTime, false);
        reject(new Error(`Failed to execute Qwen stats command: ${error.message}`));
      });
    });
  }

  /**
   * Updates performance metrics based on command execution results.
   * @param responseTime Response time in milliseconds
   * @param success Whether the command was successful
   */
  private updatePerformanceMetrics(responseTime: number, success: boolean): void {
    if (!this.performanceCache) {
      this.initializePerformanceTracking();
    }

    const metrics = this.performanceCache!;
    const totalRequests = metrics.totalRequests + 1;
    const failedRequests = success ? metrics.failedRequests : metrics.failedRequests + 1;

    // Calculate rolling average response time
    const newAverageResponseTime =
      (metrics.averageResponseTime * metrics.totalRequests + responseTime) / totalRequests;

    // Calculate success rate
    const newSuccessRate = ((totalRequests - failedRequests) / totalRequests) * 100;

    this.performanceCache = {
      averageResponseTime: Math.round(newAverageResponseTime),
      successRate: Math.round(newSuccessRate * 100) / 100, // Round to 2 decimal places
      totalRequests,
      failedRequests,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Parses log files from ~/.qwen/logs to extract usage data.
   * @returns Promise resolving to parsed log entries
   */
  private async parseLogFiles(): Promise<QwenLogEntry[]> {
    const logEntries: QwenLogEntry[] = [];

    if (!fs.existsSync(this.logDirectory)) {
      return logEntries;
    }

    try {
      const files = fs.readdirSync(this.logDirectory);
      const logFiles = files.filter(file => file.endsWith('.log')).sort();

      // Process the most recent log files
      for (const file of logFiles.slice(-3)) { // Last 3 log files for Qwen
        const filePath = path.join(this.logDirectory, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
          if (line.trim() === '') continue;

          try {
            const entry: QwenLogEntry = JSON.parse(line);
            // Include all relevant entries for Qwen
            if (entry.message &&
                (entry.message.includes('request') ||
                 entry.message.includes('completion') ||
                 entry.message.includes('response'))) {
              logEntries.push(entry);
            }
          } catch (parseError) {
            // Skip malformed log entries
            continue;
          }
        }
      }
    } catch (error) {
      console.error('Error parsing Qwen log files:', error);
    }

    return logEntries;
  }

  /**
   * Calculates usage statistics from log entries when CLI command fails.
   * @param logEntries Parsed log entries
   * @returns Calculated usage statistics
   */
  private calculateStatsFromLogs(logEntries: QwenLogEntry[]): QwenUsageStats {
    const today = new Date().toISOString().split('T')[0];
    let requestsToday = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalResponseTime = 0;
    let successfulRequests = 0;
    let totalRequestsWithResponseTime = 0;

    for (const entry of logEntries) {
      // Check if entry is from today
      if (entry.timestamp && entry.timestamp.startsWith(today)) {
        requestsToday++;
      }

      // Track token usage
      if (entry.tokens) {
        totalInputTokens += entry.tokens.input || 0;
        totalOutputTokens += entry.tokens.output || 0;
      }

      // Track performance metrics
      if (entry.responseTime !== undefined) {
        totalResponseTime += entry.responseTime;
        totalRequestsWithResponseTime++;
      }

      if (entry.success === true) {
        successfulRequests++;
      }
    }

    const averageResponseTime = totalRequestsWithResponseTime > 0
      ? Math.round(totalResponseTime / totalRequestsWithResponseTime)
      : 0;

    const successRate = logEntries.length > 0
      ? (successfulRequests / logEntries.length) * 100
      : 100;

    // Update performance cache
    this.performanceCache = {
      averageResponseTime,
      successRate: Math.round(successRate * 100) / 100,
      totalRequests: logEntries.length,
      failedRequests: logEntries.length - successfulRequests,
      lastUpdated: new Date().toISOString()
    };

    return {
      requestsToday,
      totalRequests: logEntries.length,
      tokensUsed: {
        input: totalInputTokens,
        output: totalOutputTokens
      },
      deploymentType: this.deploymentType,
      performanceMetrics: this.performanceCache,
      quotaRemaining: Math.max(0, QwenCliMonitor.DAILY_QUOTA - requestsToday),
      lastReset: new Date().toISOString()
    };
  }

  /**
   * Gets current usage statistics, using cached data when appropriate.
   * @returns Promise resolving to current usage statistics
   */
  public async getUsageStats(): Promise<QwenUsageStats> {
    const now = Date.now();

    // Use cached data if it's still fresh
    if (this.statsCache && (now - this.lastStatsUpdate) < QwenCliMonitor.STATS_CACHE_DURATION) {
      return this.statsCache;
    }

    try {
      // Try to get stats from the CLI command first
      const stats = await this.executeStatsCommand();
      this.statsCache = stats;
      this.lastStatsUpdate = now;
      return stats;
    } catch (error) {
      // Fall back to log parsing if command fails
      console.warn('Failed to execute Qwen stats command, falling back to log parsing:', error);
      const logEntries = await this.parseLogFiles();
      const stats = this.calculateStatsFromLogs(logEntries);

      this.statsCache = stats;
      this.lastStatsUpdate = now;
      return stats;
    }
  }

  /**
   * Records usage in the MultiPlatformUsageMonitor.
   * @param requestCount Number of requests to record (default: 1)
   */
  public recordUsage(requestCount: number = 1): void {
    this.monitor.recordUsage(MonitoredPlatform.QwenCLI, requestCount);
  }

  /**
   * Checks if usage is within limits and suggests fallback when approaching threshold.
   * @returns Promise resolving to usage check result
   */
  public async checkUsage(): Promise<{ allow: boolean; reason: string; fallback: boolean; requestsToday: number; quotaRemaining: number }> {
    const stats = await this.getUsageStats();

    // Record usage in the monitor
    this.recordUsage(stats.requestsToday);

    // Check usage through the monitor
    const usageResult = this.monitor.checkUsage(MonitoredPlatform.QwenCLI);

    return {
      allow: usageResult.allow,
      reason: usageResult.reason,
      fallback: usageResult.fallback,
      requestsToday: stats.requestsToday,
      quotaRemaining: stats.quotaRemaining
    };
  }

  /**
   * Checks if we're approaching the conservative fallback threshold (900 requests).
   * @returns Promise resolving to fallback recommendation
   */
  public async checkFallbackThreshold(): Promise<{ shouldFallback: boolean; remaining: number; threshold: number; percentage: number }> {
    const stats = await this.getUsageStats();
    const remaining = Math.max(0, QwenCliMonitor.FALLBACK_THRESHOLD - stats.requestsToday);
    const percentage = (stats.requestsToday / QwenCliMonitor.DAILY_QUOTA) * 100;
    const shouldFallback = stats.requestsToday >= QwenCliMonitor.FALLBACK_THRESHOLD;

    return {
      shouldFallback,
      remaining,
      threshold: QwenCliMonitor.FALLBACK_THRESHOLD,
      percentage: Math.round(percentage * 100) / 100
    };
  }

  /**
   * Gets performance metrics for the current session.
   * @returns Current performance metrics
   */
  public getPerformanceMetrics(): QwenPerformanceMetrics {
    return this.performanceCache || {
      averageResponseTime: 0,
      successRate: 100,
      totalRequests: 0,
      failedRequests: 0,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Gets a formatted alert message if usage is approaching limits or performance is degraded.
   * @returns Promise resolving to alert message or null if no alert
   */
  public async getUsageAlert(): Promise<string | null> {
    const fallbackCheck = await this.checkFallbackThreshold();
    const performance = this.getPerformanceMetrics();

    // Check fallback threshold (900 requests)
    if (fallbackCheck.shouldFallback) {
      return `⚠️  Qwen CLI approaching fallback threshold: ${fallbackCheck.remaining} requests remaining before conservative fallback to Qwen 3 Synthetic (${fallbackCheck.threshold}/${QwenCliMonitor.DAILY_QUOTA}).`;
    }

    // Check performance issues
    if (performance.successRate < 95) {
      return `⚠️  Qwen CLI performance alert: Success rate is ${performance.successRate}% (below 95%). Consider fallback to Synthetic.`;
    }

    if (performance.averageResponseTime > 10000) { // 10 seconds
      return `⚠️  Qwen CLI performance alert: Average response time is ${performance.averageResponseTime}ms (above 10s). Consider fallback to Synthetic.`;
    }

    // Check general usage limits
    const usageCheck = await this.checkUsage();
    if (!usageCheck.allow) {
      return `❌ Qwen CLI daily quota exceeded: ${usageCheck.reason}`;
    }

    // Early warning at 80%
    if (fallbackCheck.percentage >= 80) {
      return `ℹ️  Qwen CLI usage at ${fallbackCheck.percentage}% of daily quota (${usageCheck.requestsToday}/${QwenCliMonitor.DAILY_QUOTA}). ${usageCheck.quotaRemaining} requests remaining.`;
    }

    return null;
  }

  /**
   * Determines if local deployment is available.
   * @returns Promise resolving to local deployment availability
   */
  public async isLocalDeploymentAvailable(): Promise<boolean> {
    try {
      const command = this.getQwenCommand();
      await new Promise<void>((resolve, reject) => {
        const child = spawn(command, ['--version'], {
          timeout: 5000,
          stdio: 'pipe'
        });

        child.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Command failed with code ${code}`));
        });

        child.on('error', reject);
      });

      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Factory function to create a Qwen CLI monitor
 * @param monitor MultiPlatformUsageMonitor instance
 * @param deploymentType Type of Qwen deployment (default: hosted)
 * @returns New instance of QwenCliMonitor
 */
export function createQwenCliMonitor(
  monitor: MultiPlatformUsageMonitor,
  deploymentType: QwenDeploymentType = QwenDeploymentType.HOSTED
): QwenCliMonitor {
  return new QwenCliMonitor(monitor, deploymentType);
}

export default QwenCliMonitor;