/**
 * Config Manager
 * Configuration manager for DevFlow
 */

export class ConfigManager {
  private config: any = {};

  /**
   * Load configuration
   * @param config Configuration object
   */
  loadConfig(config: any): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get a configuration value
   * @param key Configuration key
   * @returns Configuration value
   */
  get(key: string): any {
    return this.config[key];
  }

  /**
   * Set a configuration value
   * @param key Configuration key
   * @param value Configuration value
   */
  set(key: string, value: any): void {
    this.config[key] = value;
  }
}