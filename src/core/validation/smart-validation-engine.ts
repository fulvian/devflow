import { EventEmitter } from 'events';
import { ProjectDetector } from './project-detector';
import { ValidationExecutor } from './validation-executor';
import { ProjectType, ValidationResult, ValidationConfig } from './validation-types';

export class SmartValidationEngine extends EventEmitter {
  private detector: ProjectDetector;
  private executor: ValidationExecutor;
  private activeValidations: Map<string, Promise<ValidationResult[]>>;
  private metrics: Map<ProjectType, { avgDuration: number; successRate: number }>;

  constructor(private config: ValidationConfig = {}) {
    super();
    this.detector = new ProjectDetector();
    this.executor = new ValidationExecutor(config);
    this.activeValidations = new Map();
    this.metrics = new Map();
    
    // Bind event handlers
    this.executor.on('validation-start', (projectId) => 
      this.emit('validation-start', projectId));
    this.executor.on('validation-complete', (result) => 
      this.emit('validation-complete', result));
    this.executor.on('validation-error', (error) => 
      this.emit('validation-error', error));
  }

  async validateProject(projectPath: string): Promise<ValidationResult[]> {
    // Prevent duplicate validations
    if (this.activeValidations.has(projectPath)) {
      return this.activeValidations.get(projectPath)!;
    }

    const validationPromise = this.performValidation(projectPath);
    this.activeValidations.set(projectPath, validationPromise);
    
    try {
      const results = await validationPromise;
      this.updateMetrics(results);
      return results;
    } finally {
      this.activeValidations.delete(projectPath);
    }
  }

  private async performValidation(projectPath: string): Promise<ValidationResult[]> {
    try {
      // 1. Detect project type
      const projectInfo = await this.detector.detectProject(projectPath);
      this.emit('project-detected', projectInfo);
      
      // 2. Get validation commands for project type
      const commands = this.getValidationCommands(projectInfo.type);
      
      // 3. Execute validations in parallel
      const results = await this.executor.executeValidations(
        projectPath, 
        commands, 
        projectInfo
      );
      
      return results;
    } catch (error) {
      this.emit('validation-error', { projectPath, error });
      throw error;
    }
  }

  private getValidationCommands(projectType: ProjectType): string[] {
    const config = this.config.rules?.[projectType] || {};
    
    // Default commands by project type
    const defaultCommands: Record<ProjectType, string[]> = {
      [ProjectType.NPM]: ['npm run lint', 'npm test'],
      [ProjectType.YARN]: ['yarn lint', 'yarn test'],
      [ProjectType.PNPM]: ['pnpm lint', 'pnpm test'],
      [ProjectType.CARGO]: ['cargo check', 'cargo test'],
      [ProjectType.MAKE]: ['make lint', 'make test'],
      [ProjectType.GRADLE]: ['./gradlew check'],
      [ProjectType.MAVEN]: ['mvn test'],
      [ProjectType.UNKNOWN]: []
    };

    // Allow config override
    return config.commands || defaultCommands[projectType] || [];
  }

  private updateMetrics(results: ValidationResult[]): void {
    for (const result of results) {
      const current = this.metrics.get(result.projectType) || { 
        avgDuration: 0, 
        successRate: 1 
      };
      
      const totalRuns = 1 / (1 - current.successRate);
      const newSuccessRate = (current.successRate * totalRuns + (result.success ? 1 : 0)) / (totalRuns + 1);
      
      const newAvgDuration = current.avgDuration > 0 
        ? (current.avgDuration * totalRuns + result.duration) / (totalRuns + 1)
        : result.duration;
        
      this.metrics.set(result.projectType, {
        avgDuration: newAvgDuration,
        successRate: newSuccessRate
      });
    }
  }

  getMetrics(): Map<ProjectType, { avgDuration: number; successRate: number }> {
    return new Map(this.metrics);
  }

  async validateWorkspace(workspacePath: string): Promise<ValidationResult[]> {
    const projects = await this.detector.findProjects(workspacePath);
    const allResults: ValidationResult[] = [];
    
    // Process projects in parallel but limit concurrency
    const concurrencyLimit = this.config.concurrency || 4;
    for (let i = 0; i < projects.length; i += concurrencyLimit) {
      const batch = projects.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.all(
        batch.map(p => this.validateProject(p.path))
      );
      allResults.push(...batchResults.flat());
    }
    
    return allResults;
  }
}
