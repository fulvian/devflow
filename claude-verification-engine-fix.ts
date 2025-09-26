/**
 * CLAUDE VERIFICATION ENGINE - CONTEXT7 COMPLIANT FIX
 *
 * PROBLEMA IDENTIFICATO: Regex literal malformato alla linea 131
 * ERRORE: \.(ts|tsx|js|jsx|json|md|sql)$/.test(file)
 * CAUSA: Missing opening '/' delimiter
 *
 * SOLUZIONE: Context7-based error recovery with TypeScript best practices
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

// ====================================================================
// SEZIONE 1: TYPE DEFINITIONS - Context7 Pattern
// ====================================================================

interface FileScanResult {
  filePath: string;
  content: string;
  lines: string[];
  lineCount: number;
  fileExtension: string;
}

interface Violation {
  type: 'syntax-error' | 'devflow-rule' | 'security-issue';
  rule: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  filePath: string;
  line: number;
  column?: number;
  message: string;
  suggestion: string;
  context?: string;
}

interface SyntaxErrorRecovery {
  originalError: Error;
  recoveredCode: string;
  confidence: number;
  method: 'pattern-matching' | 'ast-reconstruction' | 'manual-fix';
}

// ====================================================================
// SEZIONE 2: ROBUST REGEX PATTERNS - Best Practice
// ====================================================================

class RegexPatterns {
  /**
   * Context7-compliant file extension pattern
   * Robusta gestione delle estensioni con type safety
   */
  static readonly SOURCE_FILES = /\.(ts|tsx|js|jsx|json|md|sql)$/;

  /**
   * Alternative patterns for different scenarios
   */
  static readonly TYPESCRIPT_FILES = /\.(ts|tsx)$/;
  static readonly JAVASCRIPT_FILES = /\.(js|jsx)$/;
  static readonly CONFIG_FILES = /\.(json|md|sql)$/;

  /**
   * Safe regex testing with error handling
   */
  static testFileExtension(filename: string): boolean {
    try {
      return this.SOURCE_FILES.test(filename);
    } catch (error) {
      console.error(`Regex test failed for file: ${filename}`, error);
      return false;
    }
  }

  /**
   * Get file type classification
   */
  static classifyFile(filename: string): 'typescript' | 'javascript' | 'config' | 'other' {
    if (this.TYPESCRIPT_FILES.test(filename)) return 'typescript';
    if (this.JAVASCRIPT_FILES.test(filename)) return 'javascript';
    if (this.CONFIG_FILES.test(filename)) return 'config';
    return 'other';
  }
}

// ====================================================================
// SEZIONE 3: SYNTAX ERROR RECOVERY ENGINE - Context7 Pattern
// ====================================================================

class SyntaxErrorRecoveryEngine {
  private static readonly COMMON_REGEX_FIXES = [
    {
      pattern: /^\\\.(.+)\$$/,
      fix: (match: string) => `/${match}/`,
      confidence: 0.95,
      description: 'Missing regex delimiters'
    },
    {
      pattern: /^([^\/].+[^\/])$/,
      fix: (match: string) => `/${match}/`,
      confidence: 0.80,
      description: 'Likely missing regex delimiters'
    }
  ];

  /**
   * Attempts to recover from common regex syntax errors
   */
  static recoverRegexSyntax(malformedRegex: string): SyntaxErrorRecovery | null {
    for (const fixPattern of this.COMMON_REGEX_FIXES) {
      const match = malformedRegex.match(fixPattern.pattern);
      if (match) {
        const recoveredCode = fixPattern.fix(malformedRegex);
        return {
          originalError: new Error(`Malformed regex: ${malformedRegex}`),
          recoveredCode,
          confidence: fixPattern.confidence,
          method: 'pattern-matching'
        };
      }
    }
    return null;
  }

  /**
   * Validates recovered syntax
   */
  static validateRecoveredRegex(regexStr: string): boolean {
    try {
      new RegExp(regexStr);
      return true;
    } catch {
      return false;
    }
  }
}

