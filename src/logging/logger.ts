export interface Logger {
  info(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

export class SimpleLogger implements Logger {
  info(message: string, meta?: any): void {
    console.log(`[INFO] ${message}`, meta || '');
  }
  
  error(message: string, meta?: any): void {
    console.error(`[ERROR] ${message}`, meta || '');
  }
  
  warn(message: string, meta?: any): void {
    console.warn(`[WARN] ${message}`, meta || '');
  }
  
  debug(message: string, meta?: any): void {
    console.debug(`[DEBUG] ${message}`, meta || '');
  }
}