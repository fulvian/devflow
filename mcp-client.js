#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['mcp-servers/synthetic/dist/dual-enhanced-index.js'],
  });

  const client = new Client({
    name: 'mcp-client',
    version: '1.0.0',
  });

  try {
    await client.connect(transport);
    console.log('Connected to MCP server');

    const result = await client.callTool({
      name: 'synthetic_reasoning',
      arguments: {
        task_id: 'query-hub-plan-status-3',
        problem: "Search your multi-layer memory system (Cometa) for the 'multi-platform hub creation plan'. Provide a summary of the progress, including completed tasks, ongoing tasks, and any blockers.",
        context: '',
        approach: 'systematic',
      },
    }, undefined, { timeout: 120000 });

    console.log('Query result:', result);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

main();