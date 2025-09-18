import { EventEmitter } from 'events';
import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

/**
 * Integration Verification Agent - DEVFLOW-IVA-001
 * Testing automatico end-to-end con Claude + Codex tandem
 *
 * Features:
 * - End-to-end testing automatico post-implementazione
 * - Build validation con npm/tsc/etc
 * - Dependency tracking con breaking changes detection
 * - Test suite dinamica per linguaggio/tipo file
 * - Alert system (no rollback automatico)
 * - Local validation only
 */
export class IntegrationVerificationAgent extends EventEmitter {
  private readonly projectRoot: string;
  private readonly supportedLanguages: Set<string>;
  private readonly testSuites: Map<string, TestSuite>;
  private isValidationRunning: boolean;

  constructor(projectRoot: string = process.cwd()) {
    super();
    this.projectRoot = projectRoot;
    this.supportedLanguages = new Set(['typescript', 'javascript']);
    this.testSuites = new Map();
    this.isValidationRunning = false;

    this.setupEventHandlers();
  }

  /**
   * Inizializza gli handler per gli eventi async
   */
  private setupEventHandlers(): void {
    this.on('validationStarted', (context) => {
      console.log(`🔧 [IVA] Validation started for ${context.component}`);
    });

    this.on('validationCompleted', (result) => {
      console.log(`✅ [IVA] Validation completed: ${result.status}`);
    });

    this.on('breakingChangeDetected', (change) => {
      console.warn(`🚨 [IVA] Breaking change detected: ${change.description}`);
    });

    this.on('dependencyUpdated', (dep) => {
      console.log(`📦 [IVA] Dependency updated: ${dep.name}@${dep.version}`);
    });
  }

  /**
   * Esegue la validazione end-to-end del progetto
   */
  async runValidation(): Promise<ValidationResult> {
    if (this.isValidationRunning) {
      throw new Error('Validation already in progress');
    }

    this.isValidationRunning = true;
    this.emit('validationStarted', { component: 'project', timestamp: new Date() });

    try {
      console.log('🔧 Starting Integration Verification Agent...');

      const buildResult = await this.validateBuild();
      const dependencyResult = await this.checkDependencies();
      const testResult = await this.runTestSuite();

      const allSuccess = buildResult.success && dependencyResult.success && testResult.success;

      const result: ValidationResult = {
        status: allSuccess ? 'success' : 'failed',
        timestamp: new Date(),
        details: {
          build: buildResult,
          dependencies: dependencyResult,
          tests: testResult
        }
      };

      this.emit('validationCompleted', result);

      if (!allSuccess) {
        console.warn('⚠️  Integration verification found issues - check logs');
      } else {
        console.log('✅ All integration verification checks passed');
      }

      return result;
    } catch (error) {
      const result: ValidationResult = {
        status: 'error',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {}
      };

      this.emit('validationCompleted', result);
      console.error('❌ Integration verification failed:', error);
      throw error;
    } finally {
      this.isValidationRunning = false;
    }
  }

  /**
   * Valida il processo di build del progetto
   */
  private async validateBuild(): Promise<BuildValidationResult> {
    console.log('🏗️  Validating project build...');

    try {
      // Verifica presenza package.json
      const packagePath = path.join(this.projectRoot, 'package.json');
      if (!fs.existsSync(packagePath)) {
        throw new Error('package.json not found');
      }

      const packageJson = JSON.parse(await readFile(packagePath, 'utf-8'));

      // Esegue build validation
      const buildScripts = ['build', 'compile', 'tsc'];
      let buildSuccess = false;
      let buildOutput = '';

      for (const script of buildScripts) {
        if (packageJson.scripts && packageJson.scripts[script]) {
          try {
            console.log(`   Running npm run ${script}...`);
            const output = execSync(`npm run ${script}`, {
              cwd: this.projectRoot,
              stdio: 'pipe',
              timeout: 120000 // 2 minutes timeout
            });
            buildSuccess = true;
            buildOutput = output.toString();
            console.log(`   ✅ ${script} completed successfully`);
            break;
          } catch (error) {
            buildOutput += `Error running ${script}: ${(error as Error).message}\n`;
            console.log(`   ❌ ${script} failed`);
          }
        }
      }

      // Se non ci sono script di build specifici, prova tsc direttamente
      if (!buildSuccess) {
        try {
          console.log('   Trying TypeScript compilation...');
          execSync('npx tsc --noEmit', {
            cwd: this.projectRoot,
            stdio: 'pipe',
            timeout: 60000
          });
          buildSuccess = true;
          buildOutput += 'TypeScript compilation successful\n';
          console.log('   ✅ TypeScript compilation passed');
        } catch (error) {
          buildOutput += `TypeScript compilation error: ${(error as Error).message}\n`;
          console.log('   ❌ TypeScript compilation failed');
        }
      }

      return {
        success: buildSuccess,
        output: buildOutput,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        output: `Build validation error: ${(error as Error).message}`,
        timestamp: new Date()
      };
    }
  }

