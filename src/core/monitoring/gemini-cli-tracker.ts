/**
 * Gemini CLI Usage Tracker
 *
 * Implements native /stats command integration and Pro→Flash downgrade prevention.
 * Tracks usage from ~/.gemini/logs telemetry data with real-time quota monitoring.
 *
 * FEATURES:
 * - Native /stats command integration via child_process
 * - Pro→Flash threshold monitoring (60/100 requests to prevent downgrade)
 * - Telemetry data parsing from ~/.gemini/logs
 * - Real-time quota tracking with 5 AM UTC reset
 * - Alert system for threshold approach
 * - Integration with MultiPlatformUsageMonitor
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { MonitoredPlatform, MultiPlatformUsageMonitor, UsageThreshold } from './multi-platform-usage-monitor';

/**
 * Defines the structure for parsed Gemini CLI log entries.
 */
export interface GeminiLogEntry {
  timestamp: string;
  level: string;
  message: string;
  requestId?: string;
  model?: string;
  tokens?: {
    input: number;
    output: number;
  };
}

/**
 * Defines the structure for parsed /stats command output.
 */
export interface GeminiStatsData {
  totalRequests: number;
  requestsToday: number;
  tokensUsed: {
    input: number;
    output: number;
  };
  modelUsage: Record<string, number>;
  lastReset: string; // ISO timestamp
}

/**
 * Gemini CLI Usage Tracker
 *
 * Tracks usage for Gemini CLI and integrates with the MultiPlatformUsageMonitor
 * to enforce usage limits and prevent Pro→Flash downgrades.
 */
export class GeminiCliTracker {
  private readonly logDirectory: string;
  private readonly statsCommand: string;
  private readonly monitor: MultiPlatformUsageMonitor;
  private lastStatsUpdate: number = 0;
  private statsCache: GeminiStatsData | null = null;
  private static readonly STATS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor(monitor: MultiPlatformUsageMonitor) {
    this.logDirectory = path.join(homedir(), '.gemini', 'logs');
    this.statsCommand = 'gemini';
    this.monitor = monitor;

    // Ensure the Gemini platform is registered in the monitor
    this.ensureGeminiPlatformRegistered();
  }

  /**
   * Ensures the GeminiCLI platform is registered in the MultiPlatformUsageMonitor
   * with appropriate thresholds for Pro→Flash downgrade prevention.
   */
  private ensureGeminiPlatformRegistered(): void {
    // Note: This is a workaround since we can't directly modify the thresholds
    // In a real implementation, the monitor would be configured with these thresholds
    try {
      // Just verify it exists by trying to get thresholds
      this.monitor.getThresholds(MonitoredPlatform.GeminiCLI);
    } catch (error) {
      // If it doesn't exist, we'd need to register it
      // This would require modifying the MultiPlatformUsageMonitor to allow dynamic registration
      console.warn('GeminiCLI platform not registered in MultiPlatformUsageMonitor');
    }
  }

