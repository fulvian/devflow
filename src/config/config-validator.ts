import { Logger } from 'winston';
import { CLAUDEConfig } from '../types/claude-config';

interface ValidationResponse {
  isValid: boolean;
  errors: string[];
}

export class ConfigurationValidator {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  public validate(config: CLAUDEConfig): ValidationResponse {
    const errors: string[] = [];
    
    try {
      if (!config.version) {
        errors.push('Missing required field: version');
      }
      
      if (config.enforcement) {
        const validModes = ['strict', 'permissive', 'report-only'];
        if (config.enforcement.mode && !validModes.includes(config.enforcement.mode)) {
          errors.push(`Invalid enforcement mode: ${config.enforcement.mode}`);
        }
      }
      
      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      this.logger.error('Configuration validation error', { error });
      return {
        isValid: false,
        errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
}