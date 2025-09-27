// ======================================================================
// Enhanced Footer System - TypeScript Interfaces
// Task ID: ENHANCED-FOOTER-002
// Based on Context7 real-time monitoring best practices and DevFlow architecture
// ======================================================================

// Core dependencies
import { EventEmitter } from 'events';

// ----------------------------------------------------------------------
// ANSI Color Definitions
// ----------------------------------------------------------------------

/**
 * Standard ANSI color codes for terminal output styling
 */
export interface AnsiColorCodes {
  /** Reset to default terminal color */
  reset: string;
  /** Bold text formatting */
  bold: string;
  /** Dim text formatting */
  dim: string;
  /** Italic text formatting */
  italic: string;
  /** Underline text formatting */
  underline: string;
  /** Black color */
  black: string;
  /** Red color */
  red: string;
  /** Green color */
  green: string;
  /** Yellow color */
  yellow: string;
  /** Blue color */
  blue: string;
  /** Magenta color */
  magenta: string;
  /** Cyan color */
  cyan: string;
  /** White color */
  white: string;
  /** Bright black color */
  brightBlack: string;
  /** Bright red color */
  brightRed: string;
  /** Bright green color */
  brightGreen: string;
  /** Bright yellow color */
  brightYellow: string;
  /** Bright blue color */
  brightBlue: string;
  /** Bright magenta color */
  brightMagenta: string;
  /** Bright cyan color */
  brightCyan: string;
  /** Bright white color */
  brightWhite: string;
}

/**
 * Color theme configuration for footer elements
 */
export interface FooterColorTheme {
  /** Primary color for important information */
  primary: string;
  /** Secondary color for supplementary information */
  secondary: string;
  /** Success status color */
  success: string;
  /** Warning status color */
  warning: string;
  /** Error status color */
  error: string;
  /** Informational status color */
  info: string;
  /** Background color */
  background: string;
  /** Text color */
  text: string;
}

// ----------------------------------------------------------------------
// Real-time Monitoring Types
// ----------------------------------------------------------------------

/**
 * Real-time system metrics monitoring data
 */
export interface SystemMetrics {
  /** CPU usage percentage */
  cpuUsage: number;
  /** Memory usage in bytes */
  memoryUsage: number;
  /** Memory usage percentage */
  memoryPercentage: number;
  /** Network I/O statistics */
  networkIO: {
    /** Bytes received */
    received: number;
    /** Bytes transmitted */
    transmitted: number;
  };
  /** Disk I/O statistics */
  diskIO: {
    /** Bytes read */
    read: number;
    /** Bytes written */
    written: number;
  };
  /** System uptime in seconds */
  uptime: number;
  /** Current timestamp */
  timestamp: Date;
}

/**
 * Real-time monitoring configuration
 */
export interface MonitoringConfig {
  /** Enable/disable monitoring */
  enabled: boolean;
  /** Monitoring interval in milliseconds */
  interval: number;
  /** Metrics to collect */
  metrics: Array<'cpu' | 'memory' | 'network' | 'disk' | 'uptime'>;
  /** Alert thresholds */
  thresholds: {
    /** CPU usage alert threshold percentage */
    cpuThreshold: number;
    /** Memory usage alert threshold percentage */
    memoryThreshold: number;
  };
}

/**
 * Monitoring event types
 */
export type MonitoringEvent = 
  | 'metricsUpdate'
  | 'thresholdExceeded'
  | 'monitoringStarted'
  | 'monitoringStopped'
  | 'error';

// ----------------------------------------------------------------------
// Database Activity Monitoring
// ----------------------------------------------------------------------

/**
 * Database connection status
 */
export interface DatabaseConnectionStatus {
  /** Connection identifier */
  id: string;
  /** Database name */
  database: string;
  /** Connection status */
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  /** Connection establishment timestamp */
  connectedAt: Date | null;
  /** Last query timestamp */
  lastQueryAt: Date | null;
  /** Active connection count */
  activeConnections: number;
  /** Maximum connection pool size */
  maxConnections: number;
}

