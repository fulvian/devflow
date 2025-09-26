/**
 * Token Usage Tracker
 * Real-time tracking of session and task-specific token consumption
 */

import { EventEmitter } from 'events';
import { TokenMetrics, FOOTER_COLORS } from './types/enhanced-footer-types.js';
import * as fs from 'fs';
import * as path from 'path';

export class TokenUsageTracker extends EventEmitter {
  private tokenState: TokenMetrics;
  private sessionStartTime: Date;
  private currentTaskStartTime: Date;
  private sessionTokenCount = 0;
  private taskTokenCount = 0;
  private tokenHistory: number[] = [];
  private isInitialized = false;

  constructor() {
    super();
    this.sessionStartTime = new Date();
    this.currentTaskStartTime = new Date();
    this.tokenState = this.initializeState();
  }

  private initializeState(): TokenMetrics {
    return {
      session: {
        total: 0,
        average: 0,
        peak: 0,
        startTime: this.sessionStartTime
      },
      task: {
        current: 0,
        estimated: 0,
        efficiency: 0,
        taskStartTime: this.currentTaskStartTime
      },
      timestamp: new Date()
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Carica stato esistente se disponibile
      await this.loadExistingState();
      console.log(`📊 Token Usage Tracker initialized`);
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Token Usage Tracker:', error);
      throw error;
    }
  }

  private async loadExistingState(): Promise<void> {
    try {
      const stateFile = '.devflow/token-usage-state.json';

      if (fs.existsSync(stateFile)) {
        const savedState = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));

        // Recupera il token count della sessione corrente se la sessione è stata avviata oggi
        const today = new Date().toDateString();
        const savedDate = new Date(savedState.session?.startTime || 0).toDateString();

        if (savedDate === today) {
          this.sessionTokenCount = savedState.session?.total || 0;
          this.tokenHistory = savedState.tokenHistory || [];
        }
      }
    } catch (error) {
      console.log('No previous token state found, starting fresh');
    }
  }

  addTokenUsage(tokens: number, context: 'session' | 'task' | 'both' = 'both'): void {
    if (!this.isInitialized) {
      console.warn('TokenUsageTracker not initialized');
      return;
    }

    const now = new Date();

    if (context === 'session' || context === 'both') {
      this.sessionTokenCount += tokens;
      this.tokenHistory.push(tokens);

      // Mantieni solo gli ultimi 100 utilizzi per il calcolo della media
      if (this.tokenHistory.length > 100) {
        this.tokenHistory = this.tokenHistory.slice(-100);
      }
    }

    if (context === 'task' || context === 'both') {
      this.taskTokenCount += tokens;
    }

    this.updateMetrics(now);
    this.saveState();

    this.emit('tokenUsage', {
      amount: tokens,
      context,
      timestamp: now,
      metrics: this.tokenState
    });
  }

  private updateMetrics(timestamp: Date): void {
    // Calcolo metriche sessione
    const sessionDurationMinutes = Math.max(1, (timestamp.getTime() - this.sessionStartTime.getTime()) / 1000 / 60);
    const sessionAverage = Math.round(this.sessionTokenCount / sessionDurationMinutes);
    const sessionPeak = Math.max(...this.tokenHistory, 0);

    // Calcolo metriche task
    const taskDurationMinutes = Math.max(1, (timestamp.getTime() - this.currentTaskStartTime.getTime()) / 1000 / 60);
    const taskEfficiency = this.taskTokenCount > 0 ? Math.round((this.getTaskProgress() / this.taskTokenCount) * 100) : 0;
    const taskEstimated = this.estimateRemainingTokens();

    this.tokenState = {
      session: {
        total: this.sessionTokenCount,
        average: sessionAverage,
        peak: sessionPeak,
        startTime: this.sessionStartTime
      },
      task: {
        current: this.taskTokenCount,
        estimated: taskEstimated,
        efficiency: taskEfficiency,
        taskStartTime: this.currentTaskStartTime
      },
      timestamp
    };
  }

  private getTaskProgress(): number {
    // Prova a leggere il progress dal footer-state.json
    try {
      const footerStateFile = '.devflow/footer-state.json';
      if (fs.existsSync(footerStateFile)) {
        const footerState = JSON.parse(fs.readFileSync(footerStateFile, 'utf-8'));
        return parseInt(footerState.progress?.replace('%', '') || '0');
      }
    } catch (error) {
      // Fallback
    }
    return 0;
  }

  private estimateRemainingTokens(): number {
    const currentProgress = this.getTaskProgress();
    if (currentProgress === 0 || this.taskTokenCount === 0) return 0;

    const tokensPerPercent = this.taskTokenCount / currentProgress;
    const remainingProgress = 100 - currentProgress;
    return Math.round(tokensPerPercent * remainingProgress);
  }

  resetTaskTokens(): void {
    this.taskTokenCount = 0;
    this.currentTaskStartTime = new Date();
    console.log('🔄 Task token counter reset');
  }

  getCurrentMetrics(): TokenMetrics {
    return { ...this.tokenState };
  }

  getFormattedDisplay(): { session: string; task: string } {
    const sessionDisplay = `${FOOTER_COLORS.TOKEN_SESSION}Session:${this.formatTokenCount(this.tokenState.session.total)}${FOOTER_COLORS.RESET}`;
    const taskDisplay = `${FOOTER_COLORS.TOKEN_TASK}Task:${this.formatTokenCount(this.tokenState.task.current)}${FOOTER_COLORS.RESET}`;

    return { session: sessionDisplay, task: taskDisplay };
  }

  private formatTokenCount(count: number): string {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    } else {
      return count.toString();
    }
  }

  private saveState(): void {
    try {
      const stateDir = '.devflow';
      if (!fs.existsSync(stateDir)) {
        fs.mkdirSync(stateDir, { recursive: true });
      }

      const state = {
        session: this.tokenState.session,
        task: this.tokenState.task,
        tokenHistory: this.tokenHistory,
        lastSaved: new Date().toISOString()
      };

      fs.writeFileSync(
        path.join(stateDir, 'token-usage-state.json'),
        JSON.stringify(state, null, 2)
      );
    } catch (error) {
      console.error('Failed to save token state:', error);
    }
  }

  destroy(): void {
    this.saveState();
    this.removeAllListeners();
  }
}