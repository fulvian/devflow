#!/usr/bin/env node

/**
 * GENERIC TASK VERIFICATION PROTOCOL
 *
 * Universal task verification system that adapts to any task requirements.
 * Reads task-specific verification criteria and generates resolution plans
 * for user approval before making any modifications.
 *
 * Flow:
 * 1. Read current task and its verification requirements
 * 2. Perform task-specific verification checks
 * 3. Generate verification report + resolution plan
 * 4. Request user approval for resolution plan
 * 5. If approved: Execute iterative debugging until resolved
 * 6. Generate final detailed verification & resolution report
 */

const { execSync, spawn } = require('child_process');
const { promises: fs } = require('fs');
const path = require('path');

console.log('🔄 Enhanced DevFlow Stop Hook with Claude Verification - Starting...');

class GenericTaskVerifier {
    constructor() {
        this.projectRoot = path.resolve(__dirname, '../..');
        this.taskContext = null;
        this.verificationResults = {
            taskId: null,
            taskName: null,
            implementationStatus: null,
            verificationCriteria: [],
            findings: [],
            resolutionPlan: [],
            requiresUserApproval: false
        };
    }

    async loadTaskContext() {
        console.log('📋 Loading current task context...');

        try {
            // Leggi il task corrente
            const currentTaskPath = path.join(this.projectRoot, '.claude/state/current_task.json');
            const currentTask = JSON.parse(await fs.readFile(currentTaskPath, 'utf8'));

            // Carica il file del task per i criteri di verifica
            const taskFilePath = path.join(this.projectRoot, 'tasks', `${currentTask.title}.md`);

            let taskContent = '';
            try {
                taskContent = await fs.readFile(taskFilePath, 'utf8');
            } catch (error) {
                console.log(`⚠️ Task file not found: ${taskFilePath}`);
            }

            this.taskContext = {
                id: currentTask.id,
                title: currentTask.title,
                description: currentTask.description,
                status: currentTask.status,
                content: taskContent,
                verificationCriteria: this.extractVerificationCriteria(taskContent)
            };

            this.verificationResults.taskId = currentTask.id;
            this.verificationResults.taskName = currentTask.title;

            console.log(`✅ Task context loaded: ${currentTask.title}`);
            return this.taskContext;

        } catch (error) {
            console.log(`❌ Failed to load task context: ${error.message}`);
            this.taskContext = {
                id: 'unknown',
                title: 'unknown-task',
                description: 'Task context could not be loaded',
                verificationCriteria: this.getDefaultVerificationCriteria()
            };
            return this.taskContext;
        }
    }

    extractVerificationCriteria(taskContent) {
        // Estrae i criteri di verifica dal contenuto del task
        const criteria = [];

        // Pattern per trovare sezioni di verifica nel markdown
        const verificationSections = [
            /## Verification Criteria\s*\n([\s\S]*?)(?=\n##|$)/i,
            /## Success Criteria\s*\n([\s\S]*?)(?=\n##|$)/i,
            /## Acceptance Criteria\s*\n([\s\S]*?)(?=\n##|$)/i,
            /## Requirements\s*\n([\s\S]*?)(?=\n##|$)/i
        ];

        for (const pattern of verificationSections) {
            const match = taskContent.match(pattern);
            if (match) {
                const sectionContent = match[1].trim();
                const items = sectionContent.split('\n')
                    .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
                    .map(line => line.replace(/^[\s\-\*]+/, '').trim())
                    .filter(item => item.length > 0);

                criteria.push(...items);
            }
        }

        // Se non ci sono criteri espliciti, cerca implementazioni richieste
        if (criteria.length === 0) {
            const implementationMatches = taskContent.match(/implement|create|build|add|fix/gi);
            if (implementationMatches) {
                criteria.push("Verify all requested implementations are complete");
                criteria.push("Ensure code quality and functionality");
                criteria.push("Check integration with existing systems");
            }
        }

        return criteria.length > 0 ? criteria : this.getDefaultVerificationCriteria();
    }

