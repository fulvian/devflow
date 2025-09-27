#!/usr/bin/env node

/**
 * VERIFICATION-ACCESS-TEST-001
 *
 * This script performs actual file access and verification of the critical-issues-todos implementation.
 * It checks for compliance with DevFlow rules including the 100-line limit and SQLite database usage.
 */

import * as fs from 'fs';
import * as path from 'path';

interface Violation {
  file: string;
  line: number;
  rule: string;
  description: string;
}

interface VerificationResult {
  violations: Violation[];
  passed: boolean;
}

/**
 * Reads a file and returns its content as a string
 * @param filePath Path to the file
 * @returns File content
 */
function readFileContent(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error}`);
  }
}

/**
 * Counts the number of lines in a file
 * @param content File content
 * @returns Number of lines
 */
function countLines(content: string): number {
  return content.split('\n').length;
}

/**
 * Checks if a file exceeds the 100-line limit
 * @param filePath Path to the file
 * @returns Violation if found, null otherwise
 */
function checkLineLimit(filePath: string): Violation | null {
  const content = readFileContent(filePath);
  const lineCount = countLines(content);

  if (lineCount > 100) {
    return {
      file: filePath,
      line: lineCount,
      rule: "DevFlow 100-line rule",
      description: `File exceeds 100-line limit with ${lineCount} lines`
    };
  }

  return null;
}

/**
 * Checks if SQL file uses SQLite syntax (and not PostgreSQL)
 * @param filePath Path to the SQL file
 * @returns Violation if PostgreSQL-specific syntax is found
 */
function checkSQLiteUsage(filePath: string): Violation | null {
  const content = readFileContent(filePath);
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toLowerCase();

    // Check for PostgreSQL-specific keywords
    if (line.includes('serial') && !line.includes('integer')) {
      return {
        file: filePath,
        line: i + 1,
        rule: "SQLite database implementation",
        description: "Found PostgreSQL-specific 'SERIAL' keyword. Should use SQLite INTEGER PRIMARY KEY"
      };
    }

    if (line.includes('varchar') && line.includes('(') && line.includes(')')) {
      // This is generally okay, but checking for PostgreSQL-specific variations
      continue;
    }

    // Check for other PostgreSQL-specific features
    if (line.includes('uuid_generate_v4()')) {
      return {
        file: filePath,
        line: i + 1,
        rule: "SQLite database implementation",
        description: "Found PostgreSQL-specific UUID generation function"
      };
    }
  }

  return null;
}

/**
 * Verifies TypeScript files for common issues
 * @param filePath Path to the TypeScript file
 * @returns Array of violations
 */
function checkTypeScriptFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = readFileContent(filePath);
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for TODO comments
    if (line.includes('TODO:') || line.includes('FIXME:')) {
      violations.push({
        file: filePath,
        line: i + 1,
        rule: "Code quality",
        description: "Found TODO/FIXME comment that should be addressed"
      });
    }

    // Check for console.log statements
    if (line.includes('console.log(')) {
      violations.push({
        file: filePath,
        line: i + 1,
        rule: "Code quality",
        description: "Found console.log statement that should be removed"
      });
    }
  }

  return violations;
}

/**
 * Performs verification of the critical-issues implementation
 * @returns Verification results
 */
function performVerification(): VerificationResult {
  const violations: Violation[] = [];

  try {
    // Check repository.ts for line limit
    const repositoryPath = path.join('src', 'services', 'critical-issues', 'repository.ts');
    if (fs.existsSync(repositoryPath)) {
      const lineViolation = checkLineLimit(repositoryPath);
      if (lineViolation) {
        violations.push(lineViolation);
      }

      // Check for TypeScript issues
      violations.push(...checkTypeScriptFile(repositoryPath));
    } else {
      violations.push({
        file: repositoryPath,
        line: 0,
        rule: "File access",
        description: "Repository file not found"
      });
    }

    // Check SQL migration for SQLite compliance
    const migrationPath = path.join('scripts', 'migrations', 'add-critical-issues-tables.sql');
    if (fs.existsSync(migrationPath)) {
      const sqlViolation = checkSQLiteUsage(migrationPath);
      if (sqlViolation) {
        violations.push(sqlViolation);
      }
    } else {
      violations.push({
        file: migrationPath,
        line: 0,
        rule: "File access",
        description: "Migration file not found"
      });
    }

    // Check all TypeScript files in the critical-issues directory
    const servicesDir = path.join('src', 'services', 'critical-issues');
    if (fs.existsSync(servicesDir)) {
      const files = fs.readdirSync(servicesDir);
      const tsFiles = files.filter(file => file.endsWith('.ts'));

      for (const file of tsFiles) {
        const filePath = path.join(servicesDir, file);
        violations.push(...checkTypeScriptFile(filePath));
      }
    }

  } catch (error) {
    violations.push({
      file: "verification-script.ts",
      line: 0,
      rule: "Verification process",
      description: `Error during verification: ${error}`
    });
  }

  return {
    violations,
    passed: violations.length === 0
  };
}

/**
 * Formats and prints violations
 * @param violations Array of violations to print
 */
function printViolations(violations: Violation[]): void {
  if (violations.length === 0) {
    console.log("✓ All checks passed. No violations found.");
    return;
  }

  console.log(`✗ Found ${violations.length} violation(s):\n`);

  violations.forEach((violation, index) => {
    console.log(`${index + 1}. ${violation.rule}`);
    console.log(`   File: ${violation.file}:${violation.line}`);
    console.log(`   Issue: ${violation.description}\n`);
  });
}

// Main execution
function main(): void {
  console.log("Running VERIFICATION-ACCESS-TEST-001...");
  console.log("Checking critical-issues-todos implementation...\n");

  const result = performVerification();
  printViolations(result.violations);

  process.exit(result.passed ? 0 : 1);
}

// Execute if run directly
if (require.main === module) {
  main();
}

export { performVerification, Violation, VerificationResult };