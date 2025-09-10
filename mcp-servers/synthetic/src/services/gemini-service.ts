// Direct import of GeminiService for synthetic MCP server
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GeminiService {
  async generateText(prompt: string): Promise<string> {
    try {
      // Use Gemini CLI directly in synthetic MCP server
      const geminiPath = process.env.GEMINI_CLI_PATH || '/opt/homebrew/bin/gemini';
      const { stdout } = await execAsync(`${geminiPath} --prompt "${prompt.replace(/"/g, '\\"')}"`);
      return stdout.trim();
    } catch (error) {
      console.error('Error generating text with Gemini:', error);
      throw error;
    }
  }

  async embedText(text: string): Promise<number[]> {
    try {
      // Simplified embedding for synthetic MCP server
      // Convert text to basic numeric representation
      const encoder = new TextEncoder();
      const bytes = encoder.encode(text);
      return Array.from(bytes.slice(0, 1536)).concat(new Array(Math.max(0, 1536 - bytes.length)).fill(0));
    } catch (error) {
      console.error('Error embedding text with Gemini:', error);
      throw error;
    }
  }
}

export const geminiServiceInstance = new GeminiService();
