/**
 * Logger interface and implementation for DevFlow v3.1
 */

export interface Logger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

export class DefaultLogger implements Logger {
  private prefix: string;

  constructor(prefix: string = 'DevFlow') {
    this.prefix = prefix;
  }

  info(message: string, meta?: any): void {
    console.log(`[INFO][${this.prefix}] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  }

  warn(message: string, meta?: any): void {
    console.warn(`[WARN][${this.prefix}] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  }

  error(message: string, meta?: any): void {
    console.error(`[ERROR][${this.prefix}] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  }

  debug(message: string, meta?: any): void {
    if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG][${this.prefix}] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
    }
  }
}