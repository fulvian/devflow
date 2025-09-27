#!/usr/bin/env node

// Minimal raw stdio JSON-RPC test for Synthetic MCP
// Avoids SDK client to work around strict parsing and stdout logging issues

import { spawn } from 'node:child_process';

const serverEntry = 'mcp-servers/synthetic/dist/dual-enhanced-index.js';

function jrpc(id, method, params) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
}

async function run() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['-e', `console.log=console.error; import('file://' + process.cwd() + '/${serverEntry}')`], {
      stdio: ['pipe', 'pipe', 'inherit']
    });

    let buffer = '';
    const readLines = [];

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.trim().length) readLines.push(line);
      }
    });

    child.on('error', (e) => reject(e));
    child.on('exit', (code) => {
      if (code !== 0) reject(new Error('Server exited with code ' + code));
    });

    const send = (obj) => child.stdin.write(obj);

    // Send initialize
    setTimeout(() => {
      send(jrpc(1, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'DevFlowRawClient', version: '1.0.0' }
      }));
    }, 100);

    // Wait for initialize result, then list tools, then call synthetic_file_read
    const interval = setInterval(() => {
      while (readLines.length) {
        const line = readLines.shift();
        try {
          const msg = JSON.parse(line);
          if (msg.id === 1 && (msg.result || msg.error)) {
            // Now list tools
            send(jrpc(2, 'tools/list', {}));
          } else if (msg.id === 2 && msg.result) {
            const toolNames = (msg.result.tools || []).map(t => t.name);
            console.log('[RAW E2E] Tools:', toolNames.join(', '));
            if (!toolNames.includes('synthetic_file_read')) {
              clearInterval(interval); resolve(false); return;
            }
            // Call a non-network tool
            send(jrpc(3, 'tools/call', {
              name: 'synthetic_file_read',
              arguments: { file_path: 'README.md' }
            }));
          } else if (msg.id === 3) {
            const text = msg.result?.content?.[0]?.text || '';
            console.log('[RAW E2E] Read bytes:', text.length);
            console.log('[RAW E2E] Preview:', text.slice(0, 120).replace(/\n/g, ' '));
            clearInterval(interval);
            resolve(true);
          }
        } catch (e) {
          console.log('[RAW E2E] Parse error on line:', line);
          clearInterval(interval);
          reject(e);
        }
      }
    }, 50);
  });
}

run().then(() => process.exit(0)).catch(err => { console.log('[RAW E2E] Failed:', err?.message || err); process.exit(1); });
