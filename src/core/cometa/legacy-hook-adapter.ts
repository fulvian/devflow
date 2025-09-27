import { LegacyHookMapping } from './types/hooks';

export class LegacyHookAdapter {
  private mappings: Map<string, LegacyHookMapping> = new Map();

  constructor() {
    this.initializeMappings();
  }

  private initializeMappings(): void {
    // Map legacy hook names to new system
    this.mappings.set('stop-hook.js', {
      legacyName: 'stop-hook.js',
      newName: 'STOP',
      transformer: this.transformStopHook
    });

    this.mappings.set('subagent-stop-hook.js', {
      legacyName: 'subagent-stop-hook.js',
      newName: 'SUBAGENT_STOP',
      transformer: this.transformSubagentStopHook
    });

    this.mappings.set('intelligent-save-hook.mjs', {
      legacyName: 'intelligent-save-hook.mjs',
      newName: 'INTELLIGENT_SAVE',
      transformer: this.transformIntelligentSaveHook
    });
  }

  shouldAdapt(hookName: string): boolean {
    return this.mappings.has(hookName);
  }

  async adapt(hookName: string, payload: any): Promise<any> {
    const mapping = this.mappings.get(hookName);
    if (!mapping) {
      return payload;
    }

    return mapping.transformer(payload);
  }

  private transformStopHook(payload: any): any {
    // Transform stop-hook.js payload to new format
    return {
      ...payload,
      hookType: 'STOP',
      timestamp: new Date().toISOString()
    };
  }

  private transformSubagentStopHook(payload: any): any {
    // Transform subagent-stop-hook.js payload to new format
    return {
      ...payload,
      hookType: 'SUBAGENT_STOP',
      agentId: payload.agentId || payload.subagentId,
      timestamp: new Date().toISOString()
    };
  }

  private transformIntelligentSaveHook(payload: any): any {
    // Transform intelligent-save-hook.mjs payload to new format
    return {
      ...payload,
      hookType: 'INTELLIGENT_SAVE',
      saveContext: payload.context || payload.saveContext,
      timestamp: new Date().toISOString()
    };
  }
}
