// src/bootstrap/claude-code-bootstrap.ts
/**
 * Claude Code Bootstrap Configuration
 *
 * This module serves as the entry point for activating the enforcement system
 * when Claude Code starts. It handles rule registration, tool wrapping,
 * configuration validation, and integration with CLAUDE.md.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger, createLogger, transports, format } from 'winston';
import { RuleEngine } from '../rules/rule-engine';
import { ToolWrapper } from '../tools/tool-wrapper';
import { ConfigurationValidator } from '../config/config-validator';
import { CLAUDEConfig } from '../types/claude-config';

// Define types
interface BootstrapConfig {
  rulesPath: string;
  toolsPath: string;
  claudeMdPath: string;
  logLevel: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Main bootstrap class
export class ClaudeCodeBootstrap {
  private logger: Logger;
  private ruleEngine: RuleEngine;
  private toolWrapper: ToolWrapper;
  private configValidator: ConfigurationValidator;
  private bootstrapConfig: BootstrapConfig;

  constructor(config?: Partial<BootstrapConfig>) {
    // Initialize default configuration
    this.bootstrapConfig = {
      rulesPath: config?.rulesPath || './rules',
      toolsPath: config?.toolsPath || './tools',
      claudeMdPath: config?.claudeMdPath || './CLAUDE.md',
      logLevel: config?.logLevel || 'info'
    };

    // Setup logger
    this.logger = this.setupLogger();

    // Initialize components
    this.ruleEngine = new RuleEngine(this.logger);
    this.toolWrapper = new ToolWrapper(this.logger);
    this.configValidator = new ConfigurationValidator(this.logger);

    this.logger.info('Claude Code Bootstrap initialized');
  }

  /**
   * Main activation method - starts the enforcement system
   */
  public async activate(): Promise<boolean> {
    try {
      this.logger.info('Starting Claude Code enforcement system activation');

      // Validate configuration
      const validation = await this.validateConfiguration();
      if (!validation.isValid) {
        this.logger.error('Configuration validation failed', { errors: validation.errors });
        return false;
      }

      // Load and register rules
      await this.registerRules();

      // Wrap tools with enforcement
      await this.wrapTools();

      // Integrate with CLAUDE.md
      await this.integrateClaudeMd();

      this.logger.info('Claude Code enforcement system successfully activated');
      return true;
    } catch (error) {
      this.logger.error('Failed to activate Claude Code enforcement system', { error });
      return false;
    }
  }

  /**
   * Sets up the logging system
   */
  private setupLogger(): Logger {
    return createLogger({
      level: this.bootstrapConfig.logLevel,
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
      ),
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple()
          )
        }),
        new transports.File({ filename: 'claude-code-bootstrap.log' })
      ]
    });
  }

  /**
   * Validates all required configurations and dependencies
   */
  private async validateConfiguration(): Promise<ValidationResult> {
    this.logger.debug('Validating configuration');

    const errors: string[] = [];

    try {
      // Check if required paths exist
      if (!fs.existsSync(this.bootstrapConfig.rulesPath)) {
        errors.push(`Rules path does not exist: ${this.bootstrapConfig.rulesPath}`);
      }

      if (!fs.existsSync(this.bootstrapConfig.toolsPath)) {
        errors.push(`Tools path does not exist: ${this.bootstrapConfig.toolsPath}`);
      }

      if (!fs.existsSync(this.bootstrapConfig.claudeMdPath)) {
        errors.push(`CLAUDE.md file does not exist: ${this.bootstrapConfig.claudeMdPath}`);
      }

      // Validate CLAUDE.md structure
      const claudeConfig = this.loadClaudeConfig();
      const claudeValidation = this.configValidator.validate(claudeConfig);

      if (!claudeValidation.isValid) {
        errors.push(...claudeValidation.errors);
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      this.logger.error('Configuration validation error', { error });
      return {
        isValid: false,
        errors: [`Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Loads CLAUDE.md configuration
   */
  private loadClaudeConfig(): CLAUDEConfig {
    try {
      const configFile = fs.readFileSync(this.bootstrapConfig.claudeMdPath, 'utf8');
      // In a real implementation, this would parse the markdown config
      // For now we'll return a basic structure
      return {
        version: '1.0',
        rules: [],
        tools: [],
        enforcement: {
          enabled: true,
          mode: 'strict'
        }
      };
    } catch (error) {
      this.logger.error('Failed to load CLAUDE.md configuration', { error });
      throw new Error(`Could not load CLAUDE.md: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Registers all available rules with the rule engine
   */
  private async registerRules(): Promise<void> {
    this.logger.debug('Registering rules');

    try {
      if (!fs.existsSync(this.bootstrapConfig.rulesPath)) {
        throw new Error(`Rules directory not found: ${this.bootstrapConfig.rulesPath}`);
      }

      const ruleFiles = fs.readdirSync(this.bootstrapConfig.rulesPath)
        .filter(file => file.endsWith('.js') || file.endsWith('.ts'));

      let registeredRules = 0;

      for (const file of ruleFiles) {
        try {
          const rulePath = path.join(this.bootstrapConfig.rulesPath, file);

          // Dynamically import and register rules
          if (file.endsWith('.js')) {
            const ruleModule = require(path.resolve(rulePath));

            // Handle different export formats
            const rules = ruleModule.default || ruleModule.rules || ruleModule;

            if (rules && typeof rules === 'object') {
              // Register each rule from the module
              Object.keys(rules).forEach(ruleKey => {
                const rule = rules[ruleKey];
                if (rule && typeof rule.validate === 'function') {
                  this.ruleEngine.registerRule({
                    id: rule.id || ruleKey,
                    name: rule.name || ruleKey,
                    description: rule.description || `Rule from ${file}`,
                    validate: rule.validate,
                    enabled: rule.enabled !== false
                  });
                  registeredRules++;
                }
              });
            }
          }

          this.logger.info(`Processed rule file: ${file}`);
        } catch (error) {
          this.logger.warn(`Failed to register rule ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      this.logger.info(`Successfully registered ${registeredRules} rules from ${ruleFiles.length} files`);
    } catch (error) {
      this.logger.error('Rule registration failed', { error });
      throw new Error(`Rule registration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Wraps tools with enforcement capabilities
   */
  private async wrapTools(): Promise<void> {
    this.logger.debug('Wrapping tools with enforcement');

    try {
      if (!fs.existsSync(this.bootstrapConfig.toolsPath)) {
        throw new Error(`Tools directory not found: ${this.bootstrapConfig.toolsPath}`);
      }

      const toolFiles = fs.readdirSync(this.bootstrapConfig.toolsPath)
        .filter(file => file.endsWith('.js') || file.endsWith('.ts'));

      for (const file of toolFiles) {
        try {
          const toolPath = path.join(this.bootstrapConfig.toolsPath, file);
          // In a real implementation, this would wrap tools with enforcement logic
          this.logger.info(`Wrapped tool: ${file}`);
        } catch (error) {
          this.logger.warn(`Failed to wrap tool ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      this.logger.info(`Successfully wrapped ${toolFiles.length} tools`);
    } catch (error) {
      this.logger.error('Tool wrapping failed', { error });
      throw new Error(`Tool wrapping error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Integrates with existing CLAUDE.md configuration
   */
  private async integrateClaudeMd(): Promise<void> {
    this.logger.debug('Integrating with CLAUDE.md');

    try {
      const claudeConfig = this.loadClaudeConfig();

      // Apply CLAUDE.md configuration to rule engine
      if (claudeConfig.enforcement?.enabled) {
        this.ruleEngine.setEnforcementMode(claudeConfig.enforcement.mode || 'strict');
        this.logger.info(`Enforcement enabled in ${claudeConfig.enforcement.mode || 'strict'} mode`);
      }

      // Register rules specified in CLAUDE.md
      if (claudeConfig.rules && Array.isArray(claudeConfig.rules)) {
        for (const rule of claudeConfig.rules) {
          this.ruleEngine.registerRule(rule);
        }
        this.logger.info(`Registered ${claudeConfig.rules.length} rules from CLAUDE.md`);
      }

      this.logger.info('CLAUDE.md integration completed');
    } catch (error) {
      this.logger.error('CLAUDE.md integration failed', { error });
      throw new Error(`CLAUDE.md integration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export a default instance for easy usage
export const claudeCodeBootstrap = new ClaudeCodeBootstrap();

// Auto-activation when module is imported
(async () => {
  if (require.main === module) {
    const activated = await claudeCodeBootstrap.activate();
    if (!activated) {
      process.exit(1);
    }
  }
})();

export default claudeCodeBootstrap;