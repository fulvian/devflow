import { HookRegistry } from './hook-registry';
import { LegacyHookAdapter } from './legacy-hook-adapter';
import { HookConfig, HookType, InterceptionResult } from './types/hooks';

export class HookInterceptorManager {
  private registry: HookRegistry;
  private legacyAdapter: LegacyHookAdapter;
  private activeInterceptions: Map<string, boolean> = new Map();

  constructor() {
    this.registry = new HookRegistry();
    this.legacyAdapter = new LegacyHookAdapter();
  }

  async interceptHook(hookName: string, hookType: HookType, payload: any): Promise<InterceptionResult> {
    // Check if interception is enabled for this hook
    if (!this.activeInterceptions.get(hookName)) {
      return { intercepted: false, payload };
    }

    // Get registered handlers for this hook
    const handlers = this.registry.getHandlers(hookName);
    
    // Process through legacy adapter if needed
    let processedPayload = payload;
    if (this.legacyAdapter.shouldAdapt(hookName)) {
      processedPayload = await this.legacyAdapter.adapt(hookName, processedPayload);
    }

    // Execute all registered handlers
    for (const handler of handlers) {
      try {
        processedPayload = await handler(processedPayload);
      } catch (error) {
        console.error(`Error in hook handler for ${hookName}:`, error);
      }
    }

    return {
      intercepted: true,
      payload: processedPayload,
      hookName,
      hookType
    };
  }

  registerHook(config: HookConfig): void {
    this.registry.register(config);
    this.activeInterceptions.set(config.name, config.enabled);
  }

  enableInterception(hookName: string): void {
    this.activeInterceptions.set(hookName, true);
  }

  disableInterception(hookName: string): void {
    this.activeInterceptions.set(hookName, false);
  }

  isInterceptionActive(hookName: string): boolean {
    return this.activeInterceptions.get(hookName) || false;
  }
}