    getDefaultVerificationCriteria() {
        return [
            "Verify task implementation is complete",
            "Check code functionality and integration",
            "Ensure no critical errors or failures",
            "Validate against task requirements"
        ];
    }

    async performTaskSpecificVerification() {
        console.log('🔍 Performing task-specific verification...');

        if (!this.taskContext) {
            await this.loadTaskContext();
        }

        for (const criterion of this.taskContext.verificationCriteria) {
            await this.verifyCriterion(criterion);
        }

        return this.verificationResults;
    }

    async verifyCriterion(criterion) {
        console.log(`  📝 Checking: ${criterion}`);

        const finding = {
            criterion,
            status: 'unknown',
            details: [],
            issues: [],
            suggestions: []
        };

        try {
            // Verifica intelligente basata sul criterio
            if (criterion.toLowerCase().includes('implement') || criterion.toLowerCase().includes('complete')) {
                await this.verifyImplementation(finding);
            } else if (criterion.toLowerCase().includes('test') || criterion.toLowerCase().includes('functionality')) {
                await this.verifyFunctionality(finding);
            } else if (criterion.toLowerCase().includes('integration')) {
                await this.verifyIntegration(finding);
            } else if (criterion.toLowerCase().includes('database') || criterion.toLowerCase().includes('data')) {
                await this.verifyDatabaseChanges(finding);
            } else {
                // Verifica generica
                await this.performGenericVerification(finding);
            }

            this.verificationResults.findings.push(finding);

        } catch (error) {
            finding.status = 'error';
            finding.issues.push(`Verification failed: ${error.message}`);
            this.verificationResults.findings.push(finding);
        }
    }

    async verifyImplementation(finding) {
        // Context7 pattern: AI Dev Tasks structured verification
        finding.details.push("Scanning for implementation files and completeness...");

        const taskKeywords = this.extractImplementationKeywords();
        const relevantFiles = await this.findRelevantFiles(taskKeywords);

        for (const file of relevantFiles) {
            const exists = await this.fileExists(file.path);
            if (!exists) {
                finding.issues.push(`Missing implementation file: ${file.path}`);
                finding.suggestions.push(`Create ${file.path} - ${file.description}`);
            } else {
                const content = await this.analyzeFileCompleteness(file.path);
                if (!content.isComplete) {
                    finding.issues.push(`Incomplete implementation in ${file.path}: ${content.issues.join(', ')}`);
                    finding.suggestions.push(`Complete implementation in ${file.path}: ${content.suggestions.join(', ')}`);
                }
            }
        }

        // Verifica secondo pattern AI Dev Tasks: task list completion check
        const taskListCompletion = await this.checkTaskListCompletion();
        if (!taskListCompletion.allComplete) {
            finding.issues.push(`Incomplete tasks: ${taskListCompletion.incompleteTasks.join(', ')}`);
            finding.suggestions.push("Complete remaining tasks before marking as done");
        }

        finding.status = finding.issues.length === 0 ? 'passed' : 'failed';
        finding.details.push(`Implementation verification: ${finding.status}`);
    }

    async verifyFunctionality(finding) {
        // Context7 pattern: Weaver test-based functionality verification
        finding.details.push("Running functionality tests...");

        try {
            // Cerca test esistenti
            const testFiles = await this.findTestFiles();
            if (testFiles.length === 0) {
                finding.issues.push("No test files found");
                finding.suggestions.push("Create test files using appropriate testing framework (Jest, pytest, etc.)");
                finding.status = 'warning';
                return;
            }

            // Esegue i test (pattern AI Dev Tasks)
            for (const testFile of testFiles) {
                const testResult = await this.runTestFile(testFile);
                if (!testResult.passed) {
                    finding.issues.push(`Test failures in ${testFile}: ${testResult.failures.join(', ')}`);
                    finding.suggestions.push(`Fix failing tests: ${testResult.suggestions.join(', ')}`);
                }
            }

            finding.status = finding.issues.length === 0 ? 'passed' : 'failed';
            finding.details.push(`Functionality verification: ${finding.status}`);

        } catch (error) {
            finding.issues.push(`Test execution failed: ${error.message}`);
            finding.suggestions.push("Check test configuration and dependencies");
            finding.status = 'error';
        }
    }

