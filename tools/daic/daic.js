#!/usr/bin/env node
/* Minimal CLI per DevFlow Orchestrator */
const https = require('https');
const http = require('http');

const ORCH = process.env.DEVFLOW_ORCH_URL || 'http://localhost:3005';
const TOKEN = process.env.DEVFLOW_DAIC_TOKEN || process.env.DEVFLOW_API_SECRET || 'devflow-orchestrator-token';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, ORCH);
    const lib = url.protocol === 'https:' ? https : http;
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = lib.request(url, {
      method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': String(data.length) } : {}),
      }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const [cmd, sub] = process.argv.slice(2);
  if (!cmd || cmd === 'help') {
    console.log('daic status | metrics | sessions [list|get <id>|create <name>] | tasks [list|create <title> [priority] [description]] | memory query <json> | code <prompt>');
    process.exit(0);
  }
  try {
    if (cmd === 'status') {
      const res = await request('GET', '/health');
      console.log(res);
    } else if (cmd === 'metrics') {
      const res = await request('GET', '/metrics');
      console.log(res);
    } else if (cmd === 'sessions') {
      const action = sub || 'list';
      if (action === 'list') {
        const res = await request('GET', '/api/sessions');
        console.log(res);
      } else if (action === 'get') {
        const id = process.argv[4];
        if (!id) throw new Error('sessions get <id>');
        const res = await request('GET', `/api/sessions/${id}`);
        console.log(res);
      } else if (action === 'create') {
        const name = process.argv.slice(4).join(' ');
        if (!name) throw new Error('sessions create <name>');
        const res = await request('POST', '/api/sessions', { name });
        console.log(res);
      } else {
        throw new Error('sessions [list|get <id>|create <name>]');
      }
    } else if (cmd === 'code') {
      const prompt = process.argv.slice(3).join(' ');
      if (!prompt) throw new Error('Prompt mancante');
      const res = await request('POST', '/api/synthetic/code', { prompt });
      console.log(res);
    } else if (cmd === 'tasks') {
      const action = sub || 'list';
      if (action === 'list') {
        const res = await request('GET', '/api/tasks');
        console.log(res);
      } else if (action === 'create') {
        const title = process.argv[4];
        const priority = process.argv[5] || 'medium';
        const description = process.argv.slice(6).join(' ') || undefined;
        if (!title) throw new Error('tasks create <title> [priority] [description]');
        const body = { title, priority };
        if (description) body.description = description;
        const res = await request('POST', '/api/tasks', body);
        console.log(res);
      } else {
        throw new Error('tasks [list|create <title> [priority] [description]]');
      }
    } else if (cmd === 'memory') {
      const action = sub;
      if (action !== 'query') throw new Error('memory query <json>');
      const payloadRaw = process.argv.slice(4).join(' ');
      if (!payloadRaw) throw new Error('memory query <json>');
      let payload;
      try { payload = JSON.parse(payloadRaw); } catch { throw new Error('JSON non valido'); }
      const res = await request('POST', '/api/memory/query', payload);
      console.log(res);
    } else {
      console.error('Comando non supportato');
      process.exit(1);
    }
  } catch (e) {
    console.error('Errore:', e.message || e);
    process.exit(1);
  }
}

main();
