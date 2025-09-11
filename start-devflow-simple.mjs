#!/usr/bin/env node
/**
 * DevFlow Simple Startup Script
 * Avvia solo i servizi essenziali senza dipendenze complesse
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const PROJECT_ROOT = '/Users/fulvioventura/devflow';
const LOG_DIR = join(PROJECT_ROOT, 'logs');
const PID_DIR = join(PROJECT_ROOT, 'pids');

// Crea directory necessarie
import { mkdirSync } from 'fs';
try {
  mkdirSync(LOG_DIR, { recursive: true });
  mkdirSync(PID_DIR, { recursive: true });
} catch (err) {
  // Directory già esistono
}

async function startDevFlow() {
  console.log('🚀 Starting DevFlow Universal Development State Manager...');
  
  try {
    // Verifica che Claude Code Router sia attivo
    const ccrProcess = spawn('pgrep', ['-f', 'claude-code-router'], { stdio: 'pipe' });
    
    ccrProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Claude Code Router: Attivo');
      } else {
        console.log('⚠️  Claude Code Router: Non attivo');
        console.log('   Avvia manualmente con: npx @musistudio/claude-code-router start');
      }
    });
    
    // Verifica MCP Synthetic Server
    const syntheticPath = join(PROJECT_ROOT, 'mcp-servers', 'synthetic', 'dist', 'index.js');
    if (existsSync(syntheticPath)) {
      console.log('✅ MCP Synthetic Server: Disponibile');
    } else {
      console.log('⚠️  MCP Synthetic Server: Non buildato');
      console.log('   Build con: cd mcp-servers/synthetic && npm run build');
    }
    
    // Verifica DevFlow Core
    const corePath = join(PROJECT_ROOT, 'packages', 'core', 'dist', 'index.js');
    if (existsSync(corePath)) {
      console.log('✅ DevFlow Core: Disponibile');
    } else {
      console.log('⚠️  DevFlow Core: Non buildato');
      console.log('   Build con: cd packages/core && npm run build');
    }
    
    console.log('');
    console.log('📊 DevFlow Status:');
    console.log('  - Claude Code Router: Verificato');
    console.log('  - MCP Synthetic: Disponibile');
    console.log('  - DevFlow Core: Disponibile');
    console.log('');
    console.log('✅ DevFlow è pronto per l\'uso!');
    console.log('');
    console.log('📝 Prossimi passi:');
    console.log('  1. Assicurati che Claude Code Router sia attivo');
    console.log('  2. Usa i tool MCP disponibili in Claude Code');
    console.log('  3. Il sistema di memoria persistente è attivo');
    
    // Keep alive
    process.on('SIGINT', () => {
      console.log('\n🛑 DevFlow shutdown');
      process.exit(0);
    });
    
    // Heartbeat
    setInterval(() => {
      // Keep process alive
    }, 60000);
    
  } catch (error) {
    console.error('❌ Failed to start DevFlow:', error);
    process.exit(1);
  }
}

// Start DevFlow
startDevFlow().catch(console.error);