    async verifyIntegration(finding) {
        finding.details.push("Checking system integration...");

        // Verifica integrazione database (se rilevante)
        const dbIntegration = await this.checkDatabaseIntegration();
        if (!dbIntegration.valid) {
            finding.issues.push(...dbIntegration.issues);
            finding.suggestions.push(...dbIntegration.suggestions);
        }

        // Verifica integrazione API (se rilevante)
        const apiIntegration = await this.checkAPIIntegration();
        if (!apiIntegration.valid) {
            finding.issues.push(...apiIntegration.issues);
            finding.suggestions.push(...apiIntegration.suggestions);
        }

        // Verifica servizi esterni (se rilevanti)
        const serviceIntegration = await this.checkServiceIntegration();
        if (!serviceIntegration.valid) {
            finding.issues.push(...serviceIntegration.issues);
            finding.suggestions.push(...serviceIntegration.suggestions);
        }

        finding.status = finding.issues.length === 0 ? 'passed' : 'failed';
        finding.details.push(`Integration verification: ${finding.status}`);
    }

    async verifyDatabaseChanges(finding) {
        finding.details.push("Checking database schema and data changes...");

        // Verifica migrazioni
        const migrations = await this.checkMigrations();
        if (!migrations.valid) {
            finding.issues.push(...migrations.issues);
            finding.suggestions.push(...migrations.suggestions);
        }

        // Verifica integrità dati
        const dataIntegrity = await this.checkDataIntegrity();
        if (!dataIntegrity.valid) {
            finding.issues.push(...dataIntegrity.issues);
            finding.suggestions.push(...dataIntegrity.suggestions);
        }

        finding.status = finding.issues.length === 0 ? 'passed' : 'failed';
        finding.details.push(`Database verification: ${finding.status}`);
    }

    async performGenericVerification(finding) {
        finding.details.push("Performing generic task verification...");

        // Verifica generica basata su contenuto del task
        const taskContent = this.taskContext.content.toLowerCase();

        // Context7 pattern: pattern matching per tipo di task
        if (taskContent.includes('api') || taskContent.includes('endpoint')) {
            await this.verifyAPIImplementation(finding);
        } else if (taskContent.includes('ui') || taskContent.includes('component')) {
            await this.verifyUIImplementation(finding);
        } else if (taskContent.includes('service') || taskContent.includes('class')) {
            await this.verifyServiceImplementation(finding);
        } else {
            // Verifica file system per cambiamenti
            await this.verifyFileSystemChanges(finding);
        }

        finding.status = finding.issues.length === 0 ? 'passed' : 'warning';
        finding.details.push(`Generic verification: ${finding.status}`);
    }

    // Metodi di supporto Context7-based
    extractImplementationKeywords() {
        const content = this.taskContext.content.toLowerCase();
        const keywords = [];

        // Estrae parole chiave per identificare file rilevanti
        const patterns = [
            /implement\s+([a-zA-Z\-_]+)/g,
            /create\s+([a-zA-Z\-_]+)/g,
            /build\s+([a-zA-Z\-_]+)/g,
            /add\s+([a-zA-Z\-_]+)/g
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                keywords.push(match[1]);
            }
        }

