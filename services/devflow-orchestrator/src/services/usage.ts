/**
 * Usage Tracking Service
 * Records and monitors API usage for DevFlow orchestrator
 */

import { promises as fs } from 'fs';
import { join } from 'path';

export interface UsageRecord {
  id: string;
  provider: string;
  agentType: 'code' | 'reasoning' | 'context' | 'auto';
  model?: string;
  durationMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  createdAt: string;
}

export interface UsageStats {
  totalRequests: number;
  totalCost: number;
  totalTokensIn: number;
  totalTokensOut: number;
  averageResponseTime: number;
  requestsByProvider: Record<string, number>;
  requestsByAgent: Record<string, number>;
}

/**
 * Simple in-memory usage tracking with file persistence
 */
class UsageTracker {
  private records: UsageRecord[] = [];
  private usageFilePath: string;

  constructor() {
    // Store usage data in a simple JSON file
    this.usageFilePath = join(process.cwd(), '.claude/state/usage-tracking.json');
    this.loadUsageData();
  }

  private async loadUsageData(): Promise<void> {
    try {
      const data = await fs.readFile(this.usageFilePath, 'utf-8');
      this.records = JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is invalid, start with empty records
      this.records = [];
    }
  }

  private async saveUsageData(): Promise<void> {
    try {
      // Ensure directory exists
      const dir = join(process.cwd(), '.claude/state');
      await fs.mkdir(dir, { recursive: true });
      
      // Keep only last 10000 records to prevent infinite growth
      const recentRecords = this.records.slice(-10000);
      await fs.writeFile(this.usageFilePath, JSON.stringify(recentRecords, null, 2));
    } catch (error) {
      console.error('Failed to save usage data:', error);
    }
  }

  public async recordUsage(record: UsageRecord): Promise<void> {
    this.records.push(record);
    
    // Save to file (async, don't block)
    this.saveUsageData().catch(console.error);
    
    // Optional: Log to console for debugging
    if (process.env.DEVFLOW_LOG_USAGE === '1') {
      console.log(`📊 Usage recorded: ${record.provider}/${record.agentType} - ${record.durationMs}ms`);
    }
  }

  public getUsageStats(since?: Date): UsageStats {
    const relevantRecords = since 
      ? this.records.filter(r => new Date(r.createdAt) >= since)
      : this.records;

    if (relevantRecords.length === 0) {
      return {
        totalRequests: 0,
        totalCost: 0,
        totalTokensIn: 0,
        totalTokensOut: 0,
        averageResponseTime: 0,
        requestsByProvider: {},
        requestsByAgent: {}
      };
    }

    const stats: UsageStats = {
      totalRequests: relevantRecords.length,
      totalCost: relevantRecords.reduce((sum, r) => sum + (r.costUsd || 0), 0),
      totalTokensIn: relevantRecords.reduce((sum, r) => sum + (r.tokensIn || 0), 0),
      totalTokensOut: relevantRecords.reduce((sum, r) => sum + (r.tokensOut || 0), 0),
      averageResponseTime: relevantRecords.reduce((sum, r) => sum + (r.durationMs || 0), 0) / relevantRecords.length,
      requestsByProvider: {},
      requestsByAgent: {}
    };

    // Count by provider
    relevantRecords.forEach(record => {
      stats.requestsByProvider[record.provider] = (stats.requestsByProvider[record.provider] || 0) + 1;
      stats.requestsByAgent[record.agentType] = (stats.requestsByAgent[record.agentType] || 0) + 1;
    });

    return stats;
  }

  public getTodayStats(): UsageStats {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.getUsageStats(today);
  }

  public getRecentRecords(limit: number = 100): UsageRecord[] {
    return this.records.slice(-limit);
  }
}

// Singleton instance
const usageTracker = new UsageTracker();

// Export convenience functions
export function recordUsage(record: UsageRecord): Promise<void> {
  return usageTracker.recordUsage(record);
}

export function getUsageStats(since?: Date): UsageStats {
  return usageTracker.getUsageStats(since);
}

export function getTodayStats(): UsageStats {
  return usageTracker.getTodayStats();
}

export function getRecentRecords(limit?: number): UsageRecord[] {
  return usageTracker.getRecentRecords(limit);
}

export default {
  recordUsage,
  getUsageStats,
  getTodayStats,
  getRecentRecords,
  UsageTracker
};