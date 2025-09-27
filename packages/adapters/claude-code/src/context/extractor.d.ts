import type { MemoryBlock } from '@devflow/shared';
export interface ExtractedContext {
    blocks: MemoryBlock[];
}
export declare function extractFromClaudeContext(contextDir: string, taskId: string, sessionId: string): Promise<ExtractedContext>;
//# sourceMappingURL=extractor.d.ts.map