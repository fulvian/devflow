// sast-engine.ts
import { AspectVerifiersSystem } from './aspect-verifiers-system';
import { SecurityRule, SecurityIssue, SecurityReport, LanguageSupport, SecurityMetrics } from './security-types';

/**
 * Static Application Security Testing (SAST) Engine
 * Analyzes source code for security vulnerabilities and anti-patterns
 */
export class SecurityAnalysisEngine {
  private rules: SecurityRule[] = [];
  private languageSupport: LanguageSupport[] = [];
  private aspectVerifiers: AspectVerifiersSystem;
  private falsePositivePatterns: RegExp[] = [];
  private metrics: SecurityMetrics = {
    totalScans: 0,
    vulnerabilitiesFound: 0,
    falsePositivesFiltered: 0,
    criticalIssues: 0,
    highIssues: 0,
    mediumIssues: 0,
    lowIssues: 0
  };

  constructor(aspectVerifiers: AspectVerifiersSystem) {
    this.aspectVerifiers = aspectVerifiers;
    this.initializeDefaultRules();
    this.initializeLanguageSupport();
    this.initializeFalsePositiveFilters();
  }

  /**
   * Initialize default security rules for common vulnerabilities
   */
  private initializeDefaultRules(): void {
    this.rules = [
      {
        id: 'SQL_INJECTION_001',
        name: 'SQL Injection Detection',
        description: 'Detects potential SQL injection vulnerabilities',
        severity: 'HIGH',
        pattern: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|EXECUTE)\b.*\$_(GET|POST|REQUEST)|\b(mysql_query|mysqli_query|pg_query)\b.*["'].*\$_(GET|POST|REQUEST))/gi,
        languages: ['PHP', 'JavaScript', 'Python'],
        remediation: 'Use parameterized queries or prepared statements instead of string concatenation'
      },
      {
        id: 'XSS_001',
        name: 'Cross-Site Scripting Detection',
        description: 'Detects potential XSS vulnerabilities',
        severity: 'HIGH',
        pattern: /(document\.write\(|\.innerHTML\s*=|eval\(|javascript:|<script[^>]*>.*<\/script>)/gi,
        languages: ['JavaScript', 'HTML'],
        remediation: 'Sanitize user input and use safe DOM manipulation methods'
      },
      {
        id: 'HARD_CODED_CREDENTIALS_001',
        name: 'Hardcoded Credentials',
        description: 'Detects hardcoded passwords or API keys',
        severity: 'CRITICAL',
        pattern: /(password\s*=\s*["'][^"']*["']|api[key|secret]\s*=\s*["'][^"']*["']|secret\s*=\s*["'][^"']*["'])/gi,
        languages: ['ANY'],
        remediation: 'Store credentials in environment variables or secure configuration files'
      },
      {
        id: 'INSECURE_DESERIALIZATION_001',
        name: 'Insecure Deserialization',
        description: 'Detects potential insecure deserialization',
        severity: 'HIGH',
        pattern: /(unserialize\(|pickle\.loads\(|eval\(|yaml\.load\()/gi,
        languages: ['PHP', 'Python'],
        remediation: 'Avoid deserializing untrusted data or use safe alternatives'
      },
      {
        id: 'WEAK_CRYPTO_001',
        name: 'Weak Cryptographic Algorithm',
        description: 'Detects usage of weak cryptographic algorithms',
        severity: 'MEDIUM',
        pattern: /(md5\(|sha1\(|DES\.|RC4\.)/gi,
        languages: ['ANY'],
        remediation: 'Use strong cryptographic algorithms like AES, SHA-256 or higher'
      }
    ];
  }

  /**
   * Initialize supported programming languages
   */
  private initializeLanguageSupport(): void {
    this.languageSupport = [
      { name: 'JavaScript', extensions: ['.js', '.ts', '.jsx', '.tsx'] },
      { name: 'Python', extensions: ['.py'] },
      { name: 'PHP', extensions: ['.php', '.php3', '.php4', '.php5'] },
      { name: 'Java', extensions: ['.java'] },
      { name: 'C#', extensions: ['.cs'] },
      { name: 'HTML', extensions: ['.html', '.htm'] }
    ];
  }

  /**
   * Initialize patterns for filtering false positives
   */
  private initializeFalsePositiveFilters(): void {
    this.falsePositivePatterns = [
      /\/\/.*test.*password/i,
      /\/\/.*example.*key/i,
      /<!--.*password.*-->/i,
      /\/\*.*test.*\*\//i
    ];
  }

  /**
   * Add custom security rule
   * @param rule Security rule to add
   */
  public addRule(rule: SecurityRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove security rule by ID
   * @param ruleId ID of rule to remove
   */
  public removeRule(ruleId: string): void {
    this.rules = this.rules.filter(rule => rule.id !== ruleId);
  }

  /**
   * Configure security rules and thresholds
   * @param rules Array of security rules
   * @param minSeverity Minimum severity level to report
   */
  public configureRules(rules: SecurityRule[], minSeverity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): void {
    this.rules = rules;
    if (minSeverity) {
      const severityLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      const minIndex = severityLevels.indexOf(minSeverity);
      this.rules = this.rules.filter(rule => 
        severityLevels.indexOf(rule.severity) >= minIndex
      );
    }
  }

  /**
   * Add pattern to filter false positives
   * @param pattern Regular expression pattern to filter
   */
  public addFalsePositiveFilter(pattern: RegExp): void {
    this.falsePositivePatterns.push(pattern);
  }

  /**
   * Analyze source code for security vulnerabilities
   * @param code Source code to analyze
   * @param language Programming language of the code
   * @param fileName Name of the file being analyzed
   * @returns Security report with findings
   */
  public async analyzeCode(code: string, language: string, fileName: string): Promise<SecurityReport> {
    this.metrics.totalScans++;
    
    const issues: SecurityIssue[] = [];
    const applicableRules = this.rules.filter(rule => 
      rule.languages.includes(language) || rule.languages.includes('ANY')
    );

    for (const rule of applicableRules) {
      const matches = code.matchAll(rule.pattern);
      
      for (const match of matches) {
        const issue: SecurityIssue = {
          id: `${rule.id}_${issues.length + 1}`,
          ruleId: rule.id,
          severity: rule.severity,
          message: rule.description,
          fileName: fileName,
          lineNumber: this.getLineNumber(code, match.index || 0),
          codeSnippet: this.getCodeSnippet(code, match.index || 0),
          remediation: rule.remediation
        };

        // Filter false positives
        if (!this.isFalsePositive(issue)) {
          issues.push(issue);
          this.updateMetrics(rule.severity);
        } else {
          this.metrics.falsePositivesFiltered++;
        }
      }
    }

    // Integrate with AspectVerifiersSystem
    const verificationResult = await this.aspectVerifiers.verifySecurityAspects({
      code,
      language,
      fileName,
      issues
    });

    const report: SecurityReport = {
      fileName: fileName,
      language: language,
      timestamp: new Date().toISOString(),
      issues: issues,
      metrics: this.metrics,
      verificationResult: verificationResult
    };

    return report;
  }

  /**
   * Get line number for a character position in code
   * @param code Source code
   * @param position Character position
   * @returns Line number
   */
  private getLineNumber(code: string, position: number): number {
    return code.substring(0, position).split('\n').length;
  }

  /**
   * Get code snippet around a position
   * @param code Source code
   * @param position Character position
   * @returns Code snippet with context
   */
  private getCodeSnippet(code: string, position: number): string {
    const lines = code.split('\n');
    const lineNumber = this.getLineNumber(code, position);
    const startLine = Math.max(0, lineNumber - 3);
    const endLine = Math.min(lines.length, lineNumber + 2);
    
    return lines.slice(startLine, endLine).join('\n');
  }

  /**
   * Check if an issue is a false positive
   * @param issue Security issue to check
   * @returns True if issue is a false positive
   */
  private isFalsePositive(issue: SecurityIssue): boolean {
    for (const pattern of this.falsePositivePatterns) {
      if (pattern.test(issue.codeSnippet)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Update security metrics based on issue severity
   * @param severity Issue severity level
   */
  private updateMetrics(severity: string): void {
    this.metrics.vulnerabilitiesFound++;
    
    switch (severity) {
      case 'CRITICAL':
        this.metrics.criticalIssues++;
        break;
      case 'HIGH':
        this.metrics.highIssues++;
        break;
      case 'MEDIUM':
        this.metrics.mediumIssues++;
        break;
      case 'LOW':
        this.metrics.lowIssues++;
        break;
    }
  }

  /**
   * Get current security metrics
   * @returns Security metrics
   */
  public getMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset security metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalScans: 0,
      vulnerabilitiesFound: 0,
      falsePositivesFiltered: 0,
      criticalIssues: 0,
      highIssues: 0,
      mediumIssues: 0,
      lowIssues: 0
    };
  }

  /**
   * Get supported languages
   * @returns Array of supported languages
   */
  public getSupportedLanguages(): string[] {
    return this.languageSupport.map(lang => lang.name);
  }

  /**
   * Add support for a new programming language
   * @param language Language support configuration
   */
  public addLanguageSupport(language: LanguageSupport): void {
    this.languageSupport.push(language);
  }
}

// security-types.ts
export interface SecurityRule {
  id: string;
  name: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  pattern: RegExp;
  languages: string[];
  remediation: string;
}

export interface SecurityIssue {
  id: string;
  ruleId: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  fileName: string;
  lineNumber: number;
  codeSnippet: string;
  remediation: string;
}

export interface SecurityReport {
  fileName: string;
  language: string;
  timestamp: string;
  issues: SecurityIssue[];
  metrics: SecurityMetrics;
  verificationResult: any;
}

export interface LanguageSupport {
  name: string;
  extensions: string[];
}

export interface SecurityMetrics {
  totalScans: number;
  vulnerabilitiesFound: number;
  falsePositivesFiltered: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
}

// aspect-verifiers-system.ts (simplified interface)
export interface AspectVerifiersSystem {
  verifySecurityAspects(data: {
    code: string;
    language: string;
    fileName: string;
    issues: SecurityIssue[];
  }): Promise<any>;
}

// Example usage
/*
const aspectVerifiers: AspectVerifiersSystem = {
  verifySecurityAspects: async (data) => {
    // Implementation would integrate with the actual verification system
    return {
      verified: true,
      additionalFindings: [],
      complianceStatus: 'PENDING'
    };
  }
};

const sastEngine = new SASTEngine(aspectVerifiers);

// Example code to analyze
const sampleCode = `
  const userInput = req.query.input;
  const query = "SELECT * FROM users WHERE id = " + userInput;
  db.query(query);
`;

sastEngine.analyzeCode(sampleCode, 'JavaScript', 'vulnerable.js')
  .then(report => {
    console.log('Security Analysis Report:', report);
  });
*/