import * as dotenv from 'dotenv';
import { access } from 'fs/promises';
import path from 'path';

dotenv.config();

/**
 * GeminiAuthService
 *
 * Purpose: verify that a non-interactive OAuth (personal) setup exists for the
 * system Gemini CLI and provide actionable guidance when it does not.
 *
 * We do NOT fabricate tokens or write fake config. The real Gemini CLI handles
 * OAuth storage and token refresh. Our role is to detect readiness and fail fast
 * with clear instructions for completing the initial OAuth once.
 */
export class GeminiAuthService {
  private static instance: GeminiAuthService;

  private constructor() {}

  public static getInstance(): GeminiAuthService {
    if (!GeminiAuthService.instance) {
      GeminiAuthService.instance = new GeminiAuthService();
    }
    return GeminiAuthService.instance;
  }

  /**
   * Determine if OAuth personal credentials are present locally so Gemini CLI
   * can run non-interactively. Checks common locations:
   * - $GEMINI_CONFIG_DIR
   * - $XDG_CONFIG_HOME/gemini
   * - ~/.config/gemini
   * - ~/.gemini
   */
  private async hasPersonalOAuthConfigured(): Promise<boolean> {
    const env = process.env;
    const home = env.HOME || env.USERPROFILE || '';
    const dirs = [
      env.GEMINI_CONFIG_DIR,
      env.XDG_CONFIG_HOME ? path.join(env.XDG_CONFIG_HOME, 'gemini') : undefined,
      home ? path.join(home, '.config', 'gemini') : undefined,
      home ? path.join(home, '.gemini') : undefined,
    ].filter(Boolean) as string[];

    const candidates = [
      'oauth_creds.json',
      'auth.json',
      'settings.json',
      path.join('auth', 'tokens.json'),
    ];

    for (const dir of dirs) {
      for (const file of candidates) {
        try {
          await access(path.join(dir, file));
          return true;
        } catch {
          // continue
        }
      }
    }
    return false;
  }

  /**
   * Backwards-compatible entry point used by the MCP server.
   * Ensures that some valid auth path exists (OAuth personal, API key, or ADC).
   * If none exist, throw with guided steps to complete OAuth once.
   */
  public async refreshTokenIfNeeded(): Promise<void> {
    // If API key or ADC is set, we are fine (not strictly OAuth-personal).
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return;
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;

    // Otherwise require stored OAuth-personal tokens.
    if (await this.hasPersonalOAuthConfigured()) return;

    const help = [
      '[Gemini OAuth Setup Required] Non-interactive OAuth requires a prior login.',
      'Options to complete initial OAuth (one-time):',
      '  1) Local login then copy credentials:',
      '     - Run: gemini  (choose "Login with Google"), finish OAuth in browser',
      '     - Copy your ~/.gemini or ~/.config/gemini directory to this machine',
      '  2) SSH port forwarding (remote servers):',
      '     - Start gemini on the server and note the localhost callback port (e.g., 42761)',
      '     - ssh -L 42761:localhost:42761 user@server  (complete OAuth in your local browser)',
      '  3) Debug URL method:',
      '     - Run: gemini --debug  and open the OAuth URL printed in logs',
      '',
      'After completing one of the above, rerun your command.',
    ].join('\n');

    throw new Error(help);
  }
}

export default GeminiAuthService;
