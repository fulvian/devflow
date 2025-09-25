import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { VerificationResult, Violation, FileScanResult } from './verification-types';
import { CometaVerificationIntegration } from './cometa-verification-integration';
import { VerificationConfig } from './verification-config';

class ClaudeVerificationEngine {
  private config: VerificationConfig;
  private integration: CometaVerificationIntegration;
  private taskId: string | null = null;
  private isClaudeMode: boolean = false;

  constructor() {
    this.config = new VerificationConfig();
    this.integration = new CometaVerificationIntegration();
  }

  public async runVerification(taskId?: string, claudeMode: boolean = false): Promise<VerificationResult> {
    this.taskId = taskId || null;
    this.isClaudeMode = claudeMode;
    
    console.log(`🔍 Claude Verification Engine initializing${this.taskId ? ` for task ${this.taskId}` : ''}...`);
    
    // Scan files
    const fileResults = await this.scanFiles();
    
    // Check DevFlow rules
    const ruleViolations = this.checkDevFlowRules(fileResults);
    
    // Identify bugs
    const bugViolations = await this.identifyBugs(fileResults);
    
    // Combine all violations
    const allViolations = [...ruleViolations, ...bugViolations];
    
    // Create result
    const result: VerificationResult = {
      taskId: this.taskId,
      timestamp: new Date().toISOString(),
      passed: allViolations.length === 0,
      violations: allViolations,
      summary: {
        totalFiles: fileResults.length,
        totalViolations: allViolations.length,
        criticalViolations: allViolations.filter(v => v.severity === 'critical').length,
        highViolations: allViolations.filter(v => v.severity === 'high').length,
        mediumViolations: allViolations.filter(v => v.severity === 'medium').length,
        lowViolations: allViolations.filter(v => v.severity === 'low').length
      }
    };
    
    // Save to database
    await this.integration.saveVerificationResult(result);
    
    // Generate correction tasks if needed
    if (allViolations.length > 0) {
      await this.integration.generateCorrectionTasks(result);
    }
    
    // Output results
    this.outputResults(result);
    
    return result;
  }

  private async scanFiles(): Promise<FileScanResult[]> {
    console.log('📁 Scanning project files...');
    
    const projectRoot = process.env.PROJECT_ROOT || '.';
    const files = this.getTaskFiles(projectRoot);
    
    const results: FileScanResult[] = [];
    
    for (const file of files) {
      try {
        const fullPath = path.join(projectRoot, file);
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        
        results.push({
          filePath: file,
          fullPath,
          lineCount: lines.length,
          content,
          lines
        });
      } catch (error) {
        console.warn(`⚠️  Could not read file ${file}:`, error.message);
      }
    }
    
    console.log(`📄 Scanned ${results.length} files`);
    return results;
  }

  private getTaskFiles(projectRoot: string): string[] {
    // If we have a specific task, get its files
    if (this.taskId) {
      try {
        const taskFile = path.join(projectRoot, '.claude', 'current_task.json');
        if (fs.existsSync(taskFile)) {
          const taskData = JSON.parse(fs.readFileSync(taskFile, 'utf8'));
          if (taskData.files) {
            return taskData.files;
          }
        }
      } catch (error) {
        console.warn('Could not read task files:', error.message);
      }
    }
    
    // Otherwise scan recent files or all project files
    return this.getAllProjectFiles(projectRoot);
  }

