#!/usr/bin/env node

/**
 * AUTOMATED CONSOLE.LOG REMOVAL SCRIPT
 *
 * This script automatically removes console.log statements from source files
 * while preserving test files and important debugging statements.
 *
 * Usage: node scripts/automated-console-log-removal.js [--dry-run] [--target=path]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ConsoleLogRemover {
    constructor(options = {}) {
        this.dryRun = options.dryRun || false;
        this.targetPath = options.targetPath || 'src';
        this.excludePaths = [
            'test', 'tests', '__tests__', 'spec',
            'debug', 'diagnostic', 'audit',
            'verification', '.backups', 'logs'
        ];
        this.statistics = {
            filesProcessed: 0,
            filesModified: 0,
            consoleLogsRemoved: 0,
            errorsEncountered: 0
        };
    }

    shouldProcessFile(filePath) {
        // Only process .ts and .js files
        if (!/\.(ts|js)$/.test(filePath)) return false;

        // Skip excluded paths
        const relativePath = path.relative(process.cwd(), filePath);
        return !this.excludePaths.some(excluded =>
            relativePath.includes(excluded) ||
            relativePath.includes(`/${excluded}/`) ||
            relativePath.startsWith(`${excluded}/`)
        );
    }

    analyzeFile(content, filePath) {
        const lines = content.split('\n');
        const consoleLogLines = [];
        const preservedLines = [];

        lines.forEach((line, index) => {
            const trimmed = line.trim();
            const lineNumber = index + 1;

            // Check for console.log statements
            if (this.isConsoleLogStatement(line, trimmed)) {
                // Preserve important debugging statements
                if (this.shouldPreserveConsoleLog(trimmed, filePath)) {
                    preservedLines.push(lineNumber);
                } else {
                    consoleLogLines.push({
                        lineNumber,
                        content: line,
                        trimmed
                    });
                }
            }
        });

        return {
            consoleLogLines,
            preservedLines,
            totalConsoleLogsFound: consoleLogLines.length + preservedLines.length
        };
    }

    isConsoleLogStatement(line, trimmed) {
        return trimmed.includes('console.log(') &&
               !trimmed.startsWith('//') &&
               !trimmed.startsWith('*') &&
               !line.includes('// KEEP') &&
               !line.includes('// PRESERVE');
    }

    shouldPreserveConsoleLog(trimmed, filePath) {
        // Preserve console.log statements that might be important
        const preservePatterns = [
            /console\.log.*error/i,
            /console\.log.*warning/i,
            /console\.log.*critical/i,
            /console\.log.*important/i,
            /console\.log.*production/i,
            /console\.log.*startup/i,
            /console\.log.*initialization/i
        ];

        return preservePatterns.some(pattern => pattern.test(trimmed));
    }

    removeConsoleLogs(content, consoleLogLines) {
        const lines = content.split('\n');
        let removedCount = 0;

        // Remove console.log lines (in reverse order to maintain line numbers)
        consoleLogLines.reverse().forEach(logInfo => {
            const lineIndex = logInfo.lineNumber - 1;

            // Check if the line is only console.log (possibly with whitespace)
            const line = lines[lineIndex];
            const beforeConsole = line.substring(0, line.indexOf('console.log'));
            const afterConsole = this.findEndOfConsoleLog(line, line.indexOf('console.log'));

            if (beforeConsole.trim() === '' && afterConsole.trim() === '') {
                // Entire line is just console.log, remove it
                lines.splice(lineIndex, 1);
                removedCount++;
            } else if (beforeConsole.trim() === '') {
                // Console.log at start of line, remove just the console.log part
                lines[lineIndex] = afterConsole;
                removedCount++;
            } else {
                // Console.log embedded in line, remove carefully
                const beforeLog = line.substring(0, line.indexOf('console.log'));
                const afterLog = afterConsole;
                lines[lineIndex] = beforeLog.trimRight() + (afterLog.trim() ? ' ' + afterLog.trimLeft() : '');
                removedCount++;
            }
        });

        return {
            modifiedContent: lines.join('\n'),
            removedCount
        };
    }

    findEndOfConsoleLog(line, startIndex) {
        let parenCount = 0;
        let inString = false;
        let stringChar = null;
        let i = startIndex;

        // Find the opening parenthesis
        while (i < line.length && line[i] !== '(') {
            i++;
        }

        if (i >= line.length) return ''; // No opening paren found

        parenCount = 1;
        i++;

        // Find the matching closing parenthesis
        while (i < line.length && parenCount > 0) {
            const char = line[i];

            if (!inString) {
                if (char === '"' || char === "'" || char === '`') {
                    inString = true;
                    stringChar = char;
                } else if (char === '(') {
                    parenCount++;
                } else if (char === ')') {
                    parenCount--;
                }
            } else {
                if (char === stringChar && line[i - 1] !== '\\') {
                    inString = false;
                    stringChar = null;
                }
            }

            i++;
        }

        // Find the semicolon or end of statement
        while (i < line.length && /\s/.test(line[i])) {
            i++;
        }

        if (i < line.length && line[i] === ';') {
            i++;
        }

        return line.substring(i);
    }

    async processFile(filePath) {
        try {
            console.log(`Processing: ${path.relative(process.cwd(), filePath)}`);

            const content = fs.readFileSync(filePath, 'utf8');
            const analysis = this.analyzeFile(content, filePath);

            this.statistics.filesProcessed++;

            if (analysis.consoleLogLines.length === 0) {
                console.log(`  ✓ No console.log statements to remove`);
                return;
            }

            console.log(`  📝 Found ${analysis.consoleLogLines.length} console.log statements to remove`);
            if (analysis.preservedLines.length > 0) {
                console.log(`  🔒 Preserving ${analysis.preservedLines.length} important console.log statements`);
            }

            if (!this.dryRun) {
                const result = this.removeConsoleLogs(content, analysis.consoleLogLines);

                // Create backup
                const backupPath = `${filePath}.backup.${Date.now()}`;
                fs.writeFileSync(backupPath, content);

                // Write modified content
                fs.writeFileSync(filePath, result.modifiedContent);

                console.log(`  ✅ Removed ${result.removedCount} console.log statements`);
                console.log(`  💾 Backup created: ${path.basename(backupPath)}`);

                this.statistics.filesModified++;
                this.statistics.consoleLogsRemoved += result.removedCount;
            } else {
                console.log(`  🔍 [DRY RUN] Would remove ${analysis.consoleLogLines.length} console.log statements`);
                analysis.consoleLogLines.forEach(logInfo => {
                    console.log(`    Line ${logInfo.lineNumber}: ${logInfo.trimmed}`);
                });
            }

        } catch (error) {
            console.error(`  ❌ Error processing ${filePath}: ${error.message}`);
            this.statistics.errorsEncountered++;
        }
    }

    async scanDirectory(dirPath) {
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);

                if (entry.isDirectory() && !entry.name.startsWith('.')) {
                    await this.scanDirectory(fullPath);
                } else if (entry.isFile() && this.shouldProcessFile(fullPath)) {
                    await this.processFile(fullPath);
                }
            }
        } catch (error) {
            console.error(`Error scanning directory ${dirPath}: ${error.message}`);
            this.statistics.errorsEncountered++;
        }
    }

    async run() {
        console.log('🧹 Starting automated console.log removal...');
        console.log(`📂 Target path: ${this.targetPath}`);
        console.log(`🔍 Mode: ${this.dryRun ? 'DRY RUN' : 'LIVE MODIFICATION'}`);
        console.log('');

        const startTime = Date.now();

        if (fs.existsSync(this.targetPath)) {
            await this.scanDirectory(this.targetPath);
        } else {
            console.error(`❌ Target path does not exist: ${this.targetPath}`);
            return false;
        }

        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;

        console.log('\n📊 CONSOLE.LOG REMOVAL SUMMARY');
        console.log('=====================================');
        console.log(`Files Processed: ${this.statistics.filesProcessed}`);
        console.log(`Files Modified: ${this.statistics.filesModified}`);
        console.log(`Console.log Statements Removed: ${this.statistics.consoleLogsRemoved}`);
        console.log(`Errors Encountered: ${this.statistics.errorsEncountered}`);
        console.log(`Processing Time: ${duration.toFixed(2)}s`);

        if (this.dryRun) {
            console.log('\n💡 This was a DRY RUN. No files were modified.');
            console.log('   Run without --dry-run to apply changes.');
        } else if (this.statistics.filesModified > 0) {
            console.log('\n✅ Console.log removal completed successfully!');
            console.log('   Backups were created for all modified files.');
        }

        return this.statistics.errorsEncountered === 0;
    }
}

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        dryRun: args.includes('--dry-run'),
        targetPath: 'src'
    };

    // Parse target path
    const targetArg = args.find(arg => arg.startsWith('--target='));
    if (targetArg) {
        options.targetPath = targetArg.split('=')[1];
    }

    return options;
}

// Main execution
if (require.main === module) {
    const options = parseArgs();
    const remover = new ConsoleLogRemover(options);

    remover.run().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = ConsoleLogRemover;