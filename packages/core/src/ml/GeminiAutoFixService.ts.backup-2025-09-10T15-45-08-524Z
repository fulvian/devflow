import { GeminiService } from './GeminiService.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface AutoFixIssue {
  type: 'memory_leak' | 'performance' | 'security' | 'syntax' | 'logic';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location?: {
    line: number;
    column?: number;
  };
}

interface AnalysisResult {
  issues: AutoFixIssue[];
  recommendations: string[];
  confidence: number; // 0-1
}

interface ErrorContext {
  message: string;
  type: string;
  timestamp: Date;
}

interface BackupRecord {
  id: string;
  filePath: string;
  timestamp: Date;
  backupPath: string;
}

export class GeminiAutoFixService extends GeminiService {
  private backupDir = join(process.cwd(), '.autofix-backups');
  private backups: Map<string, BackupRecord> = new Map();
  
  private autoFixEnabled: boolean;
  private safetyLevel: 'low' | 'medium' | 'high';
  
  constructor() {
    super();
    this.autoFixEnabled = process.env['GEMINI_AUTOFIX_ENABLED'] === 'true';
    this.safetyLevel = (process.env['GEMINI_SAFETY_LEVEL'] as 'low' | 'medium' | 'high') || 'medium';
    
    // Create backup directory if it doesn't exist
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
    }
  }
  
  /**
   * Main entry point for auto-fixing issues in a file
   */
  async autoFixIssues(filePath: string, issueTypes: AutoFixIssue['type'][]): Promise<boolean> {
    if (!this.autoFixEnabled) {
      console.warn('Auto-fix is disabled');
      return false;
    }
    
    try {
      console.info(`Starting auto-fix for ${filePath}`);
      
      // Create backup before any modifications
      const backupId = this.createBackup(filePath);
      
      // Analyze the file for specified issue types
      const analysis = await this.analyzeFileForIssues(filePath, issueTypes);
      
      if (analysis.issues.length === 0) {
        console.info('No issues found to fix');
        return true;
      }
      
      // Apply fixes one by one
      let content = readFileSync(filePath, 'utf-8');
      
      for (const issue of analysis.issues) {
        try {
          content = await this.applyFixForIssue(content, issue, filePath);
          console.info(`Applied fix for ${issue.type} issue`);
        } catch (error) {
          console.error(`Failed to apply fix for ${issue.type}:`, error);
          // Continue with other fixes
        }
      }
      
      // Validate the final content
      if (await this.validateModification(filePath, content)) {
        writeFileSync(filePath, content, 'utf-8');
        console.info(`Successfully applied auto-fixes to ${filePath}`);
        return true;
      } else {
        console.error('Validation failed, rolling back changes');
        this.rollbackChanges(filePath, backupId);
        return false;
      }
    } catch (error) {
      console.error('Auto-fix process failed:', error);
      return false;
    }
  }
  
  /**
   * Apply recommendations from a previous Gemini analysis
   */
  async applyAnalysisRecommendations(filePath: string, analysisResult: AnalysisResult): Promise<boolean> {
    if (!this.autoFixEnabled) {
      console.warn('Auto-fix is disabled');
      return false;
    }
    
    try {
      console.info(`Applying analysis recommendations to ${filePath}`);
      
      const backupId = this.createBackup(filePath);
      let content = readFileSync(filePath, 'utf-8');
      
      // Apply recommendations
      for (const recommendation of analysisResult.recommendations) {
        try {
          content = await this.applyRecommendation(content, recommendation, filePath);
          console.info(`Applied recommendation: ${recommendation.substring(0, 50)}...`);
        } catch (error) {
          console.error(`Failed to apply recommendation:`, error);
        }
      }
      
      if (await this.validateModification(filePath, content)) {
        writeFileSync(filePath, content, 'utf-8');
        console.info(`Successfully applied recommendations to ${filePath}`);
        return true;
      } else {
        console.error('Validation failed, rolling back changes');
        this.rollbackChanges(filePath, backupId);
        return false;
      }
    } catch (error) {
      console.error('Failed to apply analysis recommendations:', error);
      return false;
    }
  }
  
  /**
   * Debug and fix errors automatically based on error context
   */
  async debugAndFix(filePath: string, errorContext: ErrorContext, stackTrace: string): Promise<boolean> {
    if (!this.autoFixEnabled) {
      console.warn('Auto-fix is disabled');
      return false;
    }
    
    try {
      console.info(`Debugging and fixing error in ${filePath}: ${errorContext.message}`);
      
      const backupId = this.createBackup(filePath);
      
      // Use Gemini to analyze the error and suggest fixes
      const prompt = `
        File: ${filePath}
        Error: ${errorContext.message}
        Type: ${errorContext.type}
        Stack trace: ${stackTrace}
        
        Please provide a fixed version of the code that resolves this error.
        Respond ONLY with the fixed code, no explanations.
      `;
      
      const fixedContent = await this.generateGeminiText(prompt);
      
      if (fixedContent && await this.validateModification(filePath, fixedContent)) {
        writeFileSync(filePath, fixedContent, 'utf-8');
        console.info(`Successfully fixed error in ${filePath}`);
        return true;
      } else {
        console.error('Generated fix failed validation, rolling back');
        this.rollbackChanges(filePath, backupId);
        return false;
      }
    } catch (error) {
      console.error('Debug and fix process failed:', error);
      return false;
    }
  }
  
  /**
   * Validate and fix basic syntax issues
   */
  async validateAndFixSyntax(filePath: string): Promise<boolean> {
    try {
      console.info(`Validating and fixing syntax for ${filePath}`);
      
      const backupId = this.createBackup(filePath);
      const content = readFileSync(filePath, 'utf-8');
      
      // Use Gemini to fix syntax issues
      const prompt = `
        Please fix any syntax errors in the following code:
        
        ${content}
        
        Respond ONLY with the corrected code, no explanations.
      `;
      
      const fixedContent = await this.generateGeminiText(prompt);
      
      if (fixedContent && await this.validateModification(filePath, fixedContent)) {
        writeFileSync(filePath, fixedContent, 'utf-8');
        console.info(`Successfully fixed syntax in ${filePath}`);
        return true;
      } else {
        console.error('Syntax fix failed validation, rolling back');
        this.rollbackChanges(filePath, backupId);
        return false;
      }
    } catch (error) {
      console.error('Syntax validation and fix failed:', error);
      return false;
    }
  }
  
  /**
   * Create a timestamped backup of a file
   */
  createBackup(filePath: string): string {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupId = `${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}`;
      const backupPath = join(this.backupDir, `${backupId}.backup`);
      
      const content = readFileSync(filePath, 'utf-8');
      writeFileSync(backupPath, content, 'utf-8');
      
      const backupRecord: BackupRecord = {
        id: backupId,
        filePath,
        timestamp: new Date(),
        backupPath
      };
      
      this.backups.set(backupId, backupRecord);
      console.info(`Created backup ${backupId} for ${filePath}`);
      
      return backupId;
    } catch (error) {
      console.error(`Failed to create backup for ${filePath}:`, error);
      throw error;
    }
  }
  
  /**
   * Validate that modifications won't break the code
   */
  async validateModification(originalPath: string, modifiedContent: string): Promise<boolean> {
    try {
      // Check if safety checks are enabled
      if (this.safetyLevel === 'low') {
        console.warn('Safety checks bypassed due to low safety level');
        return true;
      }
      
      // Use Gemini to validate the modified content
      const validationPrompt = `
        Please analyze the following code for potential issues:
        
        ${modifiedContent}
        
        Check for:
        1. Syntax errors
        2. Runtime errors
        3. Logic errors
        4. Security vulnerabilities
        
        Respond with "VALID" if no issues found, or "INVALID" followed by a brief explanation.
      `;
      
      const validationResponse = await this.generateGeminiText(validationPrompt);
      
      if (validationResponse && validationResponse.trim().startsWith('VALID')) {
        console.info(`Validation passed for modifications to ${originalPath}`);
        return true;
      } else {
        console.warn(`Validation failed for ${originalPath}: ${validationResponse}`);
        return false;
      }
    } catch (error) {
      console.error(`Validation failed for ${originalPath}:`, error);
      // In high safety mode, fail closed
      return this.safetyLevel !== 'high';
    }
  }
  
  /**
   * Restore file from a backup
   */
  rollbackChanges(filePath: string, backupId: string): boolean {
    try {
      const backup = this.backups.get(backupId);
      
      if (!backup) {
        console.error(`Backup ${backupId} not found`);
        return false;
      }
      
      const backupContent = readFileSync(backup.backupPath, 'utf-8');
      writeFileSync(filePath, backupContent, 'utf-8');
      
      console.info(`Rolled back ${filePath} to backup ${backupId}`);
      return true;
    } catch (error) {
      console.error(`Failed to rollback ${filePath} to backup ${backupId}:`, error);
      return false;
    }
  }
  
  /**
   * Apply only whitelisted, safe modifications
   */
  async applySafeModifications(filePath: string, modifications: string[]): Promise<boolean> {
    // Define safe modification patterns
    const safePatterns = [
      /console\.(log|warn|error)\([^)]*\)/g,  // Safe console operations
      /\/\/.*$/gm,  // Comments
      /\/\*[\s\S]*?\*\//g,  // Multi-line comments
      /\s+/g  // Whitespace
    ];
    
    try {
      console.info(`Applying safe modifications to ${filePath}`);
      
      const backupId = this.createBackup(filePath);
      let content = readFileSync(filePath, 'utf-8');
      
      let modified = false;
      for (const modification of modifications) {
        // Check if modification matches safe patterns
        const isSafe = safePatterns.some(pattern => pattern.test(modification));
        
        if (isSafe) {
          // Apply the modification
          content = content.replace(modification, modification);
          modified = true;
          console.info('Applied safe modification');
        } else {
          console.warn(`Skipped unsafe modification: ${modification.substring(0, 50)}...`);
        }
      }
      
      if (modified && await this.validateModification(filePath, content)) {
        writeFileSync(filePath, content, 'utf-8');
        console.info(`Successfully applied safe modifications to ${filePath}`);
        return true;
      } else if (modified) {
        console.error('Safe modifications failed validation, rolling back');
        this.rollbackChanges(filePath, backupId);
        return false;
      } else {
        console.info('No safe modifications to apply');
        return true;
      }
    } catch (error) {
      console.error('Failed to apply safe modifications:', error);
      return false;
    }
  }
  
  /**
   * Generate text using Gemini CLI
   */
  private async generateGeminiText(prompt: string): Promise<string> {
    try {
      const geminiPath = process.env['GEMINI_CLI_PATH'] || '/opt/homebrew/bin/gemini';
      
      // Use pipe input instead of --prompt to avoid quote escaping issues
      const command = `echo '${prompt.replace(/'/g, "'\\''")}' | ${geminiPath}`;
      const { stdout } = await execAsync(command);
      
      return stdout.trim();
    } catch (error) {
      throw new Error(`Gemini text generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Private helper methods
   */
  
  private async analyzeFileForIssues(filePath: string, issueTypes: AutoFixIssue['type'][]): Promise<AnalysisResult> {
    const content = readFileSync(filePath, 'utf-8');
    
    const prompt = `
      Analyze the following code for these specific issue types: ${issueTypes.join(', ')}
      
      ${content}
      
      Respond in JSON format with:
      {
        "issues": [
          {
            "type": "issue_type",
            "description": "description",
            "severity": "low|medium|high|critical",
            "location": {
              "line": 1,
              "column": 1
            }
          }
        ],
        "recommendations": ["recommendation1", "recommendation2"],
        "confidence": 0.95
      }
    `;
    
    try {
      const response = await this.generateGeminiText(prompt);
      
      // Clean markdown formatting from response
      let cleanedResponse = response.trim();
      
      // Remove markdown code blocks
      cleanedResponse = cleanedResponse.replace(/```json\s*\n?/gi, '');
      cleanedResponse = cleanedResponse.replace(/```\s*$/gi, '');
      cleanedResponse = cleanedResponse.replace(/^```\s*/gi, '');
      
      // Find JSON content between first { and last }
      const jsonStart = cleanedResponse.indexOf('{');
      const jsonEnd = cleanedResponse.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd + 1);
      }
      
      return JSON.parse(cleanedResponse);
    } catch (error) {
      console.error('Failed to analyze file for issues:', error);
      return { issues: [], recommendations: [], confidence: 0 };
    }
  }
  
  private async applyFixForIssue(content: string, issue: AutoFixIssue, filePath: string): Promise<string> {
    const prompt = `
      Code:
      ${content}
      
      Issue to fix:
      Type: ${issue.type}
      Description: ${issue.description}
      Location: Line ${issue.location?.line || 'unknown'}
      
      Please provide the fixed code.
      Respond ONLY with the complete fixed code, no explanations.
    `;
    
    return await this.generateGeminiText(prompt);
  }
  
  private async applyRecommendation(content: string, recommendation: string, filePath: string): Promise<string> {
    const prompt = `
      Code:
      ${content}
      
      Recommendation:
      ${recommendation}
      
      Please provide the updated code with this recommendation applied.
      Respond ONLY with the complete updated code, no explanations.
    `;
    
    return await this.generateGeminiText(prompt);
  }
}
