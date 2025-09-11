export interface ContextEvent {
    type: 'create' | 'change' | 'delete';
    file: string;
    taskId?: string;
    sessionId?: string;
}
export declare function watchContextDir(dir: string, onEvent: (evt: ContextEvent) => void): () => void;
//# sourceMappingURL=watcher.d.ts.map