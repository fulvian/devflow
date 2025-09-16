#!/usr/bin/env node

const { spawn } = require('child_process');

// Import dinamico di chalk
let chalk;
try {
  chalk = require('chalk');
} catch (error) {
  // Se chalk non è disponibile, usa una funzione stub
  chalk = (str) => str;
  chalk.blue = (str) => str;
  chalk.green = (str) => str;
  chalk.red = (str) => str;
  chalk.yellow = (str) => str;
  chalk.gray = (str) => str;
}

// Funzione per aggiungere colori
function enhanceOutput(output) {
  // Colora i vari elementi
  output = output
    .replace('📊 Claude Code Router Status', chalk.blue('📊 Claude Code Router Status'))
    .replace('✅ Status: Running', chalk.green('✅ Status: Running'))
    .replace('🆔 Process ID:', chalk.yellow('🆔 Process ID:'))
    .replace('🌐 Port:', chalk.yellow('🌐 Port:'))
    .replace('📡 API Endpoint:', chalk.yellow('📡 API Endpoint:'))
    .replace('📄 PID File:', chalk.yellow('📄 PID File:'))
    .replace('🚀 Ready to use!', chalk.green('🚀 Ready to use!'))
    .replace('# Start coding with Claude', chalk.gray('# Start coding with Claude'))
    .replace('# Stop the service', chalk.gray('# Stop the service'))
    .replace(/(════════════════════════════════════════)/g, chalk.blue('$1'))
    .replace(/(✅.*)/g, chalk.green('$1'))
    .replace(/(❌.*)/g, chalk.red('$1'))
    .replace(/(🚀.*)/g, chalk.blue('$1'))
    .replace(/(📊.*)/g, chalk.blue('$1'));
    
  return output;
}

// Esegui il comando ccr originale
const args = process.argv.slice(2);
const ccr = spawn('ccr', args);

ccr.stdout.on('data', (data) => {
  process.stdout.write(enhanceOutput(data.toString()));
});

ccr.stderr.on('data', (data) => {
  process.stderr.write(chalk.red(data.toString()));
});

ccr.on('close', (code) => {
  process.exit(code);
});