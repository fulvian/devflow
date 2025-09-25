import { Context7Integration } from '../integrations/context7-mcp-integration';
import fs from 'fs';
import path from 'path';

interface Context7ServiceConfig {
  configPath?: string;
  autoStart?: boolean;
  persistLogs?: boolean;
  logDirectory?: string;
}

interface TriggerData {
  timestamp: string;
  trigger: string;
  source?: string;
  errorAnalysis?: {
    errorCount: number;
    errorTypes: string[];
    libraries: string[];
    technologies: string[];
  };
  context7Action?: string;
  priority?: 'low' | 'medium' | 'high';
  suggestedQueries?: string[];
}

export class Context7Service {
  private integration: Context7Integration | null = null;
  private config: Context7ServiceConfig;
  private isInitialized: boolean = false;
  private triggerWatcher: fs.FSWatcher | null = null;

  constructor(config: Context7ServiceConfig = {}, mcpTools?: any) {
    this.config = {
      configPath: path.join(process.cwd(), '.devflow/context7-config.json'),
      autoStart: true,
      persistLogs: true,
      logDirectory: path.join(process.cwd(), '.devflow/logs'),
      ...config
    };

    if (this.config.autoStart && mcpTools) {
      this.initialize(mcpTools);
    }
  }

  async initialize(mcpTools: any): Promise<void> {
    try {
      // Load configuration
      const integrationConfig = this.loadConfiguration();

      // Initialize Context7Integration
      this.integration = new Context7Integration(integrationConfig, mcpTools);

      // Setup event listeners
      this.setupEventListeners();

      // Setup file watchers for auto-triggers
      this.setupTriggerWatchers();

      // Ensure log directory exists
      if (this.config.persistLogs && this.config.logDirectory) {
        fs.mkdirSync(this.config.logDirectory, { recursive: true });
      }

      this.isInitialized = true;
      this.log('Context7Service initialized successfully');

    } catch (error) {
      this.log(`Failed to initialize Context7Service: ${error.message}`, 'error');
      throw error;
    }
  }

  private loadConfiguration(): any {
    try {
      if (fs.existsSync(this.config.configPath!)) {
        const configData = fs.readFileSync(this.config.configPath!, 'utf8');
        return JSON.parse(configData);
      }
    } catch (error) {
      this.log(`Failed to load config from ${this.config.configPath}: ${error.message}`, 'warn');
    }

    // Return default configuration
    return {
      rateLimitRpm: 30,
      rateLimitBurst: 5,
      timeoutMs: 10000,
      retryAttempts: 3,
      retryDelayMs: 1000,
      enableAutoTrigger: true,
      logLevel: 'info'
    };
  }

  private setupEventListeners(): void {
    if (!this.integration) return;

    this.integration.on('requestStart', (data) => {
      this.log(`Context7 request started: ${data.type} - ${data.id}`);
    });

    this.integration.on('requestSuccess', (data) => {
      this.log(`Context7 request completed: ${data.id}`);
      this.persistLog('success', data);
    });

    this.integration.on('requestError', (data) => {
      this.log(`Context7 request failed: ${data.id} - ${data.error}`, 'error');
      this.persistLog('error', data);
    });

    this.integration.on('rateLimitRefill', (data) => {
      this.log(`Rate limit refreshed: ${data.tokens} tokens available`);
    });
  }

  private setupTriggerWatchers(): void {
    const triggerPath = path.join(process.cwd(), '.devflow/context7-trigger.json');

    // Watch for Context7 trigger file changes
    try {
      this.triggerWatcher = fs.watch(path.dirname(triggerPath), (eventType, filename) => {
        if (filename === 'context7-trigger.json' && eventType === 'change') {
          this.processTriggerFile(triggerPath);
        }
      });

      this.log('Context7 trigger file watcher setup successfully');
    } catch (error) {
      this.log(`Failed to setup trigger watcher: ${error.message}`, 'warn');
    }
  }