/**
 * Database query execution metrics
 */
export interface DatabaseQueryMetrics {
  /** Query identifier */
  id: string;
  /** SQL query text */
  query: string;
  /** Query execution time in milliseconds */
  executionTime: number;
  /** Query result row count */
  rowCount: number;
  /** Database connection used */
  connectionId: string;
  /** Query execution timestamp */
  timestamp: Date;
  /** Query success status */
  success: boolean;
  /** Error message if query failed */
  error?: string;
}

/**
 * Database activity monitoring configuration
 */
export interface DatabaseMonitoringConfig {
  /** Enable/disable database monitoring */
  enabled: boolean;
  /** Track connection status */
  trackConnections: boolean;
  /** Track query performance */
  trackQueries: boolean;
  /** Slow query threshold in milliseconds */
  slowQueryThreshold: number;
  /** Maximum query history to retain */
  maxQueryHistory: number;
}

/**
 * Database monitoring event types
 */
export type DatabaseEvent = 
  | 'connectionStatusChanged'
  | 'queryExecuted'
  | 'slowQueryDetected'
  | 'connectionPoolExhausted'
  | 'databaseError';

// ----------------------------------------------------------------------
// Token Usage Tracking
// ----------------------------------------------------------------------

/**
 * Token usage statistics
 */
export interface TokenUsageStats {
  /** Total tokens consumed */
  totalTokens: number;
  /** Input tokens consumed */
  inputTokens: number;
  /** Output tokens consumed */
  outputTokens: number;
  /** Tokens consumed in current session */
  sessionTokens: number;
  /** Token usage by model */
  byModel: Record<string, {
    /** Total tokens for this model */
    total: number;
    /** Input tokens for this model */
    input: number;
    /** Output tokens for this model */
    output: number;
  }>;
  /** Token usage by operation type */
  byOperation: Record<string, number>;
  /** Last update timestamp */
  lastUpdated: Date;
}

/**
 * Token cost calculation
 */
export interface TokenCost {
  /** Model name */
  model: string;
  /** Input token price per 1k tokens */
  inputPricePer1k: number;
  /** Output token price per 1k tokens */
  outputPricePer1k: number;
  /** Calculated cost for input tokens */
  inputCost: number;
  /** Calculated cost for output tokens */
  outputCost: number;
  /** Total cost */
  totalCost: number;
}

/**
 * Token usage tracking configuration
 */
export interface TokenTrackingConfig {
  /** Enable/disable token tracking */
  enabled: boolean;
  /** Track token costs */
  trackCosts: boolean;
  /** Pricing information by model */
  pricing: Record<string, {
    /** Input token price per 1k tokens */
    inputPricePer1k: number;
    /** Output token price per 1k tokens */
    outputPricePer1k: number;
  }>;
  /** Alert threshold for token usage */
  alertThreshold: number;
}

/**
 * Token tracking event types
 */
export type TokenEvent = 
  | 'tokensConsumed'
  | 'costCalculated'
  | 'thresholdExceeded'
  | 'trackingStarted'
  | 'trackingStopped';

// ----------------------------------------------------------------------
// Agent Status Types
// ----------------------------------------------------------------------

/**
 * Agent status information
 */
export interface AgentStatus {
  /** Agent identifier */
  id: string;
  /** Agent name */
  name: string;
  /** Current status */
  status: 'idle' | 'processing' | 'waiting' | 'error' | 'offline';
  /** Current task description */
  currentTask: string | null;
  /** Task progress percentage */
  progress: number | null;
  /** Last status update timestamp */
  lastUpdated: Date;
  /** Agent startup timestamp */
  startedAt: Date;
  /** Processing statistics */
  stats: {
    /** Total tasks processed */
    tasksProcessed: number;
    /** Successful tasks */
    successfulTasks: number;
    /** Failed tasks */
    failedTasks: number;
    /** Average processing time in milliseconds */
    avgProcessingTime: number;
  };
}

/**
 * Agent communication status
 */
