import { SyntheticGateway } from '@devflow/synthetic';
import { Edit, MultiEdit, Read, Write } from '../tools/file-operations.js';
import * as path from 'path';
import * as fs from 'fs';
export class AutonomousCodeModifier {
    gateway;
    workingDirectory;
    constructor(gateway, workingDirectory = process.cwd()) {
        this.gateway = gateway;
        this.workingDirectory = workingDirectory;
    }
    /**
     * Execute autonomous code modifications based on natural language request
     */
    async modifyCode(request) {
        console.log('🤖 Autonomous Code Modification Started...');
        console.log(`   Task: ${request.task}`);
        console.log(`   Files: ${request.files.length} target files`);
        console.log(`   Mode: ${request.dryRun ? 'DRY RUN' : 'LIVE EXECUTION'}`);
        try {
            // Step 1: Read existing files and analyze codebase
            const fileContents = await this.readTargetFiles(request.files);
            // Step 2: Generate modification plan using Synthetic.new
            const modificationPlan = await this.generateModificationPlan(request, fileContents);
            // Step 3: Execute modifications (or dry run)
            const changes = request.dryRun
                ? await this.simulateChanges(modificationPlan)
                : await this.executeChanges(modificationPlan, request.requireApproval);
            // Step 4: Generate summary and results
            const result = {
                success: true,
                changes,
                summary: modificationPlan.summary,
                tokensUsed: modificationPlan.tokensUsed,
                agent: modificationPlan.agent,
            };
            console.log(`✅ Autonomous modification completed: ${changes.length} files affected`);
            return result;
        }
        catch (error) {
            console.error('❌ Autonomous modification failed:', error);
            return {
                success: false,
                changes: [],
                summary: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                tokensUsed: 0,
                agent: 'none',
                errors: [error instanceof Error ? error.message : 'Unknown error'],
            };
        }
    }
    /**
     * Generate a structured modification plan using Synthetic.new
     */
    async generateModificationPlan(request, fileContents) {
        const contextualPrompt = this.buildContextualPrompt(request, fileContents);
        const planRequest = {
            title: 'Autonomous Code Modification Plan',
            description: contextualPrompt,
            messages: [{
                    role: 'user',
                    content: contextualPrompt,
                }],
            maxTokens: 1500,
            temperature: 0.1, // Low temperature for precise code generation
        };
        // Use code agent for implementation tasks
        const result = await this.gateway.processWithAgent('code', planRequest);
        return {
            plan: result.text,
            summary: this.extractSummary(result.text),
            operations: this.parseModificationOperations(result.text),
            tokensUsed: result.tokensUsed || 0,
            agent: result.agent,
        };
    }
    buildContextualPrompt(request, fileContents) {
        let prompt = `AUTONOMOUS CODE MODIFICATION REQUEST

TASK: ${request.task}

CONSTRAINTS:
${(request.constraints || []).map(c => `- ${c}`).join('\n')}
- Maintain existing code style and patterns
- Preserve all existing functionality unless explicitly modifying it
- Add appropriate error handling and validation
- Include helpful comments for complex logic

CURRENT CODEBASE CONTEXT:
`;
        // Add file contents with proper formatting
        Object.entries(fileContents).forEach(([filepath, content]) => {
            prompt += `\n--- ${filepath} ---\n${content}\n`;
        });
        prompt += `\nINSTRUCTIONS:
1. Analyze the existing code structure and patterns
2. Generate specific file modifications to accomplish the task
3. Format your response as structured JSON with this format:

\`\`\`json
{
  "summary": "Brief description of changes made",
  "modifications": [
    {
      "file": "path/to/file.ts",
      "action": "modify|create|delete", 
      "changes": [
        {
          "old": "code to replace (exact match required)",
          "new": "replacement code",
          "description": "what this change does"
        }
      ]
    }
  ]
}
\`\`\`

IMPORTANT: 
- Provide exact string matches for "old" code (including whitespace)
- Ensure "new" code maintains proper indentation and formatting
- Test logic should be comprehensive and handle edge cases
- Only modify what's necessary to complete the task

Generate the modification plan now:`;
        return prompt;
    }
    async readTargetFiles(files) {
        const contents = {};
        for (const file of files) {
            try {
                const fullPath = path.resolve(this.workingDirectory, file);
                if (await this.fileExists(fullPath)) {
                    contents[file] = await fs.promises.readFile(fullPath, 'utf-8');
                }
                else {
                    console.log(`⚠️ File not found: ${file} (will be created)`);
                    contents[file] = ''; // Empty content for new files
                }
            }
            catch (error) {
                console.warn(`Warning: Could not read ${file}:`, error);
                contents[file] = '';
            }
        }
        return contents;
    }
    parseModificationOperations(planText) {
        try {
            // Extract JSON from the response
            const jsonMatch = planText.match(/```json\n([\s\S]*?)\n```/);
            if (!jsonMatch) {
                throw new Error('No JSON modification plan found in response');
            }
            const parsed = JSON.parse(jsonMatch[1]);
            return parsed.modifications || [];
        }
        catch (error) {
            console.error('Failed to parse modification plan:', error);
            return [];
        }
    }
    extractSummary(planText) {
        try {
            const jsonMatch = planText.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[1]);
                return parsed.summary || 'Code modifications generated';
            }
        }
        catch (error) {
            // Fallback: extract first paragraph
            const lines = planText.split('\n');
            return lines.find(line => line.trim().length > 10) || 'Code modifications generated';
        }
        return 'Code modifications generated';
    }
    async simulateChanges(plan) {
        const changes = [];
        for (const operation of plan.operations) {
            const change = {
                filepath: operation.file,
                action: operation.action,
                changes: operation.changes || [],
            };
            if (operation.action === 'create') {
                change.newContent = this.generateNewFileContent(operation.changes);
            }
            changes.push(change);
        }
        return changes;
    }
    async executeChanges(plan, requireApproval = false) {
        const changes = [];
        for (const operation of plan.operations) {
            if (requireApproval) {
                const approved = await this.requestApproval(operation);
                if (!approved) {
                    console.log(`⏭️ Skipping ${operation.file} (not approved)`);
                    continue;
                }
            }
            const change = await this.executeFileOperation(operation);
            changes.push(change);
        }
        return changes;
    }
    async executeFileOperation(operation) {
        const filepath = path.resolve(this.workingDirectory, operation.file);
        switch (operation.action) {
            case 'create':
                const newContent = this.generateNewFileContent(operation.changes);
                await fs.promises.writeFile(filepath, newContent, 'utf-8');
                return {
                    filepath: operation.file,
                    action: 'create',
                    newContent,
                };
            case 'modify':
                const oldContent = await fs.promises.readFile(filepath, 'utf-8');
                let modifiedContent = oldContent;
                for (const change of operation.changes) {
                    modifiedContent = modifiedContent.replace(change.old, change.new);
                }
                await fs.promises.writeFile(filepath, modifiedContent, 'utf-8');
                return {
                    filepath: operation.file,
                    action: 'modify',
                    oldContent,
                    newContent: modifiedContent,
                    changes: operation.changes,
                };
            case 'delete':
                await fs.promises.unlink(filepath);
                return {
                    filepath: operation.file,
                    action: 'delete',
                };
            default:
                throw new Error(`Unknown operation: ${operation.action}`);
        }
    }
    generateNewFileContent(changes) {
        // For new files, combine all "new" content
        return changes.map(c => c.new).join('\n');
    }
    async requestApproval(operation) {
        // In a real implementation, this would show a UI prompt
        // For now, return true (auto-approve)
        console.log(`🤔 Approval requested for ${operation.file} (${operation.action})`);
        return true;
    }
    async fileExists(filepath) {
        try {
            await fs.promises.access(filepath);
            return true;
        }
        catch {
            return false;
        }
    }
}
//# sourceMappingURL=code-modifier.js.map