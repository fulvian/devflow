import { GeminiAuthService } from './auth/gemini-auth-service.js';
import GeminiMCPServer from './mcp/gemini-mcp-server.js';

// Export the main components
export { GeminiAuthService, GeminiMCPServer };

// Default export
export default {
  GeminiAuthService,
  GeminiMCPServer,
};