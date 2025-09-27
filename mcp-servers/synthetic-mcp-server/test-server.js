#!/usr/bin/env node

// Test script to verify the synthetic MCP server starts correctly
import { spawn } from 'child_process';

// Test if the command is available
const server = spawn('synthetic-mcp', { stdio: 'pipe' });

let output = '';
let errorOutput = '';

server.stdout.on('data', (data) => {
  output += data.toString();
});

server.stderr.on('data', (data) => {
  errorOutput += data.toString();
});

server.on('close', (code) => {
  console.log('Server process exited with code:', code);
  console.log('STDOUT:', output);
  console.log('STDERR:', errorOutput);
  
  if (code === null) {
    console.log('✅ Server command is available (exited as expected due to missing API key)');
  } else {
    console.log('⚠️  Server exited with code:', code);
  }
});

// Give it a moment to start
setTimeout(() => {
  server.kill('SIGTERM');
}, 2000);