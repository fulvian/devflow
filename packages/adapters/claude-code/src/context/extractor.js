import { readJSONSafe, listFilesRecursively } from '../filesystem/safe-ops.js';
export async function extractFromClaudeContext(contextDir, taskId, sessionId) {
    const files = listFilesRecursively(contextDir);
    const blocks = [];
    for (const f of files) {
        if (f.endsWith('.json')) {
            const json = readJSONSafe(f);
            if (!json)
                continue;
            blocks.push({
                id: crypto.randomUUID(),
                taskId,
                sessionId,
                blockType: 'context',
                label: f.split('/').slice(-1)[0] || 'unknown',
                content: JSON.stringify(json).slice(0, 5000),
                metadata: { source: 'claude_context', path: f, platform: 'claude_code' },
                importanceScore: 0.5,
                relationships: [],
                createdAt: new Date(),
                lastAccessed: new Date(),
                accessCount: 1,
            });
        }
    }
    return { blocks };
}
//# sourceMappingURL=extractor.js.map