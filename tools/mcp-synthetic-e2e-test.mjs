#!/usr/bin/env node

// Minimal E2E test client for Synthetic MCP over stdio
// - Lists tools
// - Calls a non-network tool: synthetic_file_read on README.md

import { Client } from '../mcp-servers/synthetic/node_modules/@modelcontextprotocol/sdk/dist/client/index.js';
import { StdioClientTransport } from '../mcp-servers/synthetic/node_modules/@modelcontextprotocol/sdk/dist/client/stdio.js';

async function run() {
  // Wrap server start to redirect console.log to stderr to avoid corrupting MCP stdout
  const serverEntry = 'mcp-servers/synthetic/dist/dual-enhanced-index.js';
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['-e', `console.log=console.error; import('file://' + process.cwd() + '/${serverEntry}');`],
  });

  const client = new Client(
    { name: 'DevFlowE2EClient', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  try {
    await client.connect(transport);

    const tools = await client.request({ method: 'tools/list' });
    const toolNames = tools.tools.map((t) => t.name);
    console.log('[E2E] Tools available:', toolNames.join(', '));

    if (!toolNames.includes('synthetic_file_read')) {
      throw new Error('synthetic_file_read not available on server');
    }

    const result = await client.request({
      method: 'tools/call',
      params: {
        name: 'synthetic_file_read',
        arguments: { file_path: 'README.md' },
      },
    });

    const content = result?.content?.[0]?.text || '';
    console.log('[E2E] Read README.md bytes:', content.length);
    console.log('[E2E] Read preview:', content.slice(0, 120).replace(/\n/g, ' '));

    // Optional: try a network tool to confirm auth path (may fail under sandbox)
    if (toolNames.includes('synthetic_context')) {
      try {
        const netRes = await client.request({
          method: 'tools/call',
          params: {
            name: 'synthetic_context',
            arguments: {
              task_id: 'AUTH-TEST',
              content: 'Minimal ping for auth verification',
              analysis_type: 'summarize',
              focus: 'auth-test',
            },
          },
        });
        const out = netRes?.content?.[0]?.text || '';
        console.log('[E2E] Network tool result (truncated):', out.slice(0, 100));
      } catch (e) {
        console.log('[E2E] Network tool call failed (expected in sandbox):', e?.message || e);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('[E2E] Test failed:', err?.message || err);
    process.exit(1);
  }
}

run();
