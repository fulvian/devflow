export class ConfigManager {
  private config: Record<string, any> = {};
  
  get<T>(key: string, defaultValue?: T): T {
    return this.config[key] ?? defaultValue;
  }
  
  set(key: string, value: any): void {
    this.config[key] = value;
  }
}