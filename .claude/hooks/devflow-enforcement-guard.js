#!/usr/bin/env node

/**
 * DEVFLOW ENFORCEMENT GUARD v1.0 - Context7 Pattern Implementation
 *
 * Robust enforcement system for 100-line limit and orchestrator delegation
 * Based on TDD Guard pattern for reliable blocking of violations
 *
 * Author: DevFlow Team
 * Architecture: Unified Orchestrator v1.0 compliant
 */

const fs = require('fs');
const path = require('path');

class DevFlowEnforcementGuard {
    constructor() {
        this.projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
        this.config = this.loadConfig();
        this.maxLines = this.config.maxLines || 100;
        this.enabled = this.config.guardEnabled !== false;
        this.enforcementMode = this.config.enforcementMode || 'strict';
        this.startTime = Date.now();
    }

    loadConfig() {
        const configPath = path.join(this.projectDir, '.claude', 'devflow-guard', 'config.json');
        try {
            if (fs.existsSync(configPath)) {
                const configData = fs.readFileSync(configPath, 'utf8');
                return JSON.parse(configData);
            }
        } catch (error) {
            this.logMessage(`Config load error: ${error.message}`, 'warn');
        }

        // Default configuration if file doesn't exist or fails to load
        return {
            guardEnabled: true,
            maxLines: 100,
            enforcementMode: 'strict',
            ignorePatterns: ['*.md', '*.json', '*.yml', '*.txt', '*.config.*'],
            allowedLargeFilePatterns: ['**/test/**', '**/*.test.*'],
            delegation: { enabled: true }
        };
    }

    analyzeToolInput(toolInput) {
        const content = toolInput.content || '';
        const filePath = toolInput.file_path || '';

        // Guard disabled check
        if (!this.enabled) {
            return {
                allowed: true,
                reason: 'DevFlow Guard disabled',
                analysis: { guardEnabled: false }
            };
        }

        // Skip if file should be ignored
        if (this.shouldIgnoreFile(filePath)) {
            return {
                allowed: true,
                reason: 'File matches ignore patterns',
                analysis: { ignored: true, filePath }
            };
        }

        // Allow large files for specific patterns (tests, etc.)
        if (this.isAllowedLargeFile(filePath)) {
            return {
                allowed: true,
                reason: 'File matches allowed large file patterns',
                analysis: { allowedLarge: true, filePath }
            };
        }

        // Analyze content
        const lineCount = this.countLines(content);
        const analysis = {
            filePath,
            lineCount,
            maxAllowed: this.maxLines,
            enforcement: this.enforcementMode,
            timestamp: new Date().toISOString()
        };

        if (lineCount > this.maxLines) {
            return {
                allowed: false,
                reason: `File exceeds ${this.maxLines}-line limit (${lineCount} lines). Use Task tool for delegation to Unified Orchestrator.`,
                violation: 'line_limit_exceeded',
                analysis,
                suggestion: this.generateDelegationSuggestion(filePath, lineCount)
            };
        }

        return {
            allowed: true,
            reason: 'File within line limits',
            analysis
        };
    }

    countLines(content) {
        if (!content || typeof content !== 'string') return 0;

        // Handle different line ending types
        const lines = content.split(/\r\n|\r|\n/);

        // Filter out empty lines at the end
        let actualLines = lines.length;
        while (actualLines > 0 && lines[actualLines - 1].trim() === '') {
            actualLines--;
        }

        return Math.max(actualLines, 1); // At least 1 line if content exists
    }

    shouldIgnoreFile(filePath) {
        if (!filePath) return false;

        const ignorePatterns = this.config.ignorePatterns || [];
        const fileName = path.basename(filePath);
        const relativePath = path.relative(this.projectDir, filePath);

        return ignorePatterns.some(pattern => {
            // Convert glob pattern to regex
            const regexPattern = pattern
                .replace(/\./g, '\\.')      // Escape dots
                .replace(/\*/g, '.*')       // Convert * to .*
                .replace(/\?/g, '.');       // Convert ? to .

            const regex = new RegExp(`^${regexPattern}$`, 'i');

            // Test against filename and relative path
            return regex.test(fileName) || regex.test(relativePath);
        });
    }

    isAllowedLargeFile(filePath) {
        if (!filePath) return false;

        const allowedPatterns = this.config.allowedLargeFilePatterns || [];
        const relativePath = path.relative(this.projectDir, filePath);

        return allowedPatterns.some(pattern => {
            const regexPattern = pattern
                .replace(/\./g, '\\.')
                .replace(/\*\*/g, '§DOUBLESTAR§')  // Temporary placeholder
                .replace(/\*/g, '[^/]*')           // Single * matches within directory
                .replace(/§DOUBLESTAR§/g, '.*');   // ** matches across directories

            const regex = new RegExp(`^${regexPattern}$`, 'i');
            return regex.test(relativePath);
        });
    }

    generateDelegationSuggestion(filePath, lineCount) {
        const fileName = path.basename(filePath);
        const excess = lineCount - this.maxLines;

        return {
            type: 'task_delegation',
            message: `File "${fileName}" has ${lineCount} lines (${excess} over limit).`,
            delegationPrompt: this.createDelegationPrompt(filePath, lineCount),
            orchestratorInfo: {
                enabled: this.config.delegation?.enabled || false,
                url: this.config.delegation?.orchestratorUrl || 'http://localhost:3005',
                autoSplit: this.config.delegation?.autoSplit || true
            }
        };
    }

