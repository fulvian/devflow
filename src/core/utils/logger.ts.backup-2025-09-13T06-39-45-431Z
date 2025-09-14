/**
 * Simple Logger utility for DevFlow system
 */

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(message: string, meta?: any): void {
    console.log(`[INFO] ${new Date().toISOString()} [${this.context}] - ${message}`, meta || '');
  }
  
  warn(message: string, meta?: any): void {
    console.warn(`[WARN] ${new Date().toISOString()} [${this.context}] - ${message}`, meta || '');
  }
  
  error(message: string, meta?: any): void {
    console.error(`[ERROR] ${new Date().toISOString()} [${this.context}] - ${message}`, meta || '');
  }
  
  debug(message: string, meta?: any): void {
    console.debug(`[DEBUG] ${new Date().toISOString()} [${this.context}] - ${message}`, meta || '');
  }
}