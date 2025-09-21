export type HookType = 'STOP' | 'SUBAGENT_STOP' | 'INTELLIGENT_SAVE' | 'CUSTOM';

export interface HookConfig {
  name: string;
  type: HookType;
  enabled: boolean;
  description?: string;
  priority?: number;
}

export interface InterceptionResult {
  intercepted: boolean;
  payload: any;
  hookName?: string;
  hookType?: HookType;
}

export type HookHandler = (payload: any) => Promise<any>;

export interface HookRegistration {
  config: HookConfig;
  handler: HookHandler;
}

export interface LegacyHookMapping {
  legacyName: string;
  newName: string;
  transformer: (payload: any) => any;
}
