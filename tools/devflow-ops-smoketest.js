#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const DEVROOT = '/Users/fulvioventura/devflow';
const SERVER = path.join(DEVROOT, 'mcp-servers/devflow-ops/dist/index.js');

function frame(msg) {
  const body = Buffer.from(JSON.stringify(msg), 'utf8');
  return Buffer.concat([
    Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'utf8'),
    body
  ]);
}

function parseFrames(buffer) {
  const results = [];
  let off = 0;
  while (off < buffer.length) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;
    const header = buffer.slice(0, headerEnd).toString('utf8');
    const match = /Content-Length: (\d+)/i.exec(header);
    if (!match) break;
    const len = parseInt(match[1], 10);
    const start = headerEnd + 4;
    const end = start + len;
    if (buffer.length < end) break;
    const json = buffer.slice(start, end).toString('utf8');
    results.push(JSON.parse(json));
    buffer = buffer.slice(end);
    off = 0;
  }
  return { results, rest: buffer };
}

async function run() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [SERVER], {
      cwd: DEVROOT,
      env: { ...process.env, DEVFLOW_PROJECT_ROOT: DEVROOT },
      stdio: ['pipe', 'pipe', 'inherit']
    });

    let buf = Buffer.alloc(0);
    const send = (obj) => child.stdin.write(frame(obj));
    const req = (id, method, params) => ({ jsonrpc: '2.0', id, method, params });

    child.stdout.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const { results, rest } = parseFrames(buf);
      buf = rest;
      for (const msg of results) {
        console.log('<<', JSON.stringify(msg));
      }
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve(); else reject(new Error('exit ' + code));
    });

    // 1) initialize
    send(req(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoketest', version: '0.0.1' } }));
    // 2) tools/list
    send(req(2, 'tools/list', {}));
    // 3) fs_write
    send(req(3, 'tools/call', { name: 'fs_write', arguments: { filePath: 'src/prova/smoke.txt', content: 'hello from devflow-ops', createDirs: true, overwrite: true } }));
    // 4) fs_read
    send(req(4, 'tools/call', { name: 'fs_read', arguments: { filePath: 'src/prova/smoke.txt' } }));
    // 5) fs_delete
    send(req(5, 'tools/call', { name: 'fs_delete', arguments: { targetPath: 'src/prova/smoke.txt' } }));

    // finish after a short delay
    setTimeout(() => { try { child.kill('SIGKILL'); } catch {} resolve(); }, 1200);
  });
}

run().catch((e) => { console.error(e); process.exit(1); });