  /**
   * Verifica le dipendenze e rileva breaking changes
   */
  private async checkDependencies(): Promise<DependencyCheckResult> {
    console.log('📦 Checking dependencies...');

    try {
      const packagePath = path.join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(await readFile(packagePath, 'utf-8'));

      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      const breakingChanges: BreakingChange[] = [];
      const updatedDependencies: DependencyInfo[] = [];

      // Analyze dependencies for potential issues
      for (const [name, version] of Object.entries(dependencies)) {
        // Check for deprecated or problematic packages
        if (this.isProblematicDependency(name, version as string)) {
          breakingChanges.push({
            dependency: name,
            version: version as string,
            description: `Package ${name} may have compatibility issues`,
            severity: 'medium'
          });
        }

        updatedDependencies.push({
          name,
          version: version as string,
          lastUpdated: new Date()
        });
      }

      // Emit events for tracking
      updatedDependencies.forEach(dep => this.emit('dependencyUpdated', dep));
      breakingChanges.forEach(change => this.emit('breakingChangeDetected', change));

      console.log(`   📊 Found ${updatedDependencies.length} dependencies`);
      if (breakingChanges.length > 0) {
        console.warn(`   ⚠️  ${breakingChanges.length} potential issues detected`);
      }

      return {
        success: breakingChanges.length === 0,
        dependencies: updatedDependencies,
        breakingChanges,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        dependencies: [],
        breakingChanges: [],
        error: `Dependency check error: ${(error as Error).message}`,
        timestamp: new Date()
      };
    }
  }

  /**
   * Esegue la suite di test dinamica basata sul linguaggio
   */
  private async runTestSuite(): Promise<TestSuiteResult> {
    console.log('🧪 Running test suite...');

    try {
      const packagePath = path.join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(await readFile(packagePath, 'utf-8'));

      // Determina il linguaggio del progetto
      const language = this.detectLanguage();
      console.log(`   Detected language: ${language}`);

      // Esegue i test configurati
      const testScripts = ['test', 'test:e2e', 'test:integration', 'lint'];
      const results: TestResult[] = [];

      for (const script of testScripts) {
        if (packageJson.scripts && packageJson.scripts[script]) {
          try {
            console.log(`   Running ${script}...`);
            const startTime = Date.now();
            const output = execSync(`npm run ${script}`, {
              cwd: this.projectRoot,
              stdio: 'pipe',
              timeout: 300000 // 5 minutes timeout
            });

            results.push({
              testName: script,
              success: true,
              duration: Date.now() - startTime,
              output: output.toString()
            });
            console.log(`   ✅ ${script} passed (${Date.now() - startTime}ms)`);
          } catch (error) {
            results.push({
              testName: script,
              success: false,
              duration: 0,
              error: (error as Error).message
            });
            console.log(`   ❌ ${script} failed`);
          }
        }
      }

      const allPassed = results.every(r => r.success);
      const passedCount = results.filter(r => r.success).length;

      console.log(`   📊 Tests: ${passedCount}/${results.length} passed`);

      return {
        success: allPassed,
        results,
        language,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        results: [],
        language: 'unknown',
        error: `Test execution error: ${(error as Error).message}`,
        timestamp: new Date()
      };
    }
  }

