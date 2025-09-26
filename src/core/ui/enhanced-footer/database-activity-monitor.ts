/**
 * Database Activity Monitor
 * Real-time monitoring of Cometa Brain DB R/W operations
 */

import { EventEmitter } from 'events';
import * as sqlite3 from 'sqlite3';
import { DBActivity, FOOTER_COLORS } from './types/enhanced-footer-types.js';
import * as fs from 'fs';
import * as path from 'path';

export class DatabaseActivityMonitor extends EventEmitter {
  private dbPath: string;
  private activityState: DBActivity;
  private monitorInterval: NodeJS.Timeout | null = null;
  private readOperationsCount = 0;
  private writeOperationsCount = 0;
  private lastReadTime: Date | null = null;
  private lastWriteTime: Date | null = null;
  private isInitialized = false;

  constructor(dbPath: string = './data/devflow_unified.sqlite') {
    super();
    this.dbPath = dbPath;
    this.activityState = this.initializeState();
  }

  private initializeState(): DBActivity {
    const now = new Date();
    return {
      reads: {
        active: false,
        lastActivity: now,
        operationsCount: 0,
        operationsPerMinute: 0
      },
      writes: {
        active: false,
        lastActivity: now,
        operationsCount: 0,
        operationsPerMinute: 0
      },
      timestamp: now
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Verifica che il database esista
      if (!fs.existsSync(this.dbPath)) {
        throw new Error(`Database not found at ${this.dbPath}`);
      }

      console.log(`🔗 Database Activity Monitor initialized for ${this.dbPath}`);
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Database Activity Monitor:', error);
      throw error;
    }
  }

  start(): void {
    if (!this.isInitialized) {
      throw new Error('Monitor not initialized. Call initialize() first.');
    }

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    // Monitor activity every 2 seconds
    this.monitorInterval = setInterval(() => {
      this.checkActivity();
    }, 2000);

    console.log(`🚀 Database Activity Monitor started - monitoring every 2 seconds`);
  }

  stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    console.log('⏹️ Database Activity Monitor stopped');
  }

  private async checkActivity(): Promise<void> {
    try {
      const now = new Date();

      // Query audit_log per attività recenti (ultimi 2 minuti)
      const recentActivity = await this.getRecentActivity();

      // Calcola operazioni per minuto
      const readOpsPerMinute = this.calculateOperationsPerMinute(recentActivity.reads);
      const writeOpsPerMinute = this.calculateOperationsPerMinute(recentActivity.writes);

      // Determina se le operazioni sono attive (se ci sono state operazioni negli ultimi 5 secondi)
      const readActive = recentActivity.reads > 0 &&
        this.lastReadTime &&
        (now.getTime() - this.lastReadTime.getTime()) < 5000;

      const writeActive = recentActivity.writes > 0 &&
        this.lastWriteTime &&
        (now.getTime() - this.lastWriteTime.getTime()) < 5000;

      // Aggiorna stato
      this.activityState = {
        reads: {
          active: readActive,
          lastActivity: this.lastReadTime || this.activityState.reads.lastActivity,
          operationsCount: this.readOperationsCount,
          operationsPerMinute: readOpsPerMinute
        },
        writes: {
          active: writeActive,
          lastActivity: this.lastWriteTime || this.activityState.writes.lastActivity,
          operationsCount: this.writeOperationsCount,
          operationsPerMinute: writeOpsPerMinute
        },
        timestamp: now
      };

      // Emit event con nuovo stato
      this.emit('activityUpdate', this.activityState);

    } catch (error) {
      console.error('Error checking database activity:', error);
      this.emit('error', error);
    }
  }

  private async getRecentActivity(): Promise<{ reads: number; writes: number }> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY);

      const query = `
        SELECT
          operation,
          COUNT(*) as count
        FROM audit_log
        WHERE created_at > datetime('now', '-2 minutes')
        GROUP BY operation
      `;

      db.all(query, [], (err, rows: any[]) => {
        db.close();

        if (err) {
          reject(err);
          return;
        }

        let reads = 0;
        let writes = 0;

        rows.forEach(row => {
          if (row.operation === 'SELECT' || row.operation === 'READ') {
            reads = row.count;
            this.readOperationsCount += row.count;
            this.lastReadTime = new Date();
          } else if (row.operation === 'INSERT' || row.operation === 'UPDATE' || row.operation === 'DELETE') {
            writes = row.count;
            this.writeOperationsCount += row.count;
            this.lastWriteTime = new Date();
          }
        });

        resolve({ reads, writes });
      });
    });
  }

  private calculateOperationsPerMinute(recentOps: number): number {
    // Calcolo semplificato: operazioni recenti * 30 (per estrapolare a minuto da 2 secondi)
    return Math.round(recentOps * 30);
  }

  getCurrentActivity(): DBActivity {
    return { ...this.activityState };
  }

  getStatusIndicators(): { read: string; write: string } {
    const readIndicator = this.activityState.reads.active
      ? `${FOOTER_COLORS.R_ACTIVE}R:●${FOOTER_COLORS.RESET}`
      : `${FOOTER_COLORS.R_IDLE}R:○${FOOTER_COLORS.RESET}`;

    const writeIndicator = this.activityState.writes.active
      ? `${FOOTER_COLORS.W_ACTIVE}W:●${FOOTER_COLORS.RESET}`
      : `${FOOTER_COLORS.W_IDLE}W:○${FOOTER_COLORS.RESET}`;

    return { read: readIndicator, write: writeIndicator };
  }

  destroy(): void {
    this.stop();
    this.removeAllListeners();
  }
}