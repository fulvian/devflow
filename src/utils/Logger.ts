/**
 * Logger
 * Simple logger for DevFlow
 */

export class Logger {
  /**
   * Log an info message
   * @param message Message to log
   * @param metadata Optional metadata
   */
  info(message: string, metadata?: any): void {
    console.log(`[INFO] ${message}`, metadata || '');
  }

  /**
   * Log a warning message
   * @param message Message to log
   * @param metadata Optional metadata
   */
  warn(message: string, metadata?: any): void {
    console.warn(`[WARN] ${message}`, metadata || '');
  }

  /**
   * Log an error message
   * @param message Message to log
   * @param metadata Optional metadata
   */
  error(message: string, metadata?: any): void {
    console.error(`[ERROR] ${message}`, metadata || '');
  }
}