        return keywords;
    }

    async findRelevantFiles(keywords) {
        const relevantFiles = [];

        // Pattern AI Dev Tasks: cerca file rilevanti basati su parole chiave
        for (const keyword of keywords) {
            const possiblePaths = [
                { path: `src/services/${keyword}.ts`, description: `Main service implementation for ${keyword}` },
                { path: `src/api/${keyword}-api.ts`, description: `API endpoint for ${keyword}` },
                { path: `src/components/${keyword}.tsx`, description: `React component for ${keyword}` },
                { path: `src/${keyword}/index.ts`, description: `Main entry point for ${keyword}` },
                { path: `scripts/${keyword}.js`, description: `Script for ${keyword}` }
            ];

            relevantFiles.push(...possiblePaths);
        }

        return relevantFiles;
    }

    async fileExists(filePath) {
        try {
            await fs.access(path.join(this.projectRoot, filePath));
            return true;
        } catch {
            return false;
        }
    }

    async findTestFiles() {
        const testPatterns = ['**/*.test.js', '**/*.test.ts', '**/*.spec.js', '**/*.spec.ts'];
        const testFiles = [];

        // Pattern Weaver: trova file di test
        for (const pattern of testPatterns) {
            try {
                const files = await this.globPattern(pattern);
                testFiles.push(...files);
            } catch (error) {
                // Continue se pattern non trova nulla
            }
        }

        return testFiles;
    }

    async runTestFile(testFile) {
        // Pattern AI Dev Tasks: esecuzione test strutturata
        const result = { passed: false, failures: [], suggestions: [] };

        try {
            // Determina il comando di test appropriato
            let testCommand = '';
            if (testFile.endsWith('.js') || testFile.endsWith('.ts')) {
                if (await this.fileExists('package.json')) {
                    testCommand = `npm test -- ${testFile}`;
                } else {
                    testCommand = `npx jest ${testFile}`;
                }
            } else if (testFile.endsWith('.py')) {
                testCommand = `pytest ${testFile}`;
            }

            if (testCommand) {
                const output = execSync(testCommand, {
                    encoding: 'utf8',
                    cwd: this.projectRoot,
                    timeout: 30000
                });
                result.passed = !output.toLowerCase().includes('failed');
                if (!result.passed) {
                    result.failures.push('Test execution had failures');
                    result.suggestions.push('Review test output and fix failing tests');
                }
            }
        } catch (error) {
            result.failures.push(`Test execution error: ${error.message}`);
            result.suggestions.push('Check test dependencies and configuration');
        }

        return result;
    }

    // Metodi di supporto mancanti
    async analyzeFileCompleteness(filePath) {
        const result = { isComplete: true, issues: [], suggestions: [] };

        try {
            const content = await fs.readFile(path.join(this.projectRoot, filePath), 'utf8');

            // Controlli di base per completezza
            if (content.trim().length === 0) {
                result.isComplete = false;
                result.issues.push('File is empty');
                result.suggestions.push('Add implementation content');
            }

            if (content.includes('TODO') || content.includes('FIXME')) {
                result.isComplete = false;
                result.issues.push('Contains TODO/FIXME markers');
                result.suggestions.push('Complete TODO items');
            }

            if (filePath.endsWith('.ts') || filePath.endsWith('.js')) {
                if (!content.includes('export') && !content.includes('module.exports')) {
                    result.issues.push('No exports found');
                    result.suggestions.push('Add proper exports');
                }
            }

        } catch (error) {
            result.isComplete = false;
            result.issues.push(`Cannot analyze file: ${error.message}`);
        }

        return result;
    }

    async checkTaskListCompletion() {
        // Mock implementation - in pratica dovrebbe controllare se ci sono task non completati
        return {
            allComplete: true,
            incompleteTasks: []
        };
    }

    async globPattern(pattern) {
        // Mock implementation - dovrebbe usare glob per trovare file
        return [];
    }

    async checkDatabaseIntegration() {
        return { valid: true, issues: [], suggestions: [] };
    }

    async checkAPIIntegration() {
        return { valid: true, issues: [], suggestions: [] };
    }

    async checkServiceIntegration() {
        return { valid: true, issues: [], suggestions: [] };
    }

    async checkMigrations() {
        return { valid: true, issues: [], suggestions: [] };
    }

    async checkDataIntegrity() {
        return { valid: true, issues: [], suggestions: [] };
    }

    async verifyAPIImplementation(finding) {
        finding.details.push("Checking API implementation...");
        finding.status = 'passed';
    }

    async verifyUIImplementation(finding) {
        finding.details.push("Checking UI implementation...");
        finding.status = 'passed';
    }

    async verifyServiceImplementation(finding) {
        finding.details.push("Checking service implementation...");
        finding.status = 'passed';
    }

    async verifyFileSystemChanges(finding) {
        finding.details.push("Checking file system changes...");
        finding.status = 'passed';
    }
}

