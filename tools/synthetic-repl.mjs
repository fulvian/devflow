#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { SyntheticGateway } from '../packages/adapters/synthetic/dist/index.js';

const rl = readline.createInterface({ input, output });
const gateway = new SyntheticGateway();

console.log('Synthetic REPL ready. Commands:');
console.log("  /agent code|reasoning|context  -> switch agent");
console.log("  /exit                         -> quit\n");
let agent = 'code';

async function loop() {
  for (;;) {
    const line = await rl.question(`[${agent}] > `);
    const text = line.trim();
    if (!text) continue;
    if (text === '/exit') break;
    if (text.startsWith('/agent ')) {
      const a = text.split(' ')[1];
      if (['code','reasoning','context'].includes(a)) { agent = a; console.log(`Switched to ${agent}`); }
      else console.log('Unknown agent. Use: code|reasoning|context');
      continue;
    }
    try {
      const res = await gateway.processWithAgent(agent, {
        title: 'REPL task',
        description: text,
        messages: [{ role: 'user', content: text }],
        maxTokens: 800,
      });
      console.log(`\n--- ${res.agent} (${res.model}) ---\n`);
      console.log(res.text);
      console.log('\n');
    } catch (e) {
      console.error('Error:', e?.message || e);
    }
  }
  rl.close();
}

loop();