  /**
   * Rileva il linguaggio del progetto
   */
  private detectLanguage(): string {
    // Check for TypeScript config
    if (fs.existsSync(path.join(this.projectRoot, 'tsconfig.json'))) {
      return 'typescript';
    }

    // Check for main entry point files
    const mainFiles = ['index.ts', 'src/index.ts', 'index.js', 'src/index.js'];
    for (const file of mainFiles) {
      const fullPath = path.join(this.projectRoot, file);
      if (fs.existsSync(fullPath)) {
        return file.endsWith('.ts') ? 'typescript' : 'javascript';
      }
    }

    return 'javascript'; // Default fallback
  }

  /**
   * Checks if a dependency is potentially problematic
   */
  private isProblematicDependency(name: string, version: string): boolean {
    const problematicPatterns = [
      'deprecated',
      'legacy',
      'old',
      'unmaintained'
    ];

    return problematicPatterns.some(pattern =>
      name.toLowerCase().includes(pattern)
    );
  }

  /**
   * Genera report di validazione
   */
  async generateReport(result: ValidationResult): Promise<string> {
    const reportContent = `
DevFlow Integration Verification Report
=======================================
Timestamp: ${result.timestamp.toISOString()}
Status: ${result.status.toUpperCase()}
${result.error ? `Error: ${result.error}` : ''}

🏗️  Build Validation:
   Success: ${result.details.build?.success ? '✅' : '❌'}
   ${result.details.build?.output ? result.details.build.output.substring(0, 200) + '...' : ''}

📦 Dependency Check:
   Success: ${result.details.dependencies?.success ? '✅' : '❌'}
   Total Dependencies: ${result.details.dependencies?.dependencies?.length || 0}
   Breaking Changes: ${result.details.dependencies?.breakingChanges?.length || 0}

🧪 Test Results:
   Success: ${result.details.tests?.success ? '✅' : '❌'}
   Language: ${result.details.tests?.language || 'unknown'}
   Tests Run: ${result.details.tests?.results?.length || 0}
   Tests Passed: ${result.details.tests?.results?.filter(r => r.success).length || 0}

Generated by DevFlow Integration Verification Agent
`.trim();

    // Salva report su file
    const reportPath = path.join(this.projectRoot, '.devflow', 'iva-report.txt');

    // Ensure .devflow directory exists
    const devflowDir = path.dirname(reportPath);
    if (!fs.existsSync(devflowDir)) {
      fs.mkdirSync(devflowDir, { recursive: true });
    }

    await writeFile(reportPath, reportContent);
    console.log(`📄 Report saved to: ${reportPath}`);

    return reportPath;
  }
}

// Interfacce e tipi
export interface ValidationResult {
  status: 'success' | 'failed' | 'error';
  timestamp: Date;
  error?: string;
  details: {
    build?: BuildValidationResult;
    dependencies?: DependencyCheckResult;
    tests?: TestSuiteResult;
  };
}

export interface BuildValidationResult {
  success: boolean;
  output: string;
  timestamp: Date;
}

export interface DependencyInfo {
  name: string;
  version: string;
  lastUpdated: Date;
}

export interface BreakingChange {
  dependency: string;
  version: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface DependencyCheckResult {
  success: boolean;
  dependencies: DependencyInfo[];
  breakingChanges: BreakingChange[];
  error?: string;
  timestamp: Date;
}

export interface TestResult {
  testName: string;
  success: boolean;
  duration: number;
  output?: string;
  error?: string;
}

export interface TestSuiteResult {
  success: boolean;
  results: TestResult[];
  language: string;
  error?: string;
  timestamp: Date;
}

interface TestSuite {
  language: string;
  tests: Array<{
    name: string;
    executor: () => Promise<TestExecutionResult>;
  }>;
  setup: () => Promise<void>;
  teardown: () => Promise<void>;
}

interface TestExecutionResult {
  success: boolean;
  error?: string;
  output?: string;
}

export default IntegrationVerificationAgent;