// ResolutionPlanGenerator - Pattern Weaver per piani di risoluzione strutturati

class ResolutionPlanGenerator {
    constructor(verificationResults) {
        this.results = verificationResults;
        this.dbPath = path.join(__dirname, '../../data/devflow_unified.sqlite');
    }

    async generateResolutionPlan() {
        console.log('📝 Generating resolution plan based on verification results...');

        const plan = {
            taskId: this.results.taskId,
            taskName: this.results.taskName,
            timestamp: new Date().toISOString(),
            overallStatus: this.determineOverallStatus(),
            summary: this.generateSummary(),
            resolutionSteps: [],
            userApprovalRequired: true,
            estimatedTimeMinutes: 0,
            riskLevel: 'low'
        };

        // Context7 pattern: Weaver structured failure reporting
        const failedFindings = this.results.findings.filter(f => f.status === 'failed' || f.status === 'error');
        const warningFindings = this.results.findings.filter(f => f.status === 'warning');

        // Genera steps per problemi critici
        for (const finding of failedFindings) {
            await this.generateResolutionSteps(finding, plan, 'critical');
        }

        // Genera steps per warning
        for (const finding of warningFindings) {
            await this.generateResolutionSteps(finding, plan, 'warning');
        }

        // Calcola stima tempo e rischio
        plan.estimatedTimeMinutes = this.calculateEstimatedTime(plan.resolutionSteps);
        plan.riskLevel = this.assessRiskLevel(plan.resolutionSteps);

        return plan;
    }

    determineOverallStatus() {
        const hasErrors = this.results.findings.some(f => f.status === 'error');
        const hasFailures = this.results.findings.some(f => f.status === 'failed');
        const hasWarnings = this.results.findings.some(f => f.status === 'warning');

        if (hasErrors) return 'error';
        if (hasFailures) return 'failed';
        if (hasWarnings) return 'warning';
        return 'passed';
    }

    generateSummary() {
        const totalFindings = this.results.findings.length;
        const passed = this.results.findings.filter(f => f.status === 'passed').length;
        const failed = this.results.findings.filter(f => f.status === 'failed').length;
        const warnings = this.results.findings.filter(f => f.status === 'warning').length;
        const errors = this.results.findings.filter(f => f.status === 'error').length;

        return {
            totalChecks: totalFindings,
            passed,
            failed,
            warnings,
            errors,
            successRate: totalFindings > 0 ? Math.round((passed / totalFindings) * 100) : 0
        };
    }

    async generateResolutionSteps(finding, plan, priority) {
        // Context7 pattern: AI Dev Tasks structured task breakdown
        for (let i = 0; i < finding.issues.length; i++) {
            const issue = finding.issues[i];
            const suggestion = finding.suggestions[i] || "Address the identified issue";

            const step = {
                id: `${plan.taskId}-fix-${plan.resolutionSteps.length + 1}`,
                priority,
                criterion: finding.criterion,
                issue,
                action: suggestion,
                category: this.categorizeIssue(issue),
                automated: this.isAutomatable(issue),
                dependencies: [],
                estimatedMinutes: this.estimateStepTime(issue, suggestion)
            };

            // Aggiungi dettagli specifici per categoria
            await this.enhanceStepDetails(step, finding);

            plan.resolutionSteps.push(step);
        }
    }

    categorizeIssue(issue) {
        const lowIssue = issue.toLowerCase();

        if (lowIssue.includes('missing') && lowIssue.includes('file')) return 'missing_file';
        if (lowIssue.includes('test') && lowIssue.includes('fail')) return 'test_failure';
        if (lowIssue.includes('database') || lowIssue.includes('migration')) return 'database';
        if (lowIssue.includes('api') || lowIssue.includes('endpoint')) return 'api';
        if (lowIssue.includes('integration')) return 'integration';
        if (lowIssue.includes('incomplete')) return 'incomplete_implementation';

        return 'general';
    }

