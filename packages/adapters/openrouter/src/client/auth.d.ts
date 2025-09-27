export interface AuthConfig {
    readonly apiKey?: string;
}
export declare function resolveApiKey(cfg?: AuthConfig): string;
export declare function getAuthHeaders(cfg?: AuthConfig): Record<string, string>;
//# sourceMappingURL=auth.d.ts.map