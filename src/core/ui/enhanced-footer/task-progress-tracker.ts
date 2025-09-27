/**
 * Task Progress Tracker
 * Direct queries to Cometa Brain DB for real-time task progress
 */

import { EventEmitter } from 'events';
import * as sqlite3 from 'sqlite3';
import { TaskProgress, FOOTER_COLORS } from './types/enhanced-footer-types.js';
import * as fs from 'fs';

export class TaskProgressTracker extends EventEmitter {
  private dbPath: string;
  private taskState: TaskProgress;
  private progressInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor(dbPath: string = './data/devflow_unified.sqlite') {
    super();
    this.dbPath = dbPath;
    this.taskState = this.initializeState();
  }

  private initializeState(): TaskProgress {
    return {
      name: 'enhanced_footer',
      progress: 0,
      status: 'in_progress',
      pendingCount: 0,
      timestamp: new Date()
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (!fs.existsSync(this.dbPath)) {
        throw new Error(`Database not found at ${this.dbPath}`);
      }

      // Query iniziale per caricare stato corrente
      await this.fetchCurrentTask();
      console.log(`📈 Task Progress Tracker initialized`);
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Task Progress Tracker:', error);
      throw error;
    }
  }

  start(): void {
    if (!this.isInitialized) {
      throw new Error('Tracker not initialized. Call initialize() first.');
    }

    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }

    // Aggiorna progress ogni 10 secondi
    this.progressInterval = setInterval(() => {
      this.fetchCurrentTask().catch(error => {
        console.error('Error fetching task progress:', error);
        this.emit('error', error);
      });
    }, 10000);

    console.log('🚀 Task Progress Tracker started - checking every 10 seconds');
  }

  stop(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    console.log('⏹️ Task Progress Tracker stopped');
  }

  private async fetchCurrentTask(): Promise<void> {
    try {
      const [currentTask, pendingCount] = await Promise.all([
        this.getCurrentTaskFromDB(),
        this.getPendingTaskCount()
      ]);

      const newState: TaskProgress = {
        name: currentTask.name || 'enhanced_footer',
        progress: currentTask.progress || this.calculateProgressFromState(),
        status: (currentTask.status as 'pending' | 'in_progress' | 'completed' | 'cancelled') || 'in_progress',
        pendingCount,
        timestamp: new Date()
      };

      // Emit evento solo se c'è un cambiamento significativo
      if (this.hasSignificantChange(newState)) {
        this.taskState = newState;
        this.emit('progressUpdate', this.taskState);
      }

    } catch (error) {
      console.error('Error fetching current task:', error);
      // Fallback: usa dati dal footer-state.json
      await this.loadFromFooterState();
    }
  }

  private getCurrentTaskFromDB(): Promise<{ name: string; progress: number; status: string }> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY);

      const query = `
        SELECT
          name,
          COALESCE(
            CASE
              WHEN status = 'completed' THEN 100
              WHEN status = 'in_progress' THEN
                CASE
                  WHEN description LIKE '%progress%' THEN
                    CAST(
                      SUBSTR(
                        description,
                        INSTR(description, 'progress') + 10,
                        2
                      ) AS INTEGER
                    )
                  ELSE 50
                END
              ELSE 0
            END, 0
          ) as progress,
          status
        FROM tasks
        WHERE status = 'in_progress'
        ORDER BY updated_at DESC
        LIMIT 1
      `;

      db.get(query, [], (err, row: any) => {
        db.close();

        if (err) {
          reject(err);
          return;
        }

        if (row) {
          resolve({
            name: row.name,
            progress: row.progress,
            status: row.status
          });
        } else {
          // Fallback: task corrente da current_task.json
          resolve(this.getTaskFromCurrentState());
        }
      });
    });
  }

  private getPendingTaskCount(): Promise<number> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY);

      const query = `
        SELECT COUNT(*) as pending_count
        FROM tasks
        WHERE status IN ('pending', 'in_progress')
      `;

      db.get(query, [], (err, row: any) => {
        db.close();

        if (err) {
          reject(err);
          return;
        }

        resolve(row?.pending_count || 0);
      });
    });
  }

  private getTaskFromCurrentState(): { name: string; progress: number; status: string } {
    try {
      const currentTaskPath = '.claude/state/current_task.json';
      if (fs.existsSync(currentTaskPath)) {
        const taskData = JSON.parse(fs.readFileSync(currentTaskPath, 'utf-8'));
        return {
          name: taskData.title || taskData.task || 'enhanced_footer',
          progress: this.calculateProgressFromState(),
          status: taskData.status || 'in_progress'
        };
      }
    } catch (error) {
      console.error('Error reading current task state:', error);
    }

    return {
      name: 'enhanced_footer',
      progress: 85,
      status: 'in_progress'
    };
  }

  private calculateProgressFromState(): number {
    try {
      const footerStatePath = '.devflow/footer-state.json';
      if (fs.existsSync(footerStatePath)) {
        const footerState = JSON.parse(fs.readFileSync(footerStatePath, 'utf-8'));
        const progressStr = footerState.progress;
        if (typeof progressStr === 'string' && progressStr.includes('%')) {
          return parseInt(progressStr.replace('%', ''));
        } else if (typeof progressStr === 'number') {
          return progressStr;
        }
      }
    } catch (error) {
      // Fallback
    }
    return 85; // Default per enhanced_footer
  }

  private async loadFromFooterState(): Promise<void> {
    try {
      const progress = this.calculateProgressFromState();
      const taskData = this.getTaskFromCurrentState();

      this.taskState = {
        name: taskData.name,
        progress,
        status: (taskData.status as 'pending' | 'in_progress' | 'completed' | 'cancelled'),
        pendingCount: this.taskState.pendingCount, // Mantieni valore precedente
        timestamp: new Date()
      };

      this.emit('progressUpdate', this.taskState);
    } catch (error) {
      console.error('Error loading from footer state:', error);
    }
  }

  private hasSignificantChange(newState: TaskProgress): boolean {
    return (
      newState.name !== this.taskState.name ||
      Math.abs(newState.progress - this.taskState.progress) >= 1 ||
      newState.status !== this.taskState.status ||
      newState.pendingCount !== this.taskState.pendingCount
    );
  }

  getCurrentProgress(): TaskProgress {
    return { ...this.taskState };
  }

  getFormattedDisplay(): { task: string; pending: string } {
    const { name, progress } = this.taskState;

    // Colore basato su progress
    let progressColor: string;
    if (progress >= 80) {
      progressColor = FOOTER_COLORS.PROGRESS_HIGH;
    } else if (progress >= 40) {
      progressColor = FOOTER_COLORS.PROGRESS_MID;
    } else {
      progressColor = FOOTER_COLORS.PROGRESS_LOW;
    }

    const taskDisplay = `${FOOTER_COLORS.BOLD}${name}${FOOTER_COLORS.RESET} ${progressColor}${progress}%${FOOTER_COLORS.RESET}`;

    const pendingColor = this.taskState.pendingCount > 0 ? FOOTER_COLORS.PENDING_COUNT : FOOTER_COLORS.DIM;
    const pendingDisplay = `${pendingColor}${this.taskState.pendingCount} pending${FOOTER_COLORS.RESET}`;

    return { task: taskDisplay, pending: pendingDisplay };
  }

  destroy(): void {
    this.stop();
    this.removeAllListeners();
  }
}