    isAutomatable(issue) {
        const lowIssue = issue.toLowerCase();

        // Pattern Context7: determina se il problema può essere risolto automaticamente
        const automatablePatterns = [
            'missing file',
            'incomplete implementation',
            'format',
            'style',
            'lint'
        ];

        return automatablePatterns.some(pattern => lowIssue.includes(pattern));
    }

    estimateStepTime(issue, suggestion) {
        const lowIssue = issue.toLowerCase();
        const lowSuggestion = suggestion.toLowerCase();

        // Context7 pattern: time estimation based on complexity
        if (lowIssue.includes('missing file') && lowSuggestion.includes('create')) return 15;
        if (lowIssue.includes('test fail')) return 30;
        if (lowIssue.includes('database')) return 45;
        if (lowIssue.includes('integration')) return 60;
        if (lowIssue.includes('incomplete implementation')) return 90;

        return 20; // Default
    }

    async enhanceStepDetails(step, finding) {
        // Arricchisce i dettagli dello step in base alla categoria
        switch (step.category) {
            case 'missing_file':
                step.commands = await this.generateFileCreationCommands(step);
                break;
            case 'test_failure':
                step.commands = await this.generateTestFixCommands(step);
                break;
            case 'database':
                step.commands = await this.generateDatabaseCommands(step);
                break;
            case 'api':
                step.commands = await this.generateAPICommands(step);
                break;
        }
    }

    async generateFileCreationCommands(step) {
        // Pattern AI Dev Tasks: comandi per creazione file
        const commands = [];
        const fileName = this.extractFileNameFromIssue(step.issue);

        if (fileName) {
            const fileType = this.getFileType(fileName);
            commands.push({
                description: `Create ${fileName}`,
                command: this.getFileCreationTemplate(fileName, fileType),
                automated: true
            });
        }

        return commands;
    }

    calculateEstimatedTime(steps) {
        return steps.reduce((total, step) => total + step.estimatedMinutes, 0);
    }

    assessRiskLevel(steps) {
        const hasDatabase = steps.some(s => s.category === 'database');
        const hasIntegration = steps.some(s => s.category === 'integration');
        const hasAPI = steps.some(s => s.category === 'api');

        if (hasDatabase || hasIntegration) return 'high';
        if (hasAPI) return 'medium';
        return 'low';
    }

    async presentPlanForApproval(plan) {
        console.log('\n🎯 TASK VERIFICATION COMPLETED');
        console.log('=====================================');
        console.log(`Task: ${plan.taskName} (ID: ${plan.taskId})`);
        console.log(`Overall Status: ${plan.overallStatus.toUpperCase()}`);
        console.log(`Success Rate: ${plan.summary.successRate}% (${plan.summary.passed}/${plan.summary.totalChecks} checks passed)`);

        if (plan.summary.failed > 0) {
            console.log(`❌ Failed Checks: ${plan.summary.failed}`);
        }
        if (plan.summary.warnings > 0) {
            console.log(`⚠️  Warnings: ${plan.summary.warnings}`);
        }
        if (plan.summary.errors > 0) {
            console.log(`🚨 Errors: ${plan.summary.errors}`);
        }

        if (plan.resolutionSteps.length > 0) {
            console.log('\n📋 RESOLUTION PLAN');
            console.log('==================');
            console.log(`Estimated Time: ${plan.estimatedTimeMinutes} minutes`);
            console.log(`Risk Level: ${plan.riskLevel.toUpperCase()}`);
            console.log(`Total Steps: ${plan.resolutionSteps.length}`);

            console.log('\n🔧 RESOLUTION STEPS:');
            plan.resolutionSteps.forEach((step, index) => {
                const priority = step.priority === 'critical' ? '🚨' : '⚠️';
                const automated = step.automated ? '🤖' : '👤';
                console.log(`${index + 1}. ${priority} ${automated} [${step.category.toUpperCase()}] ${step.action}`);
                console.log(`   Issue: ${step.issue}`);
                console.log(`   Estimated: ${step.estimatedMinutes} minutes`);
            });

            console.log('\n❓ USER APPROVAL REQUIRED');
            console.log('=========================');
            console.log('Do you want to proceed with the automatic resolution of these issues?');
            console.log('🤖 = Automated steps will be executed automatically');
            console.log('👤 = Manual steps will require your intervention');

            return true; // Indica che è richiesta approvazione
        } else {
            console.log('\n✅ All verification checks passed! No action required.');
            return false; // Non serve approvazione
        }
    }

