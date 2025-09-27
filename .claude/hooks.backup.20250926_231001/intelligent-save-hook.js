const fs = require('fs');
const path = require('path');

class IntelligentSaveHook {
  constructor() {
    this.baseDir = path.resolve(__dirname, '../..');
    this.verificationTriggerPath = path.join(this.baseDir, '.devflow/verification-trigger.json');
    this.context7TriggerPath = path.join(this.baseDir, '.devflow/context7-trigger.json');
    this.snapshotsDir = path.join(this.baseDir, '.devflow/snapshots');
    this.logFile = path.join(this.baseDir, '.devflow/intelligent-save.log');
    this.errorDetectionLogFile = path.join(this.baseDir, '.devflow/error-detection.log');
    this.ensureDirectories();
  }

  ensureDirectories() {
    [path.dirname(this.verificationTriggerPath), path.dirname(this.context7TriggerPath),
     this.snapshotsDir, path.dirname(this.logFile), path.dirname(this.errorDetectionLogFile)]
      .forEach(dir => !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true }));
  }

  onHookTrigger(hookData) {
    try {
      const timestamp = new Date().toISOString();
      const transcript = hookData.transcript || '';
      const codeBlocks = this.extractCodeBlocks(transcript);
      const filePaths = this.extractFilePaths(transcript);
      const hasChanges = codeBlocks.length > 0 || filePaths.length > 0;

      if (hasChanges) {
        // Existing verification trigger
        this.triggerVerification(timestamp, codeBlocks, filePaths);

        // NEW: Context7 error detection and auto-trigger
        const errorAnalysis = this.detectCodeErrors(codeBlocks);
        if (errorAnalysis.hasErrors) {
          this.triggerContext7Documentation(timestamp, errorAnalysis);
        }

        this.saveSnapshot(timestamp, hookData, codeBlocks, filePaths, errorAnalysis);
        this.logOperation(timestamp, 'CODE_CHANGES_DETECTED', {
          codeBlocksCount: codeBlocks.length,
          filePathsCount: filePaths.length,
          files: filePaths,
          errorsDetected: errorAnalysis.hasErrors,
          errorTypes: errorAnalysis.errorTypes,
          librariesDetected: errorAnalysis.libraries.length
        });
      }

      return { continue: true, suppressOutput: false };
    } catch (error) {
      this.logOperation(new Date().toISOString(), 'ERROR', { error: error.message });
      return { continue: true, suppressOutput: false };
    }
  }

  extractCodeBlocks(text) {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const blocks = [];
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      blocks.push({
        language: match[1] || 'unknown',
        code: match[2].trim()
      });
    }
    return blocks;
  }

  extractFilePaths(text) {
    const filePathRegex = /(?:src\/|\.claude\/|mcp-servers\/)[^\s\n]+\.(?:ts|js|py|json)/g;
    return [...new Set(text.match(filePathRegex) || [])];
  }

  triggerVerification(timestamp, codeBlocks, filePaths) {
    const triggerData = {
      timestamp,
      trigger: 'intelligent-save-hook',
      changes: { codeBlocks: codeBlocks.length, filePaths }
    };
    fs.writeFileSync(this.verificationTriggerPath, JSON.stringify(triggerData, null, 2));
  }

  saveSnapshot(timestamp, hookData, codeBlocks, filePaths, errorAnalysis = null) {
    const snapshotFile = path.join(this.snapshotsDir, `snapshot-${timestamp.replace(/[:.]/g, '-')}.json`);
    const snapshot = {
      timestamp,
      hookType: hookData.hookType,
      codeBlocks,
      filePaths,
      transcriptLength: (hookData.transcript || '').length,
      errorAnalysis
    };
    fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2));
  }

  logOperation(timestamp, eventType, data) {
    const logEntry = `${timestamp} [${eventType}] ${JSON.stringify(data)}\n`;
    fs.appendFileSync(this.logFile, logEntry);
  }

  detectCodeErrors(codeBlocks) {
    const errorPatterns = [
      // Import/Module errors - inspired by ESLint patterns
      { pattern: /error|failed|exception|undefined|null reference/i, type: 'runtime_error' },
      { pattern: /missing|not found|cannot find|unresolved/i, type: 'dependency_error' },
      { pattern: /type.*error|syntax.*error|reference.*error/i, type: 'syntax_error' },
      { pattern: /cannot find module|module not found|import.*error/i, type: 'import_error' },
      { pattern: /configuration|config.*error|setup.*failed/i, type: 'config_error' },
      { pattern: /version.*conflict|dependency.*issue|compatibility/i, type: 'version_error' },
      { pattern: /permission.*denied|access.*error|authentication/i, type: 'auth_error' },
      // Try-catch patterns and error handling
      { pattern: /throw new Error|throw.*error|catch\s*\(/i, type: 'error_handling' },
      // ESLint-style patterns
      { pattern: /console\.error|console\.warn/i, type: 'console_error' },
      { pattern: /process\.exit|throw\s+/i, type: 'process_error' }
    ];

    // Library/framework patterns for Context7 suggestions
    const libraryPatterns = [
      { pattern: /(react|vue|angular|svelte|next\.?js|nuxt)/i, tech: 'frontend' },
      { pattern: /(typescript|javascript|node\.?js|deno|bun)/i, tech: 'runtime' },
      { pattern: /(express|fastify|koa|nest\.?js)/i, tech: 'backend' },
      { pattern: /(mongodb|postgres|mysql|redis|sqlite)/i, tech: 'database' },
      { pattern: /(docker|kubernetes|aws|gcp|azure)/i, tech: 'infrastructure' },
      { pattern: /(jest|mocha|cypress|playwright|testing)/i, tech: 'testing' },
      { pattern: /(webpack|vite|rollup|parcel|esbuild)/i, tech: 'bundler' },
      { pattern: /(tailwind|css|scss|sass|styled)/i, tech: 'styling' },
      { pattern: /(auth|oauth|jwt|session|security)/i, tech: 'auth' },
      { pattern: /(api|rest|graphql|websocket|grpc)/i, tech: 'api' }
    ];

    const errors = [];
    const libraries = new Set();
    const errorTypes = new Set();
    const technologiesDetected = new Set();

    codeBlocks.forEach((block, index) => {
      // Check for error patterns
      errorPatterns.forEach(({ pattern, type }) => {
        if (pattern.test(block.code)) {
          errors.push({
            type,
            blockIndex: index,
            language: block.language,
            pattern: pattern.source,
            codeSnippet: block.code.substring(0, 200) // First 200 chars for context
          });
          errorTypes.add(type);
        }
      });

      // Extract libraries and technologies
      libraryPatterns.forEach(({ pattern, tech }) => {
        const matches = block.code.match(pattern);
        if (matches) {
          matches.forEach(match => {
            libraries.add(match.toLowerCase());
            technologiesDetected.add(tech);
          });
        }
      });

      // Extract import statements for library detection
      const importPatterns = [
        /import.*from\s+['"]([^'"]+)['"]/g,
        /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        /from\s+['"]([^'"]+)['"]/g
      ];

      importPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(block.code)) !== null) {
          libraries.add(match[1]);
        }
      });
    });

    // Determine if Context7 should be triggered
    const hasErrors = errors.length > 0;
    const hasLibraries = libraries.size > 0;
    const shouldTriggerContext7 = hasErrors && hasLibraries;

    const analysis = {
      hasErrors,
      shouldTriggerContext7,
      errors,
      libraries: Array.from(libraries),
      errorTypes: Array.from(errorTypes),
      technologiesDetected: Array.from(technologiesDetected),
      summary: {
        totalErrors: errors.length,
        totalLibraries: libraries.size,
        errorTypeCount: errorTypes.size,
        techCount: technologiesDetected.size
      }
    };

    // Log error detection results
    if (hasErrors) {
      this.logErrorDetection(analysis);
    }

    return analysis;
  }

  triggerContext7Documentation(timestamp, errorAnalysis) {
    const context7Trigger = {
      timestamp,
      trigger: 'error-detection-save-hook',
      source: 'intelligent-save-hook',
      errorAnalysis: {
        errorCount: errorAnalysis.errors.length,
        errorTypes: errorAnalysis.errorTypes,
        libraries: errorAnalysis.libraries,
        technologies: errorAnalysis.technologiesDetected
      },
      context7Action: 'auto-trigger-documentation',
      priority: errorAnalysis.errorTypes.includes('syntax_error') ||
                errorAnalysis.errorTypes.includes('import_error') ? 'high' : 'medium',
      suggestedQueries: this.generateContext7Queries(errorAnalysis)
    };

    try {
      fs.writeFileSync(this.context7TriggerPath, JSON.stringify(context7Trigger, null, 2));
      this.logOperation(timestamp, 'CONTEXT7_TRIGGER', {
        libraries: context7Trigger.errorAnalysis.libraries,
        errorTypes: context7Trigger.errorAnalysis.errorTypes,
        priority: context7Trigger.priority
      });
    } catch (error) {
      this.logOperation(timestamp, 'CONTEXT7_TRIGGER_ERROR', { error: error.message });
    }
  }

  generateContext7Queries(errorAnalysis) {
    const queries = [];

    // Generate specific queries based on detected errors and libraries
    if (errorAnalysis.errorTypes.includes('import_error') && errorAnalysis.libraries.length > 0) {
      errorAnalysis.libraries.slice(0, 3).forEach(lib => {
        queries.push(`${lib} import configuration setup`);
        queries.push(`${lib} module resolution troubleshooting`);
      });
    }

    if (errorAnalysis.errorTypes.includes('syntax_error')) {
      queries.push('syntax error troubleshooting best practices');
      errorAnalysis.libraries.slice(0, 2).forEach(lib => {
        queries.push(`${lib} syntax examples and patterns`);
      });
    }

    if (errorAnalysis.errorTypes.includes('config_error')) {
      errorAnalysis.libraries.slice(0, 2).forEach(lib => {
        queries.push(`${lib} configuration guide`);
        queries.push(`${lib} setup and installation`);
      });
    }

    // Combination queries for multiple technologies
    if (errorAnalysis.technologiesDetected.length >= 2) {
      const techs = errorAnalysis.technologiesDetected.slice(0, 2);
      queries.push(`${techs.join(' ')} integration guide`);
    }

    return queries.slice(0, 5); // Limit to top 5 most relevant queries
  }

  logErrorDetection(analysis) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      summary: analysis.summary,
      errorTypes: analysis.errorTypes,
      libraries: analysis.libraries,
      technologies: analysis.technologiesDetected,
      shouldTriggerContext7: analysis.shouldTriggerContext7,
      errors: analysis.errors.map(err => ({
        type: err.type,
        language: err.language,
        snippet: err.codeSnippet.substring(0, 100) // Limit snippet size in logs
      }))
    };

    const logLine = `${logEntry.timestamp} [ERROR_DETECTION] ${JSON.stringify(logEntry)}\n`;
    fs.appendFileSync(this.errorDetectionLogFile, logLine);
  }
}

module.exports = IntelligentSaveHook;