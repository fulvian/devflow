#!/usr/bin/env node
// DevFlow Codex CLI wrapper
// Sends input to local Codex MCP server and prints the response.

import http from 'http';

function usage() {
  console.error('Usage: devflow-codex <input string>');
  process.exit(2);
}

const input = process.argv.slice(2).join(' ').trim();
if (!input) usage();

const host = process.env.CODEX_MCP_HOST || '127.0.0.1';
const port = parseInt(process.env.CODEX_MCP_PORT || '3101', 10);

const payload = JSON.stringify({
  id: `${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
  method: 'model.message',
  params: { content: input, model: 'codex' }
});

const req = http.request(
  { host, port, path: '/mcp', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
  (res) => {
    let data = '';
    res.setEncoding('utf8');
    res.on('data', chunk => (data += chunk));
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (json.error) {
          console.error(`[codex-mcp error] ${json.error.message}`);
          process.exit(1);
        }
        const content = json.result?.content ?? '';
        process.stdout.write(String(content).trim() + '\n');
      } catch (e) {
        console.error('Failed to parse MCP response:', e.message);
        process.exit(1);
      }
    });
  }
);

req.on('error', (err) => {
  console.error(`Connection error to Codex MCP at ${host}:${port}:`, err.message);
  process.exit(1);
});

req.write(payload);
req.end();

