/**
 * Enhanced Footer System - Core Orchestrator
 * Main system that coordinates all footer components
 */

import { EventEmitter } from 'events';
import { FooterState, FooterConfig, TokenMetrics, AgentStatus, DBActivity, TaskProgress, FOOTER_COLORS } from './types/enhanced-footer-types.js';
import { DatabaseActivityMonitor } from './database-activity-monitor.js';
import { TokenUsageTracker } from './token-usage-tracker.js';
import { AgentStatusConnector } from './agent-status-connector.js';
import { TaskProgressTracker } from './task-progress-tracker.js';
import { ASCIIArtRenderer } from './ascii-art-renderer.js';

export class EnhancedFooterSystem extends EventEmitter {
  private config: FooterConfig;
  private state: FooterState;
  private isInitialized = false;
  private isRunning = false;

  // Componenti
  private dbMonitor: DatabaseActivityMonitor;
  private tokenTracker: TokenUsageTracker;
  private agentConnector: AgentStatusConnector;
  private taskTracker: TaskProgressTracker;
  private renderer: ASCIIArtRenderer;

  // Timers
  private renderInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<FooterConfig>) {
    super();
    this.config = this.createConfig(config);
    this.state = this.initializeState();

    // Inizializza componenti
    this.dbMonitor = new DatabaseActivityMonitor(this.config.database.dbPath);
    this.tokenTracker = new TokenUsageTracker();
    this.agentConnector = new AgentStatusConnector(this.config.orchestrator.baseUrl);
    this.taskTracker = new TaskProgressTracker(this.config.database.dbPath);
    this.renderer = new ASCIIArtRenderer();

    this.setupEventHandlers();
  }

  private createConfig(userConfig?: Partial<FooterConfig>): FooterConfig {
    return {
      updateIntervals: {
        dbActivity: 2000,       // 2 secondi
        taskProgress: 10000,    // 10 secondi
        agentStatus: 15000,     // 15 secondi
        tokenCounters: 1000,    // 1 secondo
        pendingTasks: 30000,    // 30 secondi
      },
      display: {
        showAnimations: true,
        compactMode: false,
        maxWidth: 120,
      },
      database: {
        dbPath: './data/devflow_unified.sqlite',
        connectionTimeout: 5000,
      },
      orchestrator: {
        baseUrl: 'http://localhost:3005',
        timeout: 5000,
      },
      ...userConfig
    };
  }

  private initializeState(): FooterState {
    const now = new Date();

    return {
      dbActivity: {
        reads: { active: false, lastActivity: now, operationsCount: 0, operationsPerMinute: 0 },
        writes: { active: false, lastActivity: now, operationsCount: 0, operationsPerMinute: 0 },
        timestamp: now
      },
      tokenMetrics: {
        session: { total: 0, average: 0, peak: 0, startTime: now },
        task: { current: 0, estimated: 0, efficiency: 0, taskStartTime: now },
        timestamp: now
      },
      agentStatus: {
        active: 0,
        total: 5,
        agents: [],
        mode: 'claude-only',
        timestamp: now
      },
      taskProgress: {
        name: 'enhanced_footer',
        progress: 85,
        status: 'in_progress',
        pendingCount: 0,
        timestamp: now
      },
      isVisible: true,
      terminalWidth: process.stdout.columns || 80,
      lastUpdate: now
    };
  }

  private setupEventHandlers(): void {
    // Database Activity Events
    this.dbMonitor.on('activityUpdate', (activity: DBActivity) => {
      this.state.dbActivity = activity;
      this.state.lastUpdate = new Date();
      this.emit('stateUpdate', this.state);
    });

    // Token Usage Events
    this.tokenTracker.on('tokenUsage', (data: any) => {
      this.state.tokenMetrics = data.metrics;
      this.state.lastUpdate = new Date();
      this.emit('stateUpdate', this.state);
    });

    // Agent Status Events
    this.agentConnector.on('statusUpdate', (status: AgentStatus) => {
      this.state.agentStatus = status;
      this.state.lastUpdate = new Date();
      this.emit('stateUpdate', this.state);
    });

    // Task Progress Events
    this.taskTracker.on('progressUpdate', (progress: TaskProgress) => {
      this.state.taskProgress = progress;
      this.state.lastUpdate = new Date();
      this.emit('stateUpdate', this.state);
    });

    // Renderer Events
    this.renderer.on('terminalResize', (width: number) => {
      this.state.terminalWidth = width;
      this.emit('terminalResize', width);
    });

    this.renderer.on('error', (error: Error) => {
      this.emit('error', error);
    });

    // Error handling per tutti i componenti
    [this.dbMonitor, this.tokenTracker, this.agentConnector, this.taskTracker].forEach(component => {
      component.on('error', (error: Error) => {
        console.error(`Footer component error:`, error);
        this.emit('error', error);
      });
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log(`${FOOTER_COLORS.BOLD}🚀 Enhanced Footer System - Initializing...${FOOTER_COLORS.RESET}`);

      // Inizializza tutti i componenti in parallelo
      await Promise.all([
        this.dbMonitor.initialize(),
        this.tokenTracker.initialize(),
        this.agentConnector.initialize(),
        this.taskTracker.initialize()
      ]);

      this.isInitialized = true;
      console.log(`${FOOTER_COLORS.PROGRESS_HIGH}✅ Enhanced Footer System - Initialized successfully${FOOTER_COLORS.RESET}`);

    } catch (error) {
      console.error(`${FOOTER_COLORS.PROGRESS_LOW}❌ Failed to initialize Enhanced Footer System:${FOOTER_COLORS.RESET}`, error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isRunning) {
      console.log('Enhanced Footer System is already running');
      return;
    }

    try {
      console.log(`${FOOTER_COLORS.BOLD}🎬 Starting Enhanced Footer System...${FOOTER_COLORS.RESET}`);

      // Avvia tutti i componenti
      this.dbMonitor.start();
      this.agentConnector.start();
      this.taskTracker.start();

      // Avvia il rendering loop
      this.startRenderLoop();

      this.isRunning = true;

      // Initial render
      this.renderFooter();

      console.log(`${FOOTER_COLORS.PROGRESS_HIGH}🎯 Enhanced Footer System - Started successfully${FOOTER_COLORS.RESET}`);
      this.emit('started');

    } catch (error) {
      console.error(`${FOOTER_COLORS.PROGRESS_LOW}❌ Failed to start Enhanced Footer System:${FOOTER_COLORS.RESET}`, error);
      throw error;
    }
  }

  private startRenderLoop(): void {
    if (this.renderInterval) {
      clearInterval(this.renderInterval);
    }

    // Render footer ogni 2.5 secondi
    this.renderInterval = setInterval(() => {
      if (this.state.isVisible) {
        this.renderFooter();
      }
    }, 2500);
  }

  private renderFooter(): void {
    try {
      this.renderer.renderFooter(this.state);
    } catch (error) {
      console.error('Error rendering footer:', error);
      this.emit('error', error);
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      console.log(`${FOOTER_COLORS.BOLD}⏹️ Stopping Enhanced Footer System...${FOOTER_COLORS.RESET}`);

      // Ferma il rendering
      if (this.renderInterval) {
        clearInterval(this.renderInterval);
        this.renderInterval = null;
      }

      // Ferma tutti i componenti
      this.dbMonitor.stop();
      this.agentConnector.stop();
      this.taskTracker.stop();

      // Pulisci il footer dal terminale
      this.renderer.clearFooter();

      this.isRunning = false;
      console.log(`${FOOTER_COLORS.PROGRESS_HIGH}🛑 Enhanced Footer System - Stopped${FOOTER_COLORS.RESET}`);
      this.emit('stopped');

    } catch (error) {
      console.error('Error stopping Enhanced Footer System:', error);
      throw error;
    }
  }

  // Public API Methods
  addTokenUsage(tokens: number, context: 'session' | 'task' | 'both' = 'both'): void {
    if (this.isRunning) {
      this.tokenTracker.addTokenUsage(tokens, context);
    }
  }

  resetTaskTokens(): void {
    if (this.isRunning) {
      this.tokenTracker.resetTaskTokens();
    }
  }

  getCurrentState(): FooterState {
    return { ...this.state };
  }

  setVisibility(visible: boolean): void {
    if (this.state.isVisible !== visible) {
      this.state.isVisible = visible;

      if (!visible) {
        this.renderer.clearFooter();
      } else if (this.isRunning) {
        this.renderFooter();
      }

      this.emit('visibilityChange', visible);
    }
  }

  getFormattedPreview(): string {
    // Genera preview testuale senza ANSI codes per debugging
    const dbStatus = this.state.dbActivity.reads.active ? 'R:●' : 'R:○';
    const dbWriteStatus = this.state.dbActivity.writes.active ? 'W:●' : 'W:○';

    return [
      `🧠 ${dbStatus} ${dbWriteStatus}`,
      `${this.state.taskProgress.name} ${this.state.taskProgress.progress}%`,
      `[${this.state.agentStatus.mode}]`,
      `${this.state.agentStatus.active}/${this.state.agentStatus.total} Agents`,
      `Session:${this.formatTokens(this.state.tokenMetrics.session.total)} Task:${this.formatTokens(this.state.tokenMetrics.task.current)}`,
      `${this.state.taskProgress.pendingCount} pending`
    ].join(' │ ');
  }

  private formatTokens(count: number): string {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  }

  async destroy(): Promise<void> {
    await this.stop();

    // Distruggi tutti i componenti
    this.dbMonitor.destroy();
    this.tokenTracker.destroy();
    this.agentConnector.destroy();
    this.taskTracker.destroy();
    this.renderer.destroy();

    this.removeAllListeners();
    console.log(`${FOOTER_COLORS.DIM}🧹 Enhanced Footer System - Destroyed${FOOTER_COLORS.RESET}`);
  }
}

// Default export
export default EnhancedFooterSystem;