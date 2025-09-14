/**
 * Claude Code Workflow Integration for Enforcement System
 *
 * This module integrates the enforcement system into Claude Code's tool execution workflow,
 * intercepting Write/Edit operations, validating against rules, and automatically
 * redirecting to Synthetic delegation when required.
 */

import { ToolExecutor, ToolExecutionResult, ToolContext } from '../tools/types';
import { EnforcementRule, ViolationReport, EnforcementAction } from './enforcement-types';
import { SyntheticMCP } from '../synthetic/mcp';
import { DAICModeDetector } from '../daic/detection';
import { ConfigManager } from '../config/manager';
import { Logger } from '../logging/logger';

/**
 * Configuration interface for the enforcement integration
 */
interface EnforcementConfig {
  enabled: boolean;
  autoDelegation: boolean;
  violationReporting: boolean;
  daicModeDetection: boolean;
}

/**
 * Main integration class for the enforcement system
 */
export class EnforcementIntegration {
  private config: EnforcementConfig;
  private rules: EnforcementRule[] = [];
  private syntheticMCP: SyntheticMCP;
  private daicDetector: DAICModeDetector;
  private logger: Logger;

  constructor(
    configManager: ConfigManager,
    syntheticMCP: SyntheticMCP,
    daicDetector: DAICModeDetector,
    logger: Logger
  ) {
    this.config = configManager.get<EnforcementConfig>('enforcement', {
      enabled: true,
      autoDelegation: true,
      violationReporting: true,
      daicModeDetection: true
    });

    this.syntheticMCP = syntheticMCP;
    this.daicDetector = daicDetector;
    this.logger = logger;
  }

  /**
   * Registers enforcement rules
   * @param rules Array of enforcement rules
   */
  public registerRules(rules: EnforcementRule[]): void {
    this.rules = [...this.rules, ...rules];
    this.logger.info(`Registered ${rules.length} enforcement rules`);
  }

  /**
   * Wraps a tool executor with enforcement validation
   * @param toolExecutor Original tool executor
   * @returns Wrapped tool executor with enforcement
   */
  public createEnforcementWrapper(toolExecutor: ToolExecutor): ToolExecutor {
    return async (context: ToolContext): Promise<ToolExecutionResult> => {
      try {
        // Check if enforcement is enabled
        if (!this.config.enabled) {
          return await toolExecutor(context);
        }

        // Detect DAIC mode if enabled
        const isDAICMode = this.config.daicModeDetection
          ? await this.daicDetector.detect(context)
          : false;

        // Validate against enforcement rules
        const violations = await this.validateRules(context, isDAICMode);

        if (violations.length > 0) {
          // Handle violations
          return await this.handleViolations(context, violations, toolExecutor);
        }

        // Execute tool normally if no violations
        return await toolExecutor(context);
      } catch (error) {
        this.logger.error('Error in enforcement wrapper', error);
        throw error;
      }
    };
  }

