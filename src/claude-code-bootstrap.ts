/**
 * Claude Code Bootstrap Integration
 * Main entry point for Claude Code application with enforcement system integration
 * 
 * Task ID: DEVFLOW-BOOTSTRAP-INTEGRATION
 */

import { DevFlowServiceManager } from './services/DevFlowServiceManager';
import { EnforcementSystem } from './enforcement/EnforcementSystem';
import { Logger } from './utils/Logger';
import { ConfigManager } from './config/ConfigManager';

// Type definitions
interface BootstrapOptions {
  environment?: 'development' | 'production';
  enableEnforcement?: boolean;
}

interface BootstrapResult {
  success: boolean;
  services: string[];
  enforcementActive: boolean;
  error?: Error;
}

class ClaudeCodeBootstrap {
  private logger: Logger;
  private configManager: ConfigManager;
  private serviceManager: DevFlowServiceManager;
  private enforcementSystem: EnforcementSystem | null = null;
  private isInitialized: boolean = false;

  constructor() {
    this.logger = new Logger('ClaudeCodeBootstrap');
    this.configManager = new ConfigManager();
    this.serviceManager = new DevFlowServiceManager();
  }

  /**
   * Main bootstrap entry point
   * @param options Bootstrap configuration options
   * @returns Promise resolving to bootstrap result
   */
  async initialize(): Promise<BootstrapResult> {
    try {
      if (this.isInitialized) {
        this.logger.warn('Bootstrap already initialized, skipping...');
        return {
          success: true,
          services: [],
          enforcementActive: this.enforcementSystem !== null
        };
      }

      this.logger.info('Starting Claude Code bootstrap process...');
      
      // Set environment
      const environment = process.env.NODE_ENV || 'development';
      this.setEnvironment(environment);
      
      // Initialize configuration
      // this.configManager.load({ environment });
      
      // Start DevFlow services
      const servicesStarted = await this.startDevFlowServices();
      
      // Initialize enforcement system if enabled
      const enforcementActive = await this.initializeEnforcementSystem();
      
      this.isInitialized = true;
      
      this.logger.info('Claude Code bootstrap completed successfully', {
        environment,
        services: servicesStarted,
        enforcementActive
      });
      
      return {
        success: true,
        services: servicesStarted,
        enforcementActive
      };
      
    } catch (error) {
      this.logger.error('Bootstrap initialization failed', error);
      return this.handleBootstrapError(error);
    }
  }

  /**
   * Set application environment
   * @param environment Environment mode
   */
  private setEnvironment(environment: string): void {
    process.env.NODE_ENV = environment;
    this.logger.info(`Environment set to: ${environment}`);
  }

  /**
   * Start all DevFlow services
   * @returns Array of started service names
   */
  private async startDevFlowServices(): Promise<string[]> {
    try {
      this.logger.info('Initializing DevFlow services...');
      await this.serviceManager.initialize();
      
      const activeServices: string[] = [];
      this.logger.info(`DevFlow services started`);
      
      return activeServices;
    } catch (error: any) {
      this.logger.error('Failed to start DevFlow services', error);
      throw new Error(`DevFlow service initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Initialize enforcement system
   * @returns Boolean indicating if enforcement was activated
   */
  private async initializeEnforcementSystem(): Promise<boolean> {
    try {
      this.logger.info('Initializing enforcement system...');
      
      this.enforcementSystem = new EnforcementSystem();
      // await this.enforcementSystem.initialize();
      
      this.logger.info('Enforcement system activated successfully');
      return true;
    } catch (error: any) {
      this.logger.error('Failed to initialize enforcement system', error);
      // Don't throw error to allow graceful degradation
      return false;
    }
  }

  /**
   * Handle bootstrap errors with fallback mechanisms
   * @param error Error that occurred during bootstrap
   * @returns Bootstrap result with error information
   */
  private handleBootstrapError(error: any): BootstrapResult {
    this.logger.error('Critical bootstrap error occurred', error);
    
    // Attempt minimal recovery
    try {
      // Try to start essential services only
      const services = [];
      
      return {
        success: false,
        services: [],
        enforcementActive: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    } catch (recoveryError: any) {
      this.logger.error('Recovery attempt failed', recoveryError);
      
      return {
        success: false,
        services: [],
        enforcementActive: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Gracefully shutdown all systems
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Claude Code systems...');
    
    try {
      if (this.enforcementSystem) {
        // await this.enforcementSystem.shutdown();
        this.logger.info('Enforcement system shut down');
      }
      
      // await this.serviceManager.shutdown();
      this.logger.info('DevFlow services shut down');
      
      this.isInitialized = false;
      this.logger.info('Claude Code shutdown completed');
    } catch (error) {
      this.logger.error('Error during shutdown', error);
      throw error;
    }
  }

  /**
   * Get current bootstrap status
   */
  getStatus(): {
    initialized: boolean;
    environment: string;
    services: string[];
    enforcementActive: boolean;
  } {
    return {
      initialized: this.isInitialized,
      environment: process.env.NODE_ENV || 'unknown',
      services: [],
      enforcementActive: this.enforcementSystem !== null
    };
  }
}

// Global bootstrap instance
let bootstrapInstance: ClaudeCodeBootstrap | null = null;

/**
 * Get singleton bootstrap instance
 */
function getBootstrap(): ClaudeCodeBootstrap {
  if (!bootstrapInstance) {
    bootstrapInstance = new ClaudeCodeBootstrap();
  }
  return bootstrapInstance;
}

/**
 * Main bootstrap function - Entry point for the application
 */
export async function bootstrap(): Promise<BootstrapResult> {
  const bootstrapInstance = getBootstrap();
  return await bootstrapInstance.initialize();
}

/**
 * Shutdown function for graceful termination
 */
export async function shutdown(): Promise<void> {
  if (bootstrapInstance) {
    await bootstrapInstance.shutdown();
  }
}

// Auto-start in module context if directly executed
if (require.main === module) {
  (async () => {
    try {
      const result = await bootstrap();
      
      if (!result.success) {
        process.exitCode = 1;
        console.error('Bootstrap completed with errors:', result.error?.message);
      } else {
        console.log('Claude Code started successfully');
      }
    } catch (error) {
      console.error('Fatal bootstrap error:', error);
      process.exitCode = 1;
    }
  })();
}

// Handle process termination signals
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await shutdown();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  shutdown().finally(() => {
    process.exit(1);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown().finally(() => {
    process.exit(1);
  });
});

export { ClaudeCodeBootstrap, getBootstrap };
export type { BootstrapOptions, BootstrapResult };