// ====================================================================
// SEZIONE 4: ENHANCED FILE SCANNER - Production Ready
// ====================================================================

export class EnhancedClaudeVerificationEngine {
  private isClaudeMode: boolean;
  private errorRecovery: boolean;
  private readonly readFileAsync = promisify(fs.readFile);

  constructor(options: { claudeMode?: boolean; errorRecovery?: boolean } = {}) {
    this.isClaudeMode = options.claudeMode ?? false;
    this.errorRecovery = options.errorRecovery ?? true;
  }

  /**
   * CORRETTO: Scansione file con regex pattern sicuro
   * Context7-compliant implementation
   */
  private getAllProjectFiles(dirPath: string, fileList: string[] = []): string[] {
    try {
      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        const filePath = path.join(dirPath, item);

        try {
          const stat = fs.statSync(filePath);

          if (stat.isDirectory()) {
            this.getAllProjectFiles(filePath, fileList);
          } else {
            // ✅ FIXED: Proper regex pattern with delimiters
            if (RegexPatterns.testFileExtension(item)) {
              fileList.push(filePath);
            }
          }
        } catch (fileError) {
          console.warn(`Cannot access file: ${filePath}`, fileError);
          continue;
        }
      }
    } catch (dirError) {
      console.error(`Cannot read directory: ${dirPath}`, dirError);
    }

