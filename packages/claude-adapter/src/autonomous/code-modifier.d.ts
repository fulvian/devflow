import { SyntheticGateway } from '@devflow/synthetic';
export interface CodeModificationRequest {
    readonly task: string;
    readonly files: string[];
    readonly constraints?: string[];
    readonly dryRun?: boolean;
    readonly requireApproval?: boolean;
}
export interface CodeModificationResult {
    readonly success: boolean;
    readonly changes: FileChange[];
    readonly summary: string;
    readonly tokensUsed: number;
    readonly agent: string;
    readonly errors?: string[];
}
export interface FileChange {
    readonly filepath: string;
    readonly action: 'create' | 'modify' | 'delete';
    readonly oldContent?: string;
    readonly newContent?: string;
    readonly changes?: Array<{
        oldString: string;
        newString: string;
        lineNumber?: number;
    }>;
}
export declare class AutonomousCodeModifier {
    private readonly gateway;
    private readonly workingDirectory;
    constructor(gateway: SyntheticGateway, workingDirectory?: string);
    /**
     * Execute autonomous code modifications based on natural language request
     */
    modifyCode(request: CodeModificationRequest): Promise<CodeModificationResult>;
    /**
     * Generate a structured modification plan using Synthetic.new
     */
    private generateModificationPlan;
    private buildContextualPrompt;
    private readTargetFiles;
    private parseModificationOperations;
    private extractSummary;
    private simulateChanges;
    private executeChanges;
    private executeFileOperation;
    private generateNewFileContent;
    private requestApproval;
    private fileExists;
}
//# sourceMappingURL=code-modifier.d.ts.map