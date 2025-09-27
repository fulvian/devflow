#!/usr/bin/env node

/**
 * Critical Issues Bridge - Node.js Integration Layer
 * Bridges Python hooks with TypeScript services for critical issues tracking
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

class CriticalIssuesBridge {
    constructor() {
        this.configPath = path.join(__dirname, '../config/critical-issues-config.json');
        this.logFile = path.join(__dirname, '../../logs/critical-issues-bridge.log');
        this.dbPath = './data/devflow_unified.sqlite';
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message}\n`;
        fs.appendFileSync(this.logFile, logEntry, 'utf8');
        console.log(logEntry.trim());
    }

    async detectIssues(context = {}) {
        try {
            this.log('Starting automated issue detection...');
            
            // Run Python pattern analyzer
            const pythonScript = path.join(__dirname, 'pattern-analyzer.py');
            const result = execSync(`python3 "${pythonScript}" --context '${JSON.stringify(context)}'`, {
                encoding: 'utf8',
                timeout: 30000
            });

            const detectedIssues = JSON.parse(result);
            this.log(`Detected ${detectedIssues.length} potential issues`);

            // Create issues in database via TypeScript service
            for (const issue of detectedIssues) {
                await this.createIssue(issue);
            }

            return detectedIssues;
        } catch (error) {
            this.log(`Error in issue detection: ${error.message}`);
            throw error;
        }
    }

    async createIssue(issueData) {
        try {
            // Use sqlite3 to insert directly
            const query = `INSERT INTO critical_issues (id, title, description, severity, category, project_context, pattern_hash) 
                          VALUES ('${issueData.id}', '${issueData.title}', '${issueData.description}', 
                                  '${issueData.severity}', '${issueData.category}', '${issueData.context}', '${issueData.hash}')`;
            
            execSync(`sqlite3 "${this.dbPath}" "${query}"`, { encoding: 'utf8' });
            this.log(`Created critical issue: ${issueData.title}`);
        } catch (error) {
            this.log(`Failed to create issue: ${error.message}`);
        }
    }
}

// Export for use in other hooks
if (require.main === module) {
    const bridge = new CriticalIssuesBridge();
    const context = process.argv[2] ? JSON.parse(process.argv[2]) : {};
    bridge.detectIssues(context).catch(console.error);
}

module.exports = CriticalIssuesBridge;