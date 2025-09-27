interface SyntheticCommandOptions {
    agent?: 'code' | 'reasoning' | 'context' | 'auto';
    maxTokens?: number;
    temperature?: number;
    output?: 'chat' | 'file';
    filename?: string;
}
export declare class SyntheticCommand {
    private gateway;
    private isInitialized;
    private initialize;
    execute(prompt: string, options?: SyntheticCommandOptions): Promise<string>;
    getStatus(): Promise<string>;
    getHelp(): Promise<string>;
    private writeToFile;
}
export declare const syntheticCommand: SyntheticCommand;
export {};
//# sourceMappingURL=synthetic-command.d.ts.map