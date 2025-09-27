export interface AuthConfig {
  readonly apiKey?: string;
}

export function resolveApiKey(cfg?: AuthConfig): string {
  const key = cfg?.apiKey ?? process.env['OPEN_ROUTER_API_KEY'] ?? process.env['OPENROUTER_API_KEY'];
  if (!key) {
    throw new Error('OpenRouter API key not provided. Set OPEN_ROUTER_API_KEY.');
  }
  return key;
}

export function getAuthHeaders(cfg?: AuthConfig): Record<string, string> {
  const key = resolveApiKey(cfg);
  return {
    Authorization: `Bearer ${key}`,
  };
}
