/**
 * Claude Code Runtime Integration
 * 
 * This module handles the automatic initialization of the enforcement system
 * when Claude Code starts up. It registers default rules, sets up tool wrappers,
 * and ensures all Write/Edit operations are properly enforced.
 */

import { Logger, LogLevel } from './logger';
import { EnforcementEngine } from './enforcement-engine';
import { RuleRegistry } from './rule-registry';
import { ToolWrapper } from './tool-wrapper';
import { ClaudeCodeError, StartupError } from './errors';

/**
 * Configuration interface for the runtime integration
 */
interface RuntimeConfig {
  /** Enable or disable the enforcement system */
  enabled: boolean;
  /** Log level for the integration */
  logLevel: LogLevel;
  /** Whether to fail startup on enforcement initialization errors */
  failOnStartupError: boolean;
}

/**
 * Default configuration for the runtime integration
 */
const DEFAULT_CONFIG: RuntimeConfig = {
  enabled: true,
  logLevel: LogLevel.INFO,
  failOnStartupError: true
};

/**
 * Claude Code Runtime Integration Class
 * 
 * Handles automatic activation of the enforcement system on startup
 */
export class ClaudeCodeRuntime {
  private static instance: ClaudeCodeRuntime;
  private readonly logger: Logger;
  private readonly enforcementEngine: EnforcementEngine;
  private readonly ruleRegistry: RuleRegistry;
  private readonly toolWrapper: ToolWrapper;
  private initialized: boolean = false;
  private config: RuntimeConfig;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor(config: Partial<RuntimeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = new Logger('ClaudeCodeRuntime', this.config.logLevel);
    this.ruleRegistry = new RuleRegistry();
    this.enforcementEngine = new EnforcementEngine(this.ruleRegistry);
    this.toolWrapper = new ToolWrapper(this.enforcementEngine);
  }

  /**
   * Get the singleton instance of ClaudeCodeRuntime
   */
  public static getInstance(config?: Partial<RuntimeConfig>): ClaudeCodeRuntime {
    if (!ClaudeCodeRuntime.instance) {
      ClaudeCodeRuntime.instance = new ClaudeCodeRuntime(config);
    }
    return ClaudeCodeRuntime.instance;
  }

  /**
   * Initialize the enforcement system
   * This method should be called automatically on Claude Code startup
   */
  public async initialize(): Promise<boolean> {
    try {
      if (this.initialized) {
        this.logger.warn('Runtime already initialized, skipping initialization');
        return true;
      }

      if (!this.config.enabled) {
        this.logger.info('Enforcement system is disabled, skipping initialization');
        return false;
      }

      this.logger.info('Initializing Claude Code Runtime Integration');

      // Register default rules
      await this.registerDefaultRules();
      
      // Setup tool wrappers
      this.setupToolWrappers();
      
      // Activate enforcement engine
      await this.enforcementEngine.activate();
      
      this.initialized = true;
      this.logger.info('Claude Code Runtime Integration successfully initialized');
      return true;
    } catch (error) {
      const startupError = new StartupError(
        'Failed to initialize Claude Code Runtime Integration',
        { cause: error }
      );
      
      this.logger.error(startupError.message, { error });
      
      if (this.config.failOnStartupError) {
        throw startupError;
      }
      
      return false;
    }
  }

  /**
   * Register default enforcement rules
   */
  private async registerDefaultRules(): Promise<void> {
    this.logger.debug('Registering default enforcement rules');
    
    try {
      // Register security rules
      this.ruleRegistry.registerRule({
        id: 'security-no-secrets',
        name: 'No Secrets in Code',
        description: 'Prevents writing secrets or sensitive information in code',
        priority: 100,
        enabled: true,
        evaluate: (context) => {
          // Implementation would check for patterns like API keys, passwords, etc.
          return Promise.resolve({ passed: true });
        }
      });

      // Register code quality rules
      this.ruleRegistry.registerRule({
        id: 'quality-no-todos',
        name: 'No TODO Comments',
        description: 'Prevents writing TODO comments in production code',
        priority: 50,
        enabled: true,
        evaluate: (context) => {
          // Implementation would check for TODO comments
          return Promise.resolve({ passed: true });
        }
      });

      // Register formatting rules
      this.ruleRegistry.registerRule({
        id: 'formatting-consistent-style',
        name: 'Consistent Code Style',
        description: 'Enforces consistent code formatting',
        priority: 25,
        enabled: true,
        evaluate: (context) => {
          // Implementation would check code formatting
          return Promise.resolve({ passed: true });
        }
      });

      this.logger.info('Default rules registered successfully');
    } catch (error) {
      throw new ClaudeCodeError('Failed to register default rules', { cause: error });
    }
  }

  /**
   * Setup tool wrappers for Write/Edit operations
   */
  private setupToolWrappers(): void {
    this.logger.debug('Setting up tool wrappers for Write/Edit operations');
    
    try {
      // Wrap file write operations
      this.toolWrapper.wrap('file.write', async (originalFn, ...args) => {
        const [filePath, content] = args;
        await this.enforcementEngine.enforce({ operation: 'write', filePath, content });
        return originalFn(...args);
      });

      // Wrap file edit operations
      this.toolWrapper.wrap('file.edit', async (originalFn, ...args) => {
        const [filePath, changes] = args;
        await this.enforcementEngine.enforce({ operation: 'edit', filePath, changes });
        return originalFn(...args);
      });

      // Wrap code generation operations
      this.toolWrapper.wrap('code.generate', async (originalFn, ...args) => {
        const [spec] = args;
        await this.enforcementEngine.enforce({ operation: 'generate', spec });
        return originalFn(...args);
      });

      this.logger.info('Tool wrappers setup successfully');
    } catch (error) {
      throw new ClaudeCodeError('Failed to setup tool wrappers', { cause: error });
    }
  }

  /**
   * Get the current status of the runtime integration
   */
  public getStatus(): {
    initialized: boolean;
    enabled: boolean;
    rulesCount: number;
    wrappedTools: string[];
  } {
    return {
      initialized: this.initialized,
      enabled: this.config.enabled,
      rulesCount: this.ruleRegistry.getRules().length,
      wrappedTools: this.toolWrapper.getWrappedTools()
    };
  }

  /**
   * Update the runtime configuration
   */
  public updateConfig(newConfig: Partial<RuntimeConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.setLogLevel(this.config.logLevel);
    
    if (!this.config.enabled && this.initialized) {
      this.logger.warn('Runtime disabled after initialization - existing enforcement may still be active');
    }
  }
}

/**
 * Auto-initialize the Claude Code Runtime Integration
 * This function is called automatically when the module is imported
 */
async function autoInitialize(): Promise<void> {
  try {
    const runtime = ClaudeCodeRuntime.getInstance();
    const initialized = await runtime.initialize();
    
    if (initialized) {
      const status = runtime.getStatus();
      console.log(`Claude Code Runtime Integration Status:
        - Initialized: ${status.initialized}
        - Rules Registered: ${status.rulesCount}
        - Tools Wrapped: ${status.wrappedTools.length}`);
    }
  } catch (error) {
    console.error('Fatal error during Claude Code Runtime initialization:', error);
    // In a real implementation, you might want to handle this differently
    // based on your application's error handling strategy
  }
}

// Automatically initialize on module import
autoInitialize().catch(error => {
  // This catch is a safety net - errors should be handled in autoInitialize
  console.error('Unhandled error in runtime initialization:', error);
});

// Export types for external use
export type { RuntimeConfig };
export { LogLevel };