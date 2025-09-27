import { HookConfig, HookHandler, HookRegistration } from './types/hooks';

export class HookRegistry {
  private registrations: Map<string, HookRegistration[]> = new Map();
  private configs: Map<string, HookConfig> = new Map();

  register(config: HookConfig, handler?: HookHandler): void {
    // Store config
    this.configs.set(config.name, config);

    // Initialize handlers array if not exists
    if (!this.registrations.has(config.name)) {
      this.registrations.set(config.name, []);
    }

    // Add handler if provided
    if (handler) {
      this.addHandler(config.name, handler);
    }
  }

  addHandler(hookName: string, handler: HookHandler): void {
    if (!this.registrations.has(hookName)) {
      throw new Error(`Hook ${hookName} is not registered`);
    }

    const registration = this.registrations.get(hookName)![0]; // Get first registration
    this.registrations.get(hookName)!.push({
      config: registration.config,
      handler
    });
  }

  getHandlers(hookName: string): HookHandler[] {
    const registrations = this.registrations.get(hookName);
    if (!registrations) {
      return [];
    }

    return registrations
      .filter(reg => reg.config.enabled)
      .sort((a, b) => (b.config.priority || 0) - (a.config.priority || 0))
      .map(reg => reg.handler);
  }

  getConfig(hookName: string): HookConfig | undefined {
    return this.configs.get(hookName);
  }

  getAllConfigs(): HookConfig[] {
    return Array.from(this.configs.values());
  }

  removeHandler(hookName: string, handler: HookHandler): boolean {
    const registrations = this.registrations.get(hookName);
    if (!registrations) {
      return false;
    }

    const initialLength = registrations.length;
    const filtered = registrations.filter(reg => reg.handler !== handler);
    this.registrations.set(hookName, filtered);
    
    return filtered.length < initialLength;
  }

  unregister(hookName: string): boolean {
    const hadConfig = this.configs.delete(hookName);
    const hadRegistrations = this.registrations.delete(hookName);
    return hadConfig || hadRegistrations;
  }
}
