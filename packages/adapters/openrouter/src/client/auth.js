export function resolveApiKey(cfg) {
    const key = cfg?.apiKey ?? process.env['OPEN_ROUTER_API_KEY'] ?? process.env['OPENROUTER_API_KEY'];
    if (!key) {
        throw new Error('OpenRouter API key not provided. Set OPEN_ROUTER_API_KEY.');
    }
    return key;
}
export function getAuthHeaders(cfg) {
    const key = resolveApiKey(cfg);
    return {
        Authorization: `Bearer ${key}`,
    };
}
//# sourceMappingURL=auth.js.map