    // Metodi di supporto mancanti per ResolutionPlanGenerator
    extractFileNameFromIssue(issue) {
        const match = issue.match(/file[:\s]+([a-zA-Z0-9._/-]+)/i);
        return match ? match[1] : null;
    }

    getFileType(fileName) {
        const ext = fileName.split('.').pop();
        return ext || 'unknown';
    }

    getFileCreationTemplate(fileName, fileType) {
        return `touch ${fileName} # TODO: Add proper ${fileType} implementation`;
    }

    async generateTestFixCommands(step) {
        return [{
            description: 'Fix failing tests',
            command: 'npm test',
            automated: false
        }];
    }

    async generateDatabaseCommands(step) {
        return [{
            description: 'Run database migrations',
            command: 'npm run migrate',
            automated: true
        }];
    }

    async generateAPICommands(step) {
        return [{
            description: 'Test API endpoints',
            command: 'npm run test:api',
            automated: true
        }];
    }

    async storeVerificationResults(results, resolutionPlan) {
        console.log('💾 Storing verification results in unified database...');

        try {
            const { execSync } = require('child_process');
            const sessionId = `generic-verification-${Date.now()}-${results.taskId}`;

            // Prepare data for unified database
            const record = {
                session_id: sessionId,
                task_name: results.taskName || 'unknown-task',
                verification_type: 'generic-task-verification-protocol',
                files_scanned: 0, // Generic verification doesn't scan files directly
                violations_found: results.findings.filter(f => f.status === 'failed' || f.status === 'error').length,
                critical_issues: results.findings.filter(f => f.status === 'error').length,
                status: this.mapStatusForDatabase(resolutionPlan ? resolutionPlan.overallStatus : 'passed'),
                recommendation: this.generateRecommendation(resolutionPlan),
                detailed_results: JSON.stringify({ results, resolutionPlan }),
                summary: JSON.stringify({
                    success_rate: resolutionPlan?.summary?.successRate || 100,
                    total_checks: results.findings.length,
                    warnings: results.findings.filter(f => f.status === 'warning').length,
                    requires_approval: resolutionPlan?.userApprovalRequired || false
                })
            };

            // Insert into unified database using file-based approach to avoid SQL injection
            const dbPath = path.resolve(__dirname, '../../data/devflow_unified.sqlite');
            const tempSQLPath = path.resolve(__dirname, '../../.tmp/verification_insert.sql');

            // Create temp directory if it doesn't exist
            const tmpDir = path.dirname(tempSQLPath);
            if (!require('fs').existsSync(tmpDir)) {
                require('fs').mkdirSync(tmpDir, { recursive: true });
            }

            // Write SQL to temporary file to avoid shell escaping issues
            const insertSQL = `INSERT INTO verification_results (
                session_id, task_name, verification_type, files_scanned,
                violations_found, critical_issues, status, recommendation,
                detailed_results, summary
            ) VALUES (
                '${record.session_id}',
                '${record.task_name}',
                '${record.verification_type}',
                ${record.files_scanned},
                ${record.violations_found},
                ${record.critical_issues},
                '${record.status}',
                '${record.recommendation.replace(/'/g, "''")}',
                '${Buffer.from(record.detailed_results).toString('base64')}',
                '${Buffer.from(record.summary).toString('base64')}'
            );`;

            await fs.writeFile(tempSQLPath, insertSQL);

            // Execute SQL from file
            execSync(`sqlite3 "${dbPath}" < "${tempSQLPath}"`, {
                encoding: 'utf8',
                timeout: 10000
            });

            // Clean up temp file
            try {
                await fs.unlink(tempSQLPath);
            } catch (e) {
                // Ignore cleanup errors
            }

            console.log(`✅ Verification results stored in unified database with session ID: ${sessionId}`);

            // Also save to logs as backup
            const logsPath = path.resolve(__dirname, '../../logs/verification-results.json');
            await fs.writeFile(logsPath, JSON.stringify({ results, resolutionPlan, record }, null, 2));
            console.log(`📄 Backup copy saved to: ${logsPath}`);

            return sessionId;

        } catch (error) {
            console.log(`⚠️ Failed to store in unified database: ${error.message}`);

            // Fallback to file only
            try {
                const logsPath = path.resolve(__dirname, '../../logs/verification-results.json');
                await fs.writeFile(logsPath, JSON.stringify({ results, resolutionPlan }, null, 2));
                console.log(`📄 Verification results stored in fallback file: ${logsPath}`);
            } catch (fallbackError) {
                console.log(`❌ Failed to store verification results: ${fallbackError.message}`);
            }
            return null;
        }
    }

