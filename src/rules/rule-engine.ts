import { Logger } from 'winston';
import { RuleConfig } from '../types/claude-config';

export class RuleEngine {
  private rules: Map<string, RuleConfig> = new Map();
  private enforcementMode: string = 'strict';
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  public registerRule(rule: RuleConfig): void {
    this.rules.set(rule.id, rule);
    this.logger.debug(`Rule registered: ${rule.id}`);
  }

  public setEnforcementMode(mode: string): void {
    this.enforcementMode = mode;
    this.logger.info(`Enforcement mode set to: ${mode}`);
  }

  public getRules(): RuleConfig[] {
    return Array.from(this.rules.values());
  }

  public isRuleEnabled(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    return rule ? rule.enabled : false;
  }
}