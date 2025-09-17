#!/usr/bin/env node

import { GeminiMCPServer } from '../mcp/gemini-mcp-server.js';

/**
 * Script to start the Gemini MCP server
 */

async function main() {
  try {
    const server = new GeminiMCPServer();
    await server.run();
  } catch (error) {
    console.error('Failed to start Gemini MCP server:', error);
    process.exit(1);
  }
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main();
}