  /**
   * Validates tool execution against registered rules
   * @param context Tool execution context
   * @param isDAICMode Whether DAIC mode is detected
   * @returns Array of violations
   */
  private async validateRules(context: ToolContext, isDAICMode: boolean): Promise<ViolationReport[]> {
    const violations: ViolationReport[] = [];

    for (const rule of this.rules) {
      try {
        // Skip rule if DAIC mode requirement doesn't match
        if (rule.requiresDAICMode && !isDAICMode) {
          continue;
        }

        const isValid = await rule.validator(context);
        if (!isValid) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            description: rule.description,
            context,
            timestamp: new Date(),
            severity: rule.severity
          });
        }
      } catch (error) {
        this.logger.error(`Error validating rule ${rule.id}`, error);
        // Continue with other rules even if one fails
      }
    }

    return violations;
  }

  /**
   * Handles violations according to configured actions
   * @param context Tool execution context
   * @param violations Detected violations
   * @param originalExecutor Original tool executor
   * @returns Tool execution result
   */
  private async handleViolations(
    context: ToolContext,
    violations: ViolationReport[],
    originalExecutor: ToolExecutor
  ): Promise<ToolExecutionResult> {
    // Report violations if configured
    if (this.config.violationReporting) {
      await this.reportViolations(violations);
    }

    // Determine enforcement action
    const action = this.determineEnforcementAction(violations);

    switch (action) {
      case EnforcementAction.BLOCK:
        return this.handleBlockAction(violations);

      case EnforcementAction.DELEGATE:
        return await this.handleDelegateAction(context, violations, originalExecutor);

      case EnforcementAction.WARN:
        return await this.handleWarnAction(context, violations, originalExecutor);

      default:
        // Default to original execution if no action determined
        return await originalExecutor(context);
    }
  }

  /**
   * Determines the appropriate enforcement action based on violations
   * @param violations Detected violations
   * @returns Enforcement action to take
   */
  private determineEnforcementAction(violations: ViolationReport[]): EnforcementAction {
    // If auto-delegation is enabled and we have violations, delegate
    if (this.config.autoDelegation && violations.length > 0) {
      return EnforcementAction.DELEGATE;
    }

    // Check for critical violations that should block execution
    const hasCriticalViolations = violations.some(v => v.severity === 'critical');
    if (hasCriticalViolations) {
      return EnforcementAction.BLOCK;
    }

    // For non-critical violations, warn but allow execution
    if (violations.length > 0) {
      return EnforcementAction.WARN;
    }

    return EnforcementAction.NONE;
  }

  /**
   * Handles BLOCK enforcement action
   * @param violations Detected violations
   * @returns Tool execution result indicating block
   */
  private handleBlockAction(violations: ViolationReport[]): ToolExecutionResult {
    const violationMessages = violations.map(v => `${v.ruleName}: ${v.description}`).join('; ');

    this.logger.warn(`Blocking tool execution due to violations: ${violationMessages}`);

    return {
      success: false,
      error: {
        type: 'ENFORCEMENT_VIOLATION',
        message: `Execution blocked due to policy violations: ${violationMessages}`,
        details: violations
      }
    };
  }

  /**
   * Handles DELEGATE enforcement action
   * @param context Tool execution context
   * @param violations Detected violations
   * @param originalExecutor Original tool executor
   * @returns Tool execution result from synthetic delegation
   */
  private async handleDelegateAction(
    context: ToolContext,
    violations: ViolationReport[],
    originalExecutor: ToolExecutor
  ): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Delegating to Synthetic MCP due to violations', {
        violationCount: violations.length
      });

      // Create delegation context with violations
      const delegationContext = {
        ...context,
        enforcementViolations: violations,
        delegationReason: 'ENFORCEMENT_VIOLATION'
      };

      // Delegate to Synthetic MCP
      const result = await this.syntheticMCP.execute(delegationContext);

      return {
        success: result.success,
        data: result.data,
        metadata: {
          ...result.metadata,
          enforcementDelegated: true,
          violations
        }
      };
    } catch (error) {
      this.logger.error('Error during synthetic delegation', error);

      // Fall back to original execution if delegation fails
      return await originalExecutor(context);
    }
  }

  /**
   * Handles WARN enforcement action
   * @param context Tool execution context
   * @param violations Detected violations
   * @param originalExecutor Original tool executor
   * @returns Tool execution result with warnings
   */
  private async handleWarnAction(
    context: ToolContext,
    violations: ViolationReport[],
    originalExecutor: ToolExecutor
  ): Promise<ToolExecutionResult> {
    const violationMessages = violations.map(v => `${v.ruleName}: ${v.description}`).join('; ');

    this.logger.warn(`Allowing execution with warnings: ${violationMessages}`);

    // Execute original tool but add warning metadata
    const result = await originalExecutor(context);

    return {
      ...result,
      metadata: {
        ...result.metadata,
        enforcementWarnings: violations
      }
    };
  }

  /**
   * Reports violations to configured reporting system
   * @param violations Violations to report
   */
  private async reportViolations(violations: ViolationReport[]): Promise<void> {
    try {
      // In a real implementation, this would send to a reporting service
      this.logger.info('Reporting violations', { violationCount: violations.length });

      // Example: Send to external reporting system
      // await this.reportingService.sendViolations(violations);
    } catch (error) {
      this.logger.error('Error reporting violations', error);
      // Don't fail execution if reporting fails
    }
  }

  /**
   * Updates configuration
   * @param newConfig Partial configuration update
   */
  public updateConfig(newConfig: Partial<EnforcementConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Enforcement configuration updated', newConfig);
  }

  /**
   * Gets current configuration
   * @returns Current enforcement configuration
   */
  public getConfig(): EnforcementConfig {
    return { ...this.config };
  }
}

// Export types for external use
export { EnforcementConfig, EnforcementRule, ViolationReport, EnforcementAction };