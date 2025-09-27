/**
 * Enforcement Mechanism Implementation for Claude Code Integration
 * Task ID: DEVFLOW-RULES-002
 *
 * This module implements the prescriptive rules as actual enforcement mechanisms
 * for Claude Code integration, including pre-tool validation hooks, Synthetic
 * delegation redirect, DAIC mode integration, and violation logging.
 */

import { Tool, ToolContext, ToolResult } from './tool-system';
import { DAICMode } from './daic-mode';
import { SyntheticDelegate } from './synthetic-delegation';
import { Logger, LogLevel } from './logging';

// Type definitions
export interface EnforcementRule {
  id: string;
  name: string;
  description: string;
  appliesTo: ('write' | 'edit' | 'read' | 'execute')[];
  validate: (context: ToolContext) => ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  violations: Violation[];
  suggestedAction?: 'redirect' | 'block' | 'allow';
}

export interface Violation {
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  context: ToolContext;
}

export interface EnforcementConfig {
  enablePreToolValidation: boolean;
  enableSyntheticDelegation: boolean;
  enableDAICModeIntegration: boolean;
  enableViolationLogging: boolean;
  emergencyBypassEnabled: boolean;
  emergencyBypassCode?: string;
}

export interface EnforcementContext {
  tool: Tool;
  context: ToolContext;
  daicMode: DAICMode;
  config: EnforcementConfig;
}

// Main enforcement class
export class ClaudeCodeEnforcement {
  private rules: EnforcementRule[] = [];
  private logger: Logger;
  private syntheticDelegate: SyntheticDelegate;
  private violations: Violation[] = [];
  private emergencyBypassActivated = false;

  constructor(
    private config: EnforcementConfig,
    logger: Logger,
    syntheticDelegate: SyntheticDelegate
  ) {
    this.logger = logger;
    this.syntheticDelegate = syntheticDelegate;
    this.initializeRules();
  }

  /**
   * Initialize all enforcement rules
   */
  private initializeRules(): void {
    // Rule 1: Prevent direct write/edit operations in DAIC mode
    this.rules.push({
      id: 'DAIC_WRITE_PROTECTION',
      name: 'DAIC Write Protection',
      description: 'Prevents direct write/edit operations when DAIC mode is active',
      appliesTo: ['write', 'edit'],
      validate: (context: ToolContext): ValidationResult => {
        if (context.daicMode?.isActive &&
            (context.operation === 'write' || context.operation === 'edit')) {
          return {
            valid: false,
            violations: [{
              ruleId: 'DAIC_WRITE_PROTECTION',
              severity: 'critical',
              message: 'Direct write/edit operations not allowed in DAIC mode',
              timestamp: new Date(),
              context
            }],
            suggestedAction: 'redirect'
          };
        }
        return { valid: true, violations: [] };
      }
    });

    // Rule 2: Require Synthetic delegation for write/edit operations
    this.rules.push({
      id: 'SYNTHETIC_DELEGATION_REQUIRED',
      name: 'Synthetic Delegation Required',
      description: 'Requires Synthetic delegation for all write/edit operations',
      appliesTo: ['write', 'edit'],
      validate: (context: ToolContext): ValidationResult => {
        if ((context.operation === 'write' || context.operation === 'edit') &&
            !context.delegation?.isSynthetic) {
          return {
            valid: false,
            violations: [{
              ruleId: 'SYNTHETIC_DELEGATION_REQUIRED',
              severity: 'high',
              message: 'Write/Edit operations require Synthetic delegation',
              timestamp: new Date(),
              context
            }],
            suggestedAction: 'redirect'
          };
        }
        return { valid: true, violations: [] };
      }
    });

    // Rule 3: Context-aware resource access control
    this.rules.push({
      id: 'CONTEXTUAL_ACCESS_CONTROL',
      name: 'Contextual Access Control',
      description: 'Enforces context-aware access control based on user permissions',
      appliesTo: ['write', 'edit', 'read'],
      validate: (context: ToolContext): ValidationResult => {
        // Example implementation - would integrate with actual permission system
        if (context.resource && context.user) {
          const hasPermission = this.checkResourcePermission(
            context.user,
            context.resource,
            context.operation
          );

          if (!hasPermission) {
            return {
              valid: false,
              violations: [{
                ruleId: 'CONTEXTUAL_ACCESS_CONTROL',
                severity: 'medium',
                message: `Insufficient permissions for ${context.operation} operation on ${context.resource}`,
                timestamp: new Date(),
                context
              }],
              suggestedAction: 'block'
            };
          }
        }
        return { valid: true, violations: [] };
      }
    });
  }

  /**
   * Pre-tool validation hook
   * @param tool The tool being executed
   * @param context The execution context
   * @returns Validation result
   */
  async preToolValidation(tool: Tool, context: ToolContext): Promise<ValidationResult> {
    if (!this.config.enablePreToolValidation) {
      return { valid: true, violations: [] };
    }

    // Check for emergency bypass
    if (this.emergencyBypassActivated) {
      this.logger.log(LogLevel.INFO, 'Emergency bypass activated - skipping validation');
      return { valid: true, violations: [] };
    }

    const results: ValidationResult[] = [];

    // Apply context-aware rules
    for (const rule of this.rules) {
      if (rule.appliesTo.includes(context.operation as any)) {
        const result = rule.validate(context);
        results.push(result);

        // Log violations
        if (this.config.enableViolationLogging && result.violations.length > 0) {
          result.violations.forEach(violation => {
            this.violations.push(violation);
            this.logger.log(LogLevel.WARN, `Rule violation: ${violation.message}`, violation);
          });
        }
      }
    }

    // Aggregate results
    const allValid = results.every(r => r.valid);
    const allViolations = results.flatMap(r => r.violations);

    // Determine suggested action based on violations
    let suggestedAction: 'redirect' | 'block' | 'allow' | undefined;
    if (allViolations.some(v => v.severity === 'critical')) {
      suggestedAction = 'block';
    } else if (allViolations.some(v => v.ruleId === 'SYNTHETIC_DELEGATION_REQUIRED' ||
                                       v.ruleId === 'DAIC_WRITE_PROTECTION')) {
      suggestedAction = 'redirect';
    }

    return {
      valid: allValid,
      violations: allViolations,
      suggestedAction
    };
  }