    createDelegationPrompt(filePath, lineCount) {
        const fileName = path.basename(filePath);

        return `AUTOMATED DELEGATION REQUEST:

File: ${fileName}
Current size: ${lineCount} lines
Limit: ${this.maxLines} lines

Please use the Task tool to delegate this implementation to the Unified Orchestrator system.

The system will automatically:
1. Route to appropriate CLI agent (Codex for bulk implementation)
2. Apply 100-line limit enforcement per file
3. Use Synthetic fallback if CLI limits reached
4. Execute cross-verification from different agent
5. Split content appropriately across multiple files

Original request will be processed with enforced file size limits.`;
    }

    logMessage(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level.toUpperCase()}] DevFlow Guard: ${message}`;

        // Log to stderr for hook visibility
        console.error(logEntry);

        // Log to file if configured
        if (this.config.logging?.enabled) {
            try {
                const logFile = path.join(this.projectDir, this.config.logging.logFile || '.claude/devflow-guard/enforcement.log');
                const logDir = path.dirname(logFile);

                // Ensure log directory exists
                if (!fs.existsSync(logDir)) {
                    fs.mkdirSync(logDir, { recursive: true });
                }

                fs.appendFileSync(logFile, logEntry + '\n');
            } catch (error) {
                // Fail silently for logging errors
                console.error(`[${timestamp}] [ERROR] Failed to write log: ${error.message}`);
            }
        }
    }

    generateBlockResponse(analysis) {
        const delegationPrompt = analysis.suggestion?.delegationPrompt || 'Use Task tool for delegation.';

        return {
            decision: 'block',
            reason: analysis.reason,
            violation: analysis.violation,
            details: {
                filePath: analysis.analysis.filePath,
                lineCount: analysis.analysis.lineCount,
                maxAllowed: analysis.analysis.maxAllowed,
                enforcement: analysis.analysis.enforcement,
                suggestion: analysis.suggestion?.message || 'File exceeds line limit'
            },
            delegationPrompt,
            guardInfo: {
                version: '1.0',
                enabled: this.enabled,
                mode: this.enforcementMode,
                timestamp: analysis.analysis.timestamp
            }
        };
    }

    generateAllowResponse(analysis) {
        return {
            decision: 'allow',
            reason: analysis.reason,
            details: {
                filePath: analysis.analysis?.filePath || 'unknown',
                lineCount: analysis.analysis?.lineCount || 0,
                maxAllowed: this.maxLines,
                status: 'within_limits'
            },
            guardInfo: {
                version: '1.0',
                enabled: this.enabled,
                mode: this.enforcementMode,
                processingTime: Date.now() - this.startTime
            }
        };
    }
}

// Main execution function
async function main() {
    let inputData = {};

    try {
        // Read input from stdin
        const input = process.stdin.read();
        if (input) {
            inputData = JSON.parse(input.toString());
        } else {
            // Handle case where no input is provided
            console.log(JSON.stringify({
                status: 'no_input',
                guardInfo: { version: '1.0', enabled: false }
            }));
            return;
        }

        const toolName = inputData.tool_name || '';
        const toolInput = inputData.tool_input || {};

        // Only enforce on code-writing tools
        const codeWritingTools = ['Write', 'Edit', 'MultiEdit'];
        if (!codeWritingTools.includes(toolName)) {
            console.log(JSON.stringify({
                status: 'passthrough',
                reason: `Tool "${toolName}" not subject to line limit enforcement`,
                guardInfo: { version: '1.0', enabled: true }
            }));
            return;
        }

        // Initialize guard and analyze
        const guard = new DevFlowEnforcementGuard();
        const analysis = guard.analyzeToolInput(toolInput);

        guard.logMessage(`Analyzed ${toolName} operation: ${analysis.allowed ? 'ALLOWED' : 'BLOCKED'} - ${analysis.reason}`);

        if (!analysis.allowed) {
            // BLOCK the operation with structured output
            const blockResponse = guard.generateBlockResponse(analysis);
            console.log(JSON.stringify(blockResponse));
            process.exit(0); // Exit successfully but with block decision
        } else {
            // ALLOW the operation
            const allowResponse = guard.generateAllowResponse(analysis);
            console.log(JSON.stringify(allowResponse));
        }

    } catch (error) {
        // Error handling - fail safe (allow operation)
        const errorResponse = {
            status: 'error_passthrough',
            error: error.message,
            reason: 'Guard error - allowing operation to proceed',
            guardInfo: { version: '1.0', enabled: false }
        };

        console.error(`DevFlow Guard Error: ${error.message}`);
        console.log(JSON.stringify(errorResponse));
    }
}

// Handle different execution contexts
if (require.main === module) {
    // Direct execution
    process.stdin.setEncoding('utf8');

    process.stdin.on('readable', () => {
        main();
    });

    process.stdin.on('end', () => {
        // Handle case where stdin ends without data
        if (!process.stdin.read()) {
            main();
        }
    });

    // Timeout safety
    setTimeout(() => {
        console.log(JSON.stringify({
            status: 'timeout_passthrough',
            reason: 'Guard timed out - allowing operation',
            guardInfo: { version: '1.0', enabled: false }
        }));
        process.exit(0);
    }, 5000); // 5 second timeout
} else {
    // Module export for testing
    module.exports = DevFlowEnforcementGuard;
}