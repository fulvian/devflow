/**
 * Enhanced Footer System - TypeScript Interfaces
 * Simplified interfaces for production deployment
 */

import { EventEmitter } from 'events';

// ANSI Color Definitions
export const FOOTER_COLORS = {
  // Database Activity Colors
  R_ACTIVE: '\x1B[32m',      // 🟢 Verde: R:●
  R_IDLE: '\x1B[90m',        // ⚪ Grigio: R:○
  W_ACTIVE: '\x1B[33m',      // 🟡 Giallo: W:●
  W_IDLE: '\x1B[90m',        // ⚪ Grigio: W:○

  // Progress Colors
  PROGRESS_HIGH: '\x1B[92m', // 🟢 Verde: >80%
  PROGRESS_MID: '\x1B[93m',  // 🟡 Giallo: 40-80%
  PROGRESS_LOW: '\x1B[91m',  // 🔴 Rosso: <40%

  // Mode Colors
  MODE_CLAUDE: '\x1B[35m',   // 🟣 Magenta: [claude-only]
  MODE_ALL: '\x1B[36m',      // 🔵 Ciano: [all-mode]
  MODE_CLI: '\x1B[34m',      // 🔵 Blu: [cli-only]
  MODE_SYNTH: '\x1B[32m',    // 🟢 Verde: [synthetic-only]

  // Token Colors
  TOKEN_SESSION: '\x1B[96m', // 🔵 Ciano chiaro: Session tokens
  TOKEN_TASK: '\x1B[94m',    // 🔵 Blu: Task tokens

  // Status Colors
  PENDING_COUNT: '\x1B[31m', // 🔴 Rosso: Pending tasks
  BRAIN_PURPLE: '\x1B[95m',  // 🟣 Purple: Brain icon
  DIM: '\x1B[90m',           // Grigio: Separatori
  BOLD: '\x1B[1m',           // Bold text
  RESET: '\x1B[0m'           // Reset colors
} as const;

// Database Activity Monitoring
export interface DBActivity {
  reads: {
    active: boolean;
    lastActivity: Date;
    operationsCount: number;
    operationsPerMinute: number;
  };
  writes: {
    active: boolean;
    lastActivity: Date;
    operationsCount: number;
    operationsPerMinute: number;
  };
  timestamp: Date;
}

// Token Usage Tracking
export interface TokenMetrics {
  session: {
    total: number;
    average: number;
    peak: number;
    startTime: Date;
  };
  task: {
    current: number;
    estimated: number;
    efficiency: number;
    taskStartTime: Date;
  };
  timestamp: Date;
}

// Agent Status
export interface AgentStatus {
  active: number;
  total: number;
  agents: AgentInfo[];
  mode: AgentMode;
  timestamp: Date;
}

export interface AgentInfo {
  name: string;
  status: 'active' | 'inactive' | 'error' | 'starting';
  type: 'cli' | 'synthetic' | 'claude';
  lastActivity?: Date;
  errorCount?: number;
}

export type AgentMode = 'claude-only' | 'all-mode' | 'cli-only' | 'synthetic-only';

// Task Progress
export interface TaskProgress {
  name: string;
  progress: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  pendingCount: number;
  timestamp: Date;
}

// Footer State
export interface FooterState {
  dbActivity: DBActivity;
  tokenMetrics: TokenMetrics;
  agentStatus: AgentStatus;
  taskProgress: TaskProgress;
  isVisible: boolean;
  terminalWidth: number;
  lastUpdate: Date;
}

// Configuration
export interface FooterConfig {
  updateIntervals: {
    dbActivity: number;
    taskProgress: number;
    agentStatus: number;
    tokenCounters: number;
    pendingTasks: number;
  };
  display: {
    showAnimations: boolean;
    compactMode: boolean;
    maxWidth: number;
  };
  database: {
    dbPath: string;
    connectionTimeout: number;
  };
  orchestrator: {
    baseUrl: string;
    timeout: number;
  };
}

// Rendering types
export interface RenderedSegment {
  content: string;
  width: number;
  color?: string;
  animated?: boolean;
}

export interface FooterLayout {
  segments: RenderedSegment[];
  totalWidth: number;
  overflow: boolean;
}