  /**
   * Automatic Synthetic delegation redirect
   * @param context The execution context
   * @returns Redirected context with Synthetic delegation
   */
  async applySyntheticDelegationRedirect(context: ToolContext): Promise<ToolContext> {
    if (!this.config.enableSyntheticDelegation) {
      return context;
    }

    // If already has Synthetic delegation, return as-is
    if (context.delegation?.isSynthetic) {
      return context;
    }

    // Apply Synthetic delegation
    const syntheticContext = await this.syntheticDelegate.createSyntheticContext(context);

    this.logger.log(LogLevel.INFO, 'Applied Synthetic delegation redirect', {
      originalContext: context,
      syntheticContext
    });

    return syntheticContext;
  }

  /**
   * DAIC mode integration
   * @param context The execution context
   * @returns Modified context based on DAIC mode
   */
  applyDAICModeIntegration(context: ToolContext): ToolContext {
    if (!this.config.enableDAICModeIntegration || !context.daicMode?.isActive) {
      return context;
    }

    // Apply DAIC-specific restrictions
    const daicContext = { ...context };

    // Example: Restrict certain operations in DAIC mode
    if (context.operation === 'write' || context.operation === 'edit') {
      daicContext.restricted = true;
      this.logger.log(LogLevel.INFO, 'Applied DAIC mode restrictions', context);
    }

    return daicContext;
  }

  /**
   * Tool-level enforcement
   * @param tool The tool being executed
   * @param context The execution context
   * @returns Enforcement result
   */
  async enforceToolLevelRules(tool: Tool, context: ToolContext): Promise<ToolResult> {
    // Apply pre-tool validation
    const validation = await this.preToolValidation(tool, context);

    if (!validation.valid) {
      // Handle violations based on suggested action
      switch (validation.suggestedAction) {
        case 'block':
          this.logger.log(LogLevel.ERROR, 'Tool execution blocked due to violations', validation);
          return {
            success: false,
            error: 'Operation blocked due to policy violations',
            violations: validation.violations
          };

        case 'redirect':
          this.logger.log(LogLevel.INFO, 'Redirecting to Synthetic delegation', validation);
          const redirectedContext = await this.applySyntheticDelegationRedirect(context);
          // Re-run validation with redirected context
          const redirectedValidation = await this.preToolValidation(tool, redirectedContext);
          if (!redirectedValidation.valid && redirectedValidation.suggestedAction === 'block') {
            return {
              success: false,
              error: 'Operation blocked even after redirection',
              violations: redirectedValidation.violations
            };
          }
          // Continue with redirected context
          context = redirectedContext;
          break;

        default:
          // Log but allow to proceed for lower severity violations
          this.logger.log(LogLevel.WARN, 'Proceeding despite policy violations', validation);
      }
    }

    // Apply DAIC mode integration
    context = this.applyDAICModeIntegration(context);

    // Execute tool with enforced context
    try {
      const result = await tool.execute(context);
      return result;
    } catch (error) {
      this.logger.log(LogLevel.ERROR, 'Tool execution failed', { error, context });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Activate emergency bypass
   * @param bypassCode The emergency bypass code
   * @returns Whether bypass was successfully activated
   */
  activateEmergencyBypass(bypassCode?: string): boolean {
    if (!this.config.emergencyBypassEnabled) {
      this.logger.log(LogLevel.WARN, 'Emergency bypass is disabled');
      return false;
    }

    if (this.config.emergencyBypassCode &&
        bypassCode !== this.config.emergencyBypassCode) {
      this.logger.log(LogLevel.WARN, 'Invalid emergency bypass code provided');
      return false;
    }

    this.emergencyBypassActivated = true;
    this.logger.log(LogLevel.CRITICAL, 'Emergency bypass activated');
    return true;
  }

  /**
   * Deactivate emergency bypass
   */
  deactivateEmergencyBypass(): void {
    this.emergencyBypassActivated = false;
    this.logger.log(LogLevel.INFO, 'Emergency bypass deactivated');
  }

  /**
   * Get all recorded violations
   * @returns List of violations
   */
  getViolations(): Violation[] {
    return [...this.violations];
  }

  /**
   * Clear violation history
   */
  clearViolations(): void {
    this.violations = [];
  }

  /**
   * Check resource permission (placeholder implementation)
   * @param user The user
   * @param resource The resource
   * @param operation The operation
   * @returns Whether user has permission
   */
  private checkResourcePermission(
    user: any,
    resource: string,
    operation: string
  ): boolean {
    // This would integrate with actual permission system
    // Placeholder implementation always returns true
    return true;
  }
}

// Export types for external use
export { Tool, ToolContext, ToolResult, DAICMode, SyntheticDelegate, Logger };