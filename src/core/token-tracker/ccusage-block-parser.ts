/**
 * CcusageBlockParser - Parses ccusage CLI output to extract structured block data
 */

import { CcusageBlock, ModelType } from './types/ccusage-types';
import { spawn } from 'child_process';

export class CcusageBlockParser {
  /**
   * Get recent ccusage blocks from CLI
   * @param limit Number of blocks to retrieve
   * @returns Array of parsed ccusage blocks
   */
  async getRecentBlocks(limit: number = 20): Promise<CcusageBlock[]> {
    try {
      const rawData = await this.executeCcusageCommand(['blocks', '--limit', limit.toString()]);
      return this.parseBlocksOutput(rawData);
    } catch (error) {
      console.error('Error fetching ccusage blocks:', error);
      return [];
    }
  }

  /**
   * Get current session token count from ccusage
   * @returns Current total token count
   */
  async getCurrentTokenCount(): Promise<number> {
    try {
      const rawData = await this.executeCcusageCommand(['blocks', '--limit', '1']);
      const blocks = this.parseBlocksOutput(rawData);

      if (blocks.length > 0) {
        return blocks[0].totalTokens;
      }

      return 0;
    } catch (error) {
      console.error('Error fetching current token count:', error);
      return 0;
    }
  }

  /**
   * Execute ccusage command and return output
   * @param args Command arguments
   * @returns Command output as string
   */
  private async executeCcusageCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn('ccusage', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`ccusage command failed with code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to execute ccusage: ${error.message}`));
      });
    });
  }

  /**
   * Parse ccusage blocks output into structured data
   * @param rawOutput Raw ccusage output
   * @returns Array of parsed blocks
   */
  private parseBlocksOutput(rawOutput: string): CcusageBlock[] {
    const blocks: CcusageBlock[] = [];
    const lines = rawOutput.split('\n');

    let currentBlock: Partial<CcusageBlock> | null = null;
    let blockIndex = 0;

    for (const line of lines) {
      // Skip header and separator lines
      if (line.includes('Block Start') || line.includes('─') || line.trim() === '') {
        continue;
      }

      // Parse table rows
      const columns = this.parseTableRow(line);
      if (columns && columns.length >= 6) {
        const [blockStart, duration, models, tokens, percentage, cost] = columns;

        // Extract timestamp and duration
        const startTime = this.parseBlockStartTime(blockStart);
        const blockDuration = this.parseBlockDuration(duration);
        const blockModels = this.parseBlockModels(models);
        const totalTokens = this.parseTokenCount(tokens);

        if (startTime && totalTokens > 0) {
          const block: CcusageBlock = {
            id: `block_${blockIndex++}_${startTime}`,
            startTime,
            endTime: startTime + blockDuration,
            models: blockModels,
            totalTokens,
            duration: blockDuration,
            tokenEntries: [{
              model: blockModels[0] || 'unknown',
              inputTokens: Math.floor(totalTokens * 0.7), // Estimate 70% input
              outputTokens: Math.floor(totalTokens * 0.3), // Estimate 30% output
              timestamp: startTime
            }]
          };

          blocks.push(block);
        }
      }
    }

    return blocks;
  }

  /**
   * Parse table row from ccusage output
   * @param line Table row line
   * @returns Array of column values or null if not a valid row
   */
  private parseTableRow(line: string): string[] | null {
    // Remove ANSI color codes and split by │
    const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');
    const columns = cleanLine.split('│').map(col => col.trim()).filter(col => col.length > 0);

    if (columns.length >= 6) {
      return columns;
    }

    return null;
  }

  /**
   * Parse block start time from ccusage format
   * @param blockStart Block start string
   * @returns Unix timestamp or null
   */
  private parseBlockStartTime(blockStart: string): number | null {
    try {
      // Example: "2025-09-26, 8:33:00 a.m."
      const match = blockStart.match(/(\d{4}-\d{2}-\d{2}),?\s+(\d{1,2}):(\d{2}):(\d{2})\s*(a\.m\.|p\.m\.)/i);

      if (match) {
        const [, date, hour, minute, second, ampm] = match;
        let hour24 = parseInt(hour);

        if (ampm.toLowerCase().includes('p') && hour24 !== 12) {
          hour24 += 12;
        } else if (ampm.toLowerCase().includes('a') && hour24 === 12) {
          hour24 = 0;
        }

        const dateObj = new Date(`${date}T${hour24.toString().padStart(2, '0')}:${minute}:${second}`);
        return dateObj.getTime();
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse block duration
   * @param duration Duration string
   * @returns Duration in milliseconds
   */
  private parseBlockDuration(duration: string): number {
    try {
      // Example: "(1h 13m)" or "(45m)" or "(inactive)"
      if (duration.includes('inactive')) {
        return 0;
      }

      let totalMs = 0;

      // Extract hours
      const hourMatch = duration.match(/(\d+)h/);
      if (hourMatch) {
        totalMs += parseInt(hourMatch[1]) * 60 * 60 * 1000;
      }

      // Extract minutes
      const minuteMatch = duration.match(/(\d+)m/);
      if (minuteMatch) {
        totalMs += parseInt(minuteMatch[1]) * 60 * 1000;
      }

      return totalMs;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Parse models from ccusage format
   * @param models Models string
   * @returns Array of model types
   */
  private parseBlockModels(models: string): ModelType[] {
    const modelList: ModelType[] = [];
    const lines = models.split('\n').map(line => line.trim()).filter(line => line.startsWith('-'));

    for (const line of lines) {
      const modelName = line.replace('-', '').trim();
      if (modelName && modelName !== '') {
        modelList.push(modelName as ModelType);
      }
    }

    return modelList.length > 0 ? modelList : ['unknown'];
  }

  /**
   * Parse token count from ccusage format
   * @param tokens Token string
   * @returns Token count as number
   */
  private parseTokenCount(tokens: string): number {
    try {
      // Example: "8,325,2…" or "14,534,…"
      const cleanTokens = tokens.replace(/[,…\s]/g, '');
      const numericMatch = cleanTokens.match(/(\d+)/);

      if (numericMatch) {
        let baseNumber = parseInt(numericMatch[1]);

        // If truncated with "…", estimate full number based on position
        if (tokens.includes('…')) {
          // Estimate based on typical ccusage token ranges
          const digits = numericMatch[1].length;
          if (digits <= 3) {
            baseNumber *= 1000; // Likely thousands
          } else if (digits <= 6) {
            baseNumber *= 100; // Likely completion of number
          }
        }

        return baseNumber;
      }

      return 0;
    } catch (error) {
      return 0;
    }
  }
}