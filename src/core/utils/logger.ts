/**
 * Logger - Sistema di logging
 */

// Classe per il logging
export class Logger {
  debug(message: string, meta?: any): void {
    console.log(`[DEBUG] ${message}`, meta || '');
  }

  info(message: string, meta?: any): void {
    console.log(`[INFO] ${message}`, meta || '');
  }

  warn(message: string, meta?: any): void {
    console.warn(`[WARN] ${message}`, meta || '');
  }

  error(message: string, meta?: any): void {
    console.error(`[ERROR] ${message}`, meta || '');
  }
}