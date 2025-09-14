// src/utils/logger.ts
import fs from 'fs';
import path from 'path';

/**
 * Log levels in order of severity (lowest to highest)
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Log format options
 */
export interface LogFormat {
  timestamp: boolean;
  level: boolean;
  color: boolean;
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  level: LogLevel;
  format: LogFormat;
  outputFile?: string;
}

/**
 * Log entry structure
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  meta?: Record<string, unknown>;
}

/**
 * Logger utility class for application logging
 */
export class Logger {
  private config: LoggerConfig;
  private readonly levels: Record<LogLevel, number> = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
  };

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: config?.level || LogLevel.INFO,
      format: {
        timestamp: config?.format?.timestamp ?? true,
        level: config?.format?.level ?? true,
        color: config?.format?.color ?? true,
      },
      outputFile: config?.outputFile,
    };
  }

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Configure log output format
   */
  setFormat(format: Partial<LogFormat>): void {
    this.config.format = { ...this.config.format, ...format };
  }

  /**
   * Log a debug message
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, meta);
  }

  /**
   * Log an info message
   */
  info(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, meta);
  }

  /**
   * Log a warning message
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, meta);
  }

  /**
   * Log an error message
   */
  error(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, meta);
  }

  /**
   * Generic log method
   */
  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    // Check if log level is enabled
    if (this.levels[level] < this.levels[this.config.level]) {
      return;
    }

    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      meta,
    };

    // Format and output the log
    const formattedMessage = this.formatLog(logEntry);
    
    try {
      // Output to console
      if (level === LogLevel.ERROR) {
        console.error(formattedMessage);
      } else {
        console.log(formattedMessage);
      }

      // Output to file if configured
      if (this.config.outputFile) {
        this.writeToFile(formattedMessage);
      }
    } catch (error) {
      // Fallback to console if file writing fails
      console.error('Logger error:', error);
    }
  }

  /**
   * Format log entry according to configuration
   */
  private formatLog(entry: LogEntry): string {
    const { timestamp, level, color } = this.config.format;
    let output = '';

    // Add timestamp if enabled
    if (timestamp) {
      output += `[${entry.timestamp.toISOString()}] `;
    }

    // Add level if enabled
    if (level) {
      let levelStr = entry.level.toUpperCase();
      
      // Add color if enabled
      if (color) {
        levelStr = this.colorizeLevel(entry.level, levelStr);
      }
      
      output += `[${levelStr}] `;
    }

    // Add message
    output += entry.message;

    // Add meta data if present
    if (entry.meta) {
      output += ` ${JSON.stringify(entry.meta)}`;
    }

    return output;
  }

  /**
   * Add color to log level based on severity
   */
  private colorizeLevel(logLevel: LogLevel, levelStr: string): string {
    const colors = {
      [LogLevel.DEBUG]: '\x1b[36m', // Cyan
      [LogLevel.INFO]: '\x1b[32m',  // Green
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.ERROR]: '\x1b[31m', // Red
    };

    const resetColor = '\x1b[0m';
    return `${colors[logLevel]}${levelStr}${resetColor}`;
  }

  /**
   * Write log entry to file
   */
  private writeToFile(message: string): void {
    if (!this.config.outputFile) {
      return;
    }

    const logDir = path.dirname(this.config.outputFile);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Append to file
    fs.appendFileSync(this.config.outputFile, `${message}\n`, 'utf8');
  }
}

// Create and export a default logger instance
export const logger = new Logger();

// Export types for external use
export type { LogEntry, LoggerConfig, LogFormat };