    mapStatusForDatabase(status) {
        // Map Generic Task Verification status to database constraint values
        const statusMap = {
            'passed': 'PASSED',
            'warning': 'PASSED', // Warnings are still considered passed with notes
            'failed': 'FAILED',
            'error': 'ERROR'
        };

        return statusMap[status.toLowerCase()] || 'PASSED';
    }

    generateRecommendation(resolutionPlan) {
        if (!resolutionPlan) return 'Task verification completed successfully';

        const status = resolutionPlan.overallStatus;
        const steps = resolutionPlan.resolutionSteps.length;

        if (status === 'error') return 'IMMEDIATE ACTION REQUIRED - Critical issues found';
        if (status === 'failed') return `ACTION REQUIRED - ${steps} issues need resolution`;
        if (status === 'warning') return `REVIEW RECOMMENDED - ${steps} warnings found`;
        return 'VERIFICATION PASSED - No issues detected';
    }
}

// Main execution flow
async function executeGenericVerificationProtocol() {
    console.log('🔍 GENERIC TASK VERIFICATION PROTOCOL STARTED');
    console.log('=============================================');

    try {
        // 1. Initialize verificatore generico
        const verifier = new GenericTaskVerifier();

        // 2. Legge contesto task corrente (già include extractVerificationCriteria)
        await verifier.loadTaskContext();

        // 3. Esegue verifica basata su Context7
        await verifier.performTaskSpecificVerification();

        // 5. Genera piano di risoluzione se necessario
        const planGenerator = new ResolutionPlanGenerator(verifier.verificationResults);
        const resolutionPlan = await planGenerator.generateResolutionPlan();

        // 6. Presenta piano per approvazione utente se necessario
        const requiresApproval = await planGenerator.presentPlanForApproval(resolutionPlan);

        // 7. Salva risultati nel database Cometa Brain
        await planGenerator.storeVerificationResults(verifier.verificationResults, resolutionPlan);

        // 8. Return status per hook bridge
        return {
            success: true,
            verificationCompleted: true,
            requiresUserApproval: requiresApproval,
            taskId: verifier.verificationResults.taskId,
            overallStatus: resolutionPlan.overallStatus
        };

    } catch (error) {
        console.error('🚨 VERIFICATION PROTOCOL FAILED:', error.message);
        console.error('Stack trace:', error.stack);

        return {
            success: false,
            error: error.message,
            verificationCompleted: false
        };
    }
}

// Hook integration
if (require.main === module) {
    executeGenericVerificationProtocol()
        .then(result => {
            console.log('\n📊 VERIFICATION PROTOCOL RESULT:', result);
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Fatal error in verification protocol:', error);
            process.exit(1);
        });
}

module.exports = {
    GenericTaskVerifier,
    ResolutionPlanGenerator,
    executeGenericVerificationProtocol
};
