/**
 * DevFlow v3.1 Type Declarations
 * This file contains type definitions for the new services in v3.1
 */

declare module 'devflow/session-monitoring' {
  export interface SessionConfig {
    timeout: number;
    warningThreshold: number;
    onTimeout: () => void;
    onWarning: () => void;
  }

  export class SessionMonitor {
    constructor(config: SessionConfig);
    start(): void;
    stop(): void;
    reset(): void;
    getRemainingTime(): number;
  }

  export function createSessionMonitor(config: SessionConfig): SessionMonitor;
}

declare module 'devflow/custom-footer' {
  export interface FooterConfig {
    content: string;
    position: 'left' | 'center' | 'right';
    theme: 'light' | 'dark';
  }

  export class CustomFooter {
    constructor(config: FooterConfig);
    render(): HTMLElement;
    updateContent(content: string): void;
    destroy(): void;
  }

  export function createFooter(config: FooterConfig): CustomFooter;
}

declare module 'devflow/context7' {
  export interface Context7Config {
    appId: string;
    apiKey: string;
    environment: 'development' | 'staging' | 'production';
  }

  export interface Context7Data {
    userId: string;
    sessionId: string;
    features: Record<string, boolean>;
  }

  export class Context7 {
    constructor(config: Context7Config);
    initialize(): Promise<void>;
    getContext(): Context7Data;
    updateContext(data: Partial<Context7Data>): void;
    destroy(): void;
  }

  export function createContext7(config: Context7Config): Context7;
}

declare module 'devflow/qwen-integration' {
  export interface QwenConfig {
    endpoint: string;
    apiKey: string;
    model: string;
  }

  export interface QwenMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
  }

  export interface QwenResponse {
    id: string;
    choices: Array<{
      message: QwenMessage;
      finish_reason: string;
    }>;
  }

  export class QwenClient {
    constructor(config: QwenConfig);
    sendMessage(messages: QwenMessage[]): Promise<QwenResponse>;
    streamMessage(messages: QwenMessage[], onChunk: (chunk: string) => void): Promise<void>;
  }

  export function createQwenClient(config: QwenConfig): QwenClient;
}

// Re-export for backward compatibility
declare module 'devflow' {
  export * from 'devflow/session-monitoring';
  export * from 'devflow/custom-footer';
  export * from 'devflow/context7';
  export * from 'devflow/qwen-integration';
}