    return fileList;
  }

  /**
   * Enhanced file content analysis with error recovery
   */
  private async analyzeFileContent(filePath: string): Promise<FileScanResult | null> {
    try {
      const content = await this.readFileAsync(filePath, 'utf8');
      const lines = content.split('\n');

      return {
        filePath,
        content,
        lines,
        lineCount: lines.length,
        fileExtension: path.extname(filePath)
      };
    } catch (error) {
      if (this.errorRecovery) {
        console.warn(`File analysis failed for ${filePath}, attempting recovery...`);
        return this.attemptFileRecovery(filePath, error as Error);
      }
      throw error;
    }
  }

  /**
   * File recovery mechanism
   */
  private async attemptFileRecovery(filePath: string, originalError: Error): Promise<FileScanResult | null> {
    try {
      // Try different encodings
      const encodings = ['utf8', 'latin1', 'ascii'];

      for (const encoding of encodings) {
        try {
          const content = await this.readFileAsync(filePath, encoding as BufferEncoding);
          const lines = content.split('\n');

          console.log(`✅ File recovery successful using ${encoding} encoding: ${filePath}`);

          return {
            filePath,
            content,
            lines,
            lineCount: lines.length,
            fileExtension: path.extname(filePath)
          };
        } catch {
          continue;
        }
      }
    } catch (recoveryError) {
      console.error(`File recovery failed for ${filePath}:`, recoveryError);
    }

    return null;
  }

  /**
   * Context7-compliant DevFlow rules checker
   */
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
          suggestion: 'Refactor into smaller modules or use MCP delegation',
          context: `File classification: ${RegexPatterns.classifyFile(fileResult.filePath)}`
        });
      }

      // Enhanced SQLite usage detection
      if (this.checkSQLiteUsage(fileResult)) {
        const sqliteLine = this.findLineWithContent(fileResult.lines, ['sqlite', 'SQLite']);
        violations.push({
          type: 'devflow-rule',
          rule: 'sqlite-usage',
          severity: 'high',
          filePath: fileResult.filePath,
          line: sqliteLine,
          message: 'Direct SQLite usage detected',
          suggestion: 'Use the unified DevFlow database interface (./data/devflow_unified.sqlite)',
          context: 'Reference CLAUDE.md for database architecture requirements'
        });
      }

      // Check for syntax errors in TypeScript files
      if (RegexPatterns.TYPESCRIPT_FILES.test(fileResult.filePath)) {
        const syntaxViolations = this.checkTypescriptSyntax(fileResult);
        violations.push(...syntaxViolations);
      }
    }

    return violations;
  }

  /**
   * TypeScript syntax validation with recovery
   */
  private checkTypescriptSyntax(fileResult: FileScanResult): Violation[] {
    const violations: Violation[] = [];

    for (let i = 0; i < fileResult.lines.length; i++) {
      const line = fileResult.lines[i];

      // Check for malformed regex patterns
      const regexPatternCheck = /\\\..*\$\/\.test\(/;
      if (regexPatternCheck.test(line)) {
        const recovery = SyntaxErrorRecoveryEngine.recoverRegexSyntax(line);

        violations.push({
          type: 'syntax-error',
          rule: 'malformed-regex',
          severity: 'critical',
          filePath: fileResult.filePath,
          line: i + 1,
          column: line.indexOf('\\.('),
          message: 'Malformed regex literal detected',
          suggestion: recovery ?
            `Replace with: ${recovery.recoveredCode}` :
            'Fix regex delimiters: ensure pattern is wrapped in forward slashes',
          context: `Line: ${line.trim()}`
        });
      }
    }

    return violations;
  }

  /**
   * Enhanced SQLite usage detection
   */
  private checkSQLiteUsage(fileResult: FileScanResult): boolean {
    const sqlitePatterns = [
      /import.*sqlite/i,
      /require.*sqlite/i,
      /new\s+sqlite/i,
      /\.sqlite$/,
      /SQLite/,
      /sqlite3/
    ];

    return sqlitePatterns.some(pattern => pattern.test(fileResult.content));
  }

  /**
   * Find line containing specific content
   */
  private findLineWithContent(lines: string[], searchTerms: string[]): number {
    for (let i = 0; i < lines.length; i++) {
      if (searchTerms.some(term => lines[i].toLowerCase().includes(term.toLowerCase()))) {
        return i + 1;
      }
    }
    return 1;
  }

  /**
   * Public API: Comprehensive verification
   */
  public async verifyProject(projectPath: string): Promise<{
    violations: Violation[];
    summary: {
      totalFiles: number;
      totalViolations: number;
      criticalIssues: number;
      recoveredErrors: number;
    };
  }> {
    console.log('🔍 Starting enhanced Claude verification...');

    try {
      // Get all project files
      const allFiles = this.getAllProjectFiles(projectPath);
      console.log(`📁 Found ${allFiles.length} source files`);

      // Analyze files with error recovery
      const fileResults: FileScanResult[] = [];
      let recoveredErrors = 0;

      for (const file of allFiles) {
        try {
          const result = await this.analyzeFileContent(file);
          if (result) {
            fileResults.push(result);
          }
        } catch (error) {
          recoveredErrors++;
          console.warn(`File analysis failed: ${file}`, error);
        }
      }

      // Check for violations
      const violations = this.checkDevFlowRules(fileResults);

      // Generate summary
      const summary = {
        totalFiles: allFiles.length,
        totalViolations: violations.length,
        criticalIssues: violations.filter(v => v.severity === 'critical').length,
        recoveredErrors
      };

      console.log('✅ Verification completed:', summary);

      return { violations, summary };

    } catch (error) {
      console.error('❌ Verification failed:', error);
      throw error;
    }
  }
}

// ====================================================================
// SEZIONE 5: CLI INTEGRATION & USAGE EXAMPLES
// ====================================================================

/**
 * Example usage for the corrected verification engine
 */
export function createFixedVerificationEngine() {
  return new EnhancedClaudeVerificationEngine({
    claudeMode: process.env.DEVFLOW_MODE === 'claude-only',
    errorRecovery: true
  });
}

/**
 * Quick fix function to apply the specific regex correction
 */
export function applyRegexFix(sourceCode: string): string {
  // Apply the specific fix for the identified issue
  return sourceCode.replace(
    /if\s*\(\\\..*?\$\/\.test\(/g,
    'if (/\\.(ts|tsx|js|jsx|json|md|sql)$/.test('
  );
}

/**
 * Export for easy integration
 */
export { RegexPatterns, SyntaxErrorRecoveryEngine };
export default EnhancedClaudeVerificationEngine;