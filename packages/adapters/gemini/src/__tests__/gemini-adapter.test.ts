import { GeminiAuthService } from '../auth/gemini-auth-service';
import GeminiMCPServer from '../mcp/gemini-mcp-server';

describe('Gemini Adapter', () => {
  describe('GeminiAuthService', () => {
    let authService: GeminiAuthService;

    beforeEach(() => {
      authService = GeminiAuthService.getInstance();
    });

    it('should be able to get an instance', () => {
      expect(authService).toBeInstanceOf(GeminiAuthService);
    });

    it('should not have a valid access token initially', () => {
      expect(authService.hasValidAccessToken()).toBe(false);
    });

    it('should return null for access token when not valid', () => {
      expect(authService.getAccessToken()).toBeNull();
    });
  });

  describe('GeminiMCPServer', () => {
    it('should be able to create an instance', () => {
      const server = new GeminiMCPServer();
      expect(server).toBeInstanceOf(GeminiMCPServer);
    });
  });
});