export interface AgentCommunicationStatus {
  /** Agent identifier */
  agentId: string;
  /** Communication channel status */
  channelStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  /** Last message timestamp */
  lastMessageAt: Date | null;
  /** Message queue size */
  queueSize: number;
  /** Connection reliability percentage */
  reliability: number;
}

/**
 * Agent monitoring configuration
 */
export interface AgentMonitoringConfig {
  /** Enable/disable agent monitoring */
  enabled: boolean;
  /** Health check interval in milliseconds */
  healthCheckInterval: number;
  /** Communication timeout in milliseconds */
  communicationTimeout: number;
  /** Alert on agent offline status */
  alertOnOffline: boolean;
  /** Alert on low reliability */
  alertOnLowReliability: boolean;
}

/**
 * Agent monitoring event types
 */
export type AgentEvent = 
  | 'statusChanged'
  | 'taskStarted'
  | 'taskCompleted'
  | 'taskFailed'
  | 'communicationError'
  | 'agentOffline';

// ----------------------------------------------------------------------
// Enhanced Footer System Interfaces
// ----------------------------------------------------------------------

/**
 * Enhanced footer configuration
 */
export interface EnhancedFooterConfig {
  /** Enable/disable the entire footer system */
  enabled: boolean;
  /** Real-time monitoring configuration */
  monitoring: MonitoringConfig;
  /** Database monitoring configuration */
  database: DatabaseMonitoringConfig;
  /** Token tracking configuration */
  tokenTracking: TokenTrackingConfig;
  /** Agent monitoring configuration */
  agentMonitoring: AgentMonitoringConfig;
  /** Color theme for footer elements */
  colorTheme: FooterColorTheme;
  /** Update interval for footer display in milliseconds */
  updateInterval: number;
}

/**
 * Enhanced footer data structure
 */
export interface EnhancedFooterData {
  /** System metrics */
  systemMetrics: SystemMetrics | null;
  /** Database connection statuses */
  databaseConnections: DatabaseConnectionStatus[];
  /** Token usage statistics */
  tokenUsage: TokenUsageStats | null;
  /** Agent statuses */
  agentStatuses: AgentStatus[];
  /** Communication statuses */
  communicationStatuses: AgentCommunicationStatus[];
  /** Last update timestamp */
  lastUpdated: Date;
}

/**
 * Enhanced footer event types
 */
export type FooterEvent = 
  | 'dataUpdated'
  | 'footerRendered'
  | 'footerCleared'
  | 'error'
  | MonitoringEvent
  | DatabaseEvent
  | TokenEvent
  | AgentEvent;

/**
 * Enhanced footer system interface
 */
export interface EnhancedFooterSystem extends EventEmitter {
  /** Configuration for the footer system */
  config: EnhancedFooterConfig;
  
  /** Current footer data */
  data: EnhancedFooterData;
  
  /** Start the footer system */
  start(): Promise<void>;
  
  /** Stop the footer system */
  stop(): Promise<void>;
  
  /** Update footer data */
  updateData(): Promise<void>;
  
  /** Render the footer to the terminal */
  render(): void;
  
  /** Clear the footer from the terminal */
  clear(): void;
  
  /** Handle monitoring events */
  on(event: MonitoringEvent, listener: (data: any) => void): this;
  
  /** Handle database events */
  on(event: DatabaseEvent, listener: (data: any) => void): this;
  
  /** Handle token events */
  on(event: TokenEvent, listener: (data: any) => void): this;
  
  /** Handle agent events */
  on(event: AgentEvent, listener: (data: any) => void): this;
  
  /** Handle footer events */
  on(event: FooterEvent, listener: (data: any) => void): this;
}

/**
 * Footer rendering options
 */
export interface FooterRenderOptions {
  /** Terminal width */
  width: number;
  /** Terminal height */
  height: number;
  /** Use ANSI colors */
  useColors: boolean;
  /** Compact mode */
  compact: boolean;
  /** Show system metrics */
  showMetrics: boolean;
  /** Show database info */
  showDatabase: boolean;
  /** Show token usage */
  showTokens: boolean;
  /** Show agent statuses */
  showAgents: boolean;
}