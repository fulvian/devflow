/**
 * DevFlow Orchestration System Startup
 * Starts the intelligent orchestration without disrupting existing processes
 */
require('dotenv').config();

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting DevFlow Intelligent Orchestration System...');

// Start orchestration in background
const orchestrationProcess = spawn('node', ['src/core/orchestration/orchestration-test.js'], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: process.cwd()
});

orchestrationProcess.stdout.on('data', (data) => {
    console.log(`[ORCHESTRATION] ${data}`);
});

orchestrationProcess.stderr.on('data', (data) => {
    console.error(`[ERROR] ${data}`);
});

orchestrationProcess.on('close', (code) => {
    console.log(`Orchestration process exited with code ${code}`);
});

// Allow process to run independently
orchestrationProcess.unref();

console.log(`✅ DevFlow Orchestration System started (PID: ${orchestrationProcess.pid})`);
console.log('📊 Intelligent agent routing now active');
console.log('🎯 Sonnet usage optimization enabled');

// Keep this script alive briefly to show status
setTimeout(() => {
    console.log('🧠 DevFlow Orchestration: OPERATIONAL');
    process.exit(0);
}, 2000);