  private getAllProjectFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      // Skip node_modules and other ignored directories
      if (['node_modules', '.git', 'dist', 'build'].includes(file)) return;
      
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        this.getAllProjectFiles(filePath, fileList);
      } else {
        // Only include source files
        if (\.(ts|tsx|js|jsx|json|md|sql)$/.test(file)) {
          fileList.push(filePath);
        }
      }
    });
    
    return fileList;
  }

  private checkDevFlowRules(fileResults: FileScanResult[]): Violation[] {
    console.log('📋 Checking DevFlow rules...');
    
    const violations: Violation[] = [];
    
    for (const fileResult of fileResults) {
      // Check 100-line rule (bypassed in Claude mode)
      if (!this.isClaudeMode && fileResult.lineCount > 100) {
        violations.push({
          type: 'devflow-rule',
          rule: '100-line-limit',
          severity: 'medium',
          filePath: fileResult.filePath,
          line: fileResult.lineCount,
          message: `File exceeds 100 lines (${fileResult.lineCount} lines)`,
          suggestion: 'Refactor into smaller modules'
        });
      }
      
      // Check for SQLite usage
      if (fileResult.content.includes('sqlite') || fileResult.content.includes('SQLite')) {
        // Check if it's just a reference or actual database usage
        if (this.isLikelyDatabaseUsage(fileResult.content)) {
          violations.push({
            type: 'devflow-rule',
            rule: 'sqlite-usage',
            severity: 'high',
            filePath: fileResult.filePath,
            line: this.findLineWithContent(fileResult.lines, ['sqlite', 'SQLite']),
            message: 'Direct SQLite usage detected',
            suggestion: 'Use the unified DevFlow database interface instead'
          });
        }
      }
      
      // Check code quality
      const qualityIssues = this.checkCodeQuality(fileResult);
      violations.push(...qualityIssues);
    }
    
    console.log(`⚠️  Found ${violations.length} DevFlow rule violations`);
    return violations;
  }

  private isLikelyDatabaseUsage(content: string): boolean {
    // Simple heuristic to distinguish between references and actual usage
    const dbPatterns = [
      'sqlite3',
      'new Database',
      'openDatabase',
      'executeSql',
      'query(',
      '.run(',
      '.get(',
      '.all('
    ];
    
    return dbPatterns.some(pattern => content.includes(pattern));
  }

  private findLineWithContent(lines: string[], keywords: string[]): number {
    for (let i = 0; i < lines.length; i++) {
      for (const keyword of keywords) {
        if (lines[i].includes(keyword)) {
          return i + 1;
        }
      }
    }
    return 1;
  }

  private checkCodeQuality(fileResult: FileScanResult): Violation[] {
    const violations: Violation[] = [];
    const lines = fileResult.lines;
    
    // Check for TODO comments
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('TODO') || lines[i].includes('FIXME')) {
        violations.push({
          type: 'code-quality',
          rule: 'todo-comment',
          severity: 'low',
          filePath: fileResult.filePath,
          line: i + 1,
          message: 'TODO/FIXME comment found',
          suggestion: 'Address technical debt or create a task for it'
        });
      }
    }
    
    // Check for console.log in non-test files
    if (!fileResult.filePath.includes('.test.') && !fileResult.filePath.includes('.spec.')) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('console.log') && !lines[i].includes('//')) {
          violations.push({
            type: 'code-quality',
            rule: 'console-log',
            severity: 'low',
            filePath: fileResult.filePath,
            line: i + 1,
            message: 'console.log statement found in production code',
            suggestion: 'Remove or replace with proper logging'
          });
        }
      }
    }
    
    return violations;
  }

  private async identifyBugs(fileResults: FileScanResult[]): Promise<Violation[]> {
    console.log('🐛 Identifying potential bugs...');
    
    const violations: Violation[] = [];
    
    for (const fileResult of fileResults) {
      // Check for common JavaScript/TypeScript bugs
      
      // 1. == instead of ===
      for (let i = 0; i < fileResult.lines.length; i++) {
        const line = fileResult.lines[i];
        if (line.includes(' == ') && !line.includes(' === ') && !this.isInStringLiteral(line, ' == ')) {
          violations.push({
            type: 'bug',
            rule: 'equality-comparison',
            severity: 'medium',
            filePath: fileResult.filePath,
            line: i + 1,
            message: 'Potential unsafe equality comparison (==)',
            suggestion: 'Use strict equality (===) instead'
          });
        }
      }
      
      // 2. Unused variables (basic check)
      const unusedVarMatches = fileResult.content.match(/(let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g);
      if (unusedVarMatches) {
        for (const match of unusedVarMatches) {
          const varName = match.replace(/(let|const|var)\s+/, '').replace(/\s*=/, '');
          // Simple check - if variable is only declared and never used again
          const occurrences = (fileResult.content.match(new RegExp(`\\b${varName}\\b`, 'g')) || []).length;
          if (occurrences <= 1) {
            violations.push({
              type: 'bug',
              rule: 'unused-variable',
              severity: 'low',
              filePath: fileResult.filePath,
              line: 1, // Hard to determine exact line without parsing
              message: `Potentially unused variable: ${varName}`,
              suggestion: 'Remove unused variable or use it in the code'
            });
          }
        }
      }
      
      // 3. Missing await
      if (fileResult.filePath.endsWith('.ts') || fileResult.filePath.endsWith('.js')) {
        for (let i = 0; i < fileResult.lines.length; i++) {
          const line = fileResult.lines[i];
          if (line.includes('.then(') && !line.trim().startsWith('//')) {
            violations.push({
              type: 'bug',
              rule: 'missing-await',
              severity: 'medium',
              filePath: fileResult.filePath,
              line: i + 1,
              message: 'Promise.then() used instead of await',
              suggestion: 'Use async/await for better error handling'
            });
          }
        }
      }
    }
    
    console.log(`🐛 Found ${violations.length} potential bugs`);
    return violations;
  }

  private isInStringLiteral(line: string, pattern: string): boolean {
    // Very basic check to see if pattern is inside a string
    const patternIndex = line.indexOf(pattern);
    if (patternIndex === -1) return false;
    
    const before = line.substring(0, patternIndex);
    const singleQuotes = (before.match(/'/g) || []).length;
    const doubleQuotes = (before.match(/"/g) || []).length;
    const backticks = (before.match(/`/g) || []).length;
    
    return (singleQuotes % 2 === 1) || (doubleQuotes % 2 === 1) || (backticks % 2 === 1);
  }

  private outputResults(result: VerificationResult): void {
    console.log('\n🔍 VERIFICATION RESULTS');
    console.log('=====================');
    console.log(`Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Files Checked: ${result.summary.totalFiles}`);
    console.log(`Violations: ${result.summary.totalViolations}`);
    
    if (result.violations.length > 0) {
      console.log('\n📋 Violations by Severity:');
      console.log(`  Critical: ${result.summary.criticalViolations}`);
      console.log(`  High: ${result.summary.highViolations}`);
      console.log(`  Medium: ${result.summary.mediumViolations}`);
      console.log(`  Low: ${result.summary.lowViolations}\n`);
      
      console.log('📝 Detailed Violations:');
      result.violations.forEach((violation, index) => {
        console.log(`\n${index + 1}. [${violation.severity.toUpperCase()}] ${violation.rule}`);
        console.log(`   File: ${violation.filePath}:${violation.line}`);
        console.log(`   Issue: ${violation.message}`);
        console.log(`   Fix: ${violation.suggestion}`);
      });
      
      console.log('\n🔧 Correction tasks have been created in the database.');
      console.log('Run "/cometa list tasks" to see them.');
    } else {
      console.log('\n🎉 No violations found. Code is compliant!');
    }
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const taskId = args.find(arg => arg.startsWith('--task='))?.split('=')[1];
  const claudeMode = args.includes('--claude-mode');
  
  const engine = new ClaudeVerificationEngine();
  engine.runVerification(taskId, claudeMode).catch(error => {
    console.error('Verification failed:', error);
    process.exit(1);
  });
}

export default ClaudeVerificationEngine;