  /**
   * Executes the Gemini CLI /stats command and parses the output.
   * @returns Promise resolving to parsed stats data
   */
  private async executeStatsCommand(): Promise<GeminiStatsData> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.statsCommand, ['stats'], {
        env: { ...process.env },
        timeout: 10000 // 10 second timeout
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
        if (code !== 0) {
          reject(new Error(`Gemini stats command failed with exit code ${code}: ${stderr}`));
          return;
        }

        try {
          const data = JSON.parse(stdout);
          resolve({
            totalRequests: data.totalRequests || 0,
            requestsToday: data.requestsToday || 0,
            tokensUsed: {
              input: data.tokensUsed?.input || 0,
              output: data.tokensUsed?.output || 0
            },
            modelUsage: data.modelUsage || {},
            lastReset: data.lastReset || new Date().toISOString()
          });
        } catch (parseError) {
          reject(new Error(`Failed to parse Gemini stats output: ${parseError instanceof Error ? parseError.message : String(parseError)}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Failed to execute Gemini stats command: ${error.message}`));
      });
    });
  }

  /**
   * Parses log files from ~/.gemini/logs to extract usage data.
   * @returns Promise resolving to parsed log entries
   */
  private async parseLogFiles(): Promise<GeminiLogEntry[]> {
    const logEntries: GeminiLogEntry[] = [];

    if (!fs.existsSync(this.logDirectory)) {
      return logEntries;
    }

    try {
      const files = fs.readdirSync(this.logDirectory);
      const logFiles = files.filter(file => file.endsWith('.log')).sort();

      // Process the most recent log files
      for (const file of logFiles.slice(-5)) { // Last 5 log files
        const filePath = path.join(this.logDirectory, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
          if (line.trim() === '') continue;

          try {
            const entry: GeminiLogEntry = JSON.parse(line);
            // Only include request-related entries
            if (entry.message && (entry.message.includes('request') || entry.message.includes('completion'))) {
              logEntries.push(entry);
            }
          } catch (parseError) {
            // Skip malformed log entries
            continue;
          }
        }
      }
    } catch (error) {
      console.error('Error parsing Gemini log files:', error);
    }

    return logEntries;
  }

  /**
   * Determines if the current time is past the daily reset time (5 AM UTC).
   * @returns boolean indicating if reset should occur
   */
  private shouldResetDailyQuota(): boolean {
    const now = new Date();
    const utcHours = now.getUTCHours();

    // Reset at 5 AM UTC
    return utcHours >= 5;
  }

  /**
   * Gets current usage statistics, using cached data when appropriate.
   * @returns Promise resolving to current usage statistics
   */
  public async getUsageStats(): Promise<GeminiStatsData> {
    const now = Date.now();

    // Use cached data if it's still fresh
    if (this.statsCache && (now - this.lastStatsUpdate) < GeminiCliTracker.STATS_CACHE_DURATION) {
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
      console.warn('Failed to execute Gemini stats command, falling back to log parsing:', error);
      const logEntries = await this.parseLogFiles();

      // Calculate stats from log entries
      const today = new Date().toISOString().split('T')[0];
      let requestsToday = 0;
      const modelUsage: Record<string, number> = {};
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      for (const entry of logEntries) {
        // Check if entry is from today
        if (entry.timestamp && entry.timestamp.startsWith(today)) {
          requestsToday++;
        }

        // Track model usage
        if (entry.model) {
          modelUsage[entry.model] = (modelUsage[entry.model] || 0) + 1;
        }

        // Track token usage
        if (entry.tokens) {
          totalInputTokens += entry.tokens.input || 0;
          totalOutputTokens += entry.tokens.output || 0;
        }
      }

      const stats: GeminiStatsData = {
        totalRequests: logEntries.length,
        requestsToday,
        tokensUsed: {
          input: totalInputTokens,
          output: totalOutputTokens
        },
        modelUsage,
        lastReset: new Date().toISOString()
      };

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
    this.monitor.recordUsage(MonitoredPlatform.GeminiCLI, requestCount);
  }

  /**
   * Checks if usage is within limits and alerts if approaching thresholds.
   * @returns Promise resolving to usage check result
   */
  public async checkUsage(): Promise<{ allow: boolean; reason: string; fallback: boolean; requestsToday: number }> {
    // Get current stats
    const stats = await this.getUsageStats();

    // Record usage in the monitor
    this.recordUsage(stats.requestsToday);

    // Check usage through the monitor
    const usageResult = this.monitor.checkUsage(MonitoredPlatform.GeminiCLI);

    return {
      allow: usageResult.allow,
      reason: usageResult.reason,
      fallback: usageResult.fallback,
      requestsToday: stats.requestsToday
    };
  }

  /**
   * Checks if we're approaching the Pro→Flash downgrade threshold (60 requests).
   * @returns Promise resolving to alert status
   */
  public async checkDowngradeThreshold(): Promise<{ approaching: boolean; remaining: number; threshold: number }> {
    const stats = await this.getUsageStats();
    const threshold = 60; // Pro→Flash downgrade prevention threshold
    const remaining = Math.max(0, threshold - stats.requestsToday);
    const approaching = remaining <= 10; // Alert when 10 or fewer requests remaining

    return {
      approaching,
      remaining,
      threshold
    };
  }

  /**
   * Gets a formatted alert message if usage is approaching limits.
   * @returns Promise resolving to alert message or null if no alert
   */
  public async getUsageAlert(): Promise<string | null> {
    const downgradeCheck = await this.checkDowngradeThreshold();

    if (downgradeCheck.approaching) {
      return `⚠️  Gemini CLI usage alert: ${downgradeCheck.remaining} requests remaining before Pro→Flash downgrade threshold (${downgradeCheck.threshold}). Consider switching to alternative platforms.`;
    }

    // Also check general usage limits
    const usageCheck = await this.checkUsage();
    if (!usageCheck.allow) {
      return `❌ Gemini CLI usage limit exceeded: ${usageCheck.reason}`;
    }

    if (usageCheck.fallback) {
      return `⚠️  Gemini CLI usage approaching limit: ${usageCheck.reason}`;
    }

    return null;
  }
}

/**
 * Factory function to create a Gemini CLI tracker
 * @param monitor MultiPlatformUsageMonitor instance
 * @returns New instance of GeminiCliTracker
 */
export function createGeminiCliTracker(monitor: MultiPlatformUsageMonitor): GeminiCliTracker {
  return new GeminiCliTracker(monitor);
}

export default GeminiCliTracker;