  private async processTriggerFile(triggerPath: string): Promise<void> {
    try {
      if (!fs.existsSync(triggerPath)) return;

      const triggerData: TriggerData = JSON.parse(fs.readFileSync(triggerPath, 'utf8'));

      this.log(`Processing Context7 trigger: ${triggerData.trigger} from ${triggerData.source}`);

      // Process suggested queries
      if (triggerData.suggestedQueries && triggerData.suggestedQueries.length > 0) {
        const priority = triggerData.priority || 'medium';

        for (const query of triggerData.suggestedQueries.slice(0, 3)) { // Limit to 3 queries
          try {
            const result = await this.autoResolveAndGetDocs(query, {
              priority,
              tokens: 3000
            });

            this.log(`Auto-triggered Context7 docs for: ${query}`);
            this.persistTriggerResult(query, result, triggerData);

          } catch (error) {
            this.log(`Auto-trigger failed for query "${query}": ${error.message}`, 'error');
          }
        }
      }

      // Clean up trigger file
      fs.unlinkSync(triggerPath);

    } catch (error) {
      this.log(`Error processing trigger file: ${error.message}`, 'error');
    }
  }

  async resolveLibraryId(libraryName: string, priority?: 'low' | 'medium' | 'high'): Promise<any> {
    if (!this.isInitialized || !this.integration) {
      throw new Error('Context7Service not initialized');
    }

    return this.integration.resolveLibraryId(libraryName, priority);
  }

  async getLibraryDocs(
    libraryId: string,
    options?: { tokens?: number; topic?: string; priority?: 'low' | 'medium' | 'high' }
  ): Promise<any> {
    if (!this.isInitialized || !this.integration) {
      throw new Error('Context7Service not initialized');
    }

    return this.integration.getLibraryDocs(libraryId, options);
  }

  async autoResolveAndGetDocs(
    libraryName: string,
    options?: { tokens?: number; topic?: string; priority?: 'low' | 'medium' | 'high' }
  ): Promise<{ libraryId: string; docs: any }> {
    if (!this.isInitialized || !this.integration) {
      throw new Error('Context7Service not initialized');
    }

    return this.integration.autoResolveAndGetDocs(libraryName, options);
  }

  getRateLimitStatus() {
    if (!this.integration) {
      throw new Error('Context7Service not initialized');
    }

    return this.integration.getRateLimitStatus();
  }

  updateConfiguration(newConfig: any): void {
    try {
      // Save to file
      if (this.config.configPath) {
        fs.writeFileSync(this.config.configPath, JSON.stringify(newConfig, null, 2));
      }

      // Update integration
      if (this.integration) {
        this.integration.updateConfig(newConfig);
      }

      this.log('Context7 configuration updated successfully');
    } catch (error) {
      this.log(`Failed to update configuration: ${error.message}`, 'error');
      throw error;
    }
  }

  private persistLog(type: string, data: any): void {
    if (!this.config.persistLogs || !this.config.logDirectory) return;

    try {
      const logFile = path.join(this.config.logDirectory, 'context7-requests.log');
      const logEntry = {
        timestamp: new Date().toISOString(),
        type,
        data
      };

      fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error(`Failed to persist log: ${error.message}`);
    }
  }

  private persistTriggerResult(query: string, result: any, triggerData: TriggerData): void {
    if (!this.config.persistLogs || !this.config.logDirectory) return;

    try {
      const resultFile = path.join(this.config.logDirectory, 'context7-triggers.log');
      const entry = {
        timestamp: new Date().toISOString(),
        query,
        result,
        originalTrigger: triggerData
      };

      fs.appendFileSync(resultFile, JSON.stringify(entry) + '\n');
    } catch (error) {
      console.error(`Failed to persist trigger result: ${error.message}`);
    }
  }

  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Context7Service [${level.toUpperCase()}] ${message}`);
  }

  async shutdown(): Promise<void> {
    try {
      if (this.triggerWatcher) {
        this.triggerWatcher.close();
        this.triggerWatcher = null;
      }

      if (this.integration) {
        this.integration.destroy();
        this.integration = null;
      }

      this.isInitialized = false;
      this.log('Context7Service shutdown completed');
    } catch (error) {
      this.log(`Error during shutdown: ${error.message}`, 'error');
    }
  }

  getStatus(): {
    initialized: boolean;
    rateLimitStatus?: any;
    triggerWatcherActive: boolean;
  } {
    return {
      initialized: this.isInitialized,
      rateLimitStatus: this.integration ? this.integration.getRateLimitStatus() : null,
      triggerWatcherActive: this.triggerWatcher !== null
    };
  }
}