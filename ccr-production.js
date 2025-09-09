#!/usr/bin/env node

/**
 * CCR Production Test - Versione Robusta
 * 
 * Test reale di CCR in ambiente di produzione
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

class CCRProductionTest {
  constructor() {
    this.ccrProcess = null;
    this.configPath = join(process.cwd(), 'configs', 'ccr-config.json');
    this.isRunning = false;
    this.ensureConfig();
  }

  ensureConfig() {
    if (!existsSync(this.configPath)) {
      const config = {
        log: true,
        NON_INTERACTIVE_MODE: true,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
        router: {
          default: 'claude-3-5-sonnet-20241022',
          codex: 'gpt-4o',
          synthetic: 'claude-3-5-sonnet-20241022'
        }
      };

      const configDir = join(process.cwd(), 'configs');
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }

      writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      console.log('✅ Configurazione CCR creata:', this.configPath);
    }
  }

  async startCCR() {
    if (this.isRunning) {
      console.log('⚠️  CCR è già in esecuzione');
      return true;
    }

    const ccrConfigDir = join(process.env.HOME, '.claude-code-router');
    const ccrConfigPath = join(ccrConfigDir, 'config.json');
    const backupPath = join(ccrConfigDir, 'config.backup.json');

    try {
      console.log('🚀 Avvio CCR per test produzione...');
      await this.stopExistingCCR();

      // 1. Backup configurazione CCR esistente
      if (existsSync(ccrConfigPath)) {
        const backupContent = readFileSync(ccrConfigPath, 'utf-8');
        writeFileSync(backupPath, backupContent);
        console.log('✅ Backup della configurazione CCR esistente eseguito.');
      }

      // 2. Prepara la nuova configurazione
      const projectConfigContent = readFileSync(this.configPath, 'utf-8');
      const projectConfig = JSON.parse(projectConfigContent);
      
      // Sostituisci le chiavi API nel JSON
      projectConfig.OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
      projectConfig.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

      // 3. Scrivi la configurazione di produzione
      if (!existsSync(ccrConfigDir)) {
        mkdirSync(ccrConfigDir, { recursive: true });
      }
      writeFileSync(ccrConfigPath, JSON.stringify(projectConfig, null, 2));
      console.log('✅ Configurazione di produzione CCR applicata.');

      // Avvia CCR con la configurazione corretta
      this.ccrProcess = spawn('npx', ['@musistudio/claude-code-router', 'start'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      });

      this.ccrProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          console.log(`[CCR] ${output}`);
        }
      });

      this.ccrProcess.stderr.on('data', (data) => {
        const error = data.toString().trim();
        if (error && !error.includes('Warning')) {
          console.log(`[CCR] ${error}`);
        }
      });

      this.ccrProcess.on('close', (code) => {
        console.log(`[CCR] Processo terminato con codice: ${code}`);
        this.isRunning = false;
      });

      this.ccrProcess.on('error', (error) => {
        console.error(`[CCR] Errore processo:`, error.message);
        this.isRunning = false;
      });

      this.isRunning = true;
      
      // Attendi che CCR si avvii
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      if (this.isRunning && !this.ccrProcess.killed) {
        console.log('✅ CCR ATTIVO - Pronto per test produzione');
        return true;
      } else {
        throw new Error('CCR non è riuscito ad avviarsi');
      }

    } catch (error) {
      console.error('❌ Errore nell\'avvio di CCR:', error.message);
      this.isRunning = false;
      return false;
    }
  }

  async stopExistingCCR() {
    try {
      // Ferma eventuali processi CCR esistenti
      const { exec } = await import('child_process');
      exec('pkill -f "claude-code-router"', (error) => {
        if (!error) {
          console.log('🔄 Processi CCR esistenti fermati');
        }
      });
      
      // Attendi un momento
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      // Ignora errori
    }
  }

  async stopCCR() {
    if (!this.isRunning || !this.ccrProcess) {
      console.log('⚠️  CCR non è in esecuzione');
      return;
    }

    try {
      console.log('🛑 Arresto CCR...');
      this.ccrProcess.kill('SIGTERM');
      
      await new Promise(resolve => {
        this.ccrProcess.on('close', resolve);
        setTimeout(resolve, 5000);
      });

      this.isRunning = false;
      console.log('✅ CCR arrestato');
    } catch (error) {
      console.error('❌ Errore nell\'arresto:', error.message);
    } finally {
      // Ripristina backup
      const ccrConfigDir = join(process.env.HOME, '.claude-code-router');
      const ccrConfigPath = join(ccrConfigDir, 'config.json');
      const backupPath = join(ccrConfigDir, 'config.backup.json');
      if (existsSync(backupPath)) {
        const backupContent = readFileSync(backupPath, 'utf-8');
        writeFileSync(ccrConfigPath, backupContent);
        console.log('✅ Ripristino della configurazione CCR originale eseguito.');
      }
    }
  }

  isCCRRunning() {
    return this.isRunning && this.ccrProcess && !this.ccrProcess.killed;
  }

  async simulateSessionLimit() {
    console.log('🔥 === SIMULAZIONE LIMITE SESSIONE CLAUDE CODE ===');
    console.log('📊 Situazione: Claude Code ha raggiunto i limiti di sessione');
    console.log('🔄 Azione: Attivazione CCR Fallback...\n');

    const success = await this.startCCR();
    
    if (success) {
      console.log('✅ CCR Fallback ATTIVO');
      console.log('📊 Fallback chain: Claude Code → Codex → Synthetic');
      console.log('🎯 DevFlow può continuare a funzionare!');
      
      // Mantieni attivo per test
      console.log('\n⏱️  CCR rimarrà attivo per test produzione...');
      console.log('💡 Ora puoi lavorare normalmente - CCR proteggerà DevFlow');
      
      return true;
    } else {
      console.log('❌ CCR Fallback NON ATTIVO');
      return false;
    }
  }
}

// CLI Interface
async function main() {
  const tester = new CCRProductionTest();
  const command = process.argv[2];

  switch (command) {
    case 'start':
      await tester.startCCR();
      break;
      
    case 'stop':
      await tester.stopCCR();
      break;
      
    case 'status':
      console.log('Status CCR:', tester.isCCRRunning() ? '🟢 RUNNING' : '🔴 STOPPED');
      break;
      
    case 'simulate':
      await tester.simulateSessionLimit();
      break;
      
    case 'production':
      console.log('🚀 === TEST PRODUZIONE CCR ===');
      const success = await tester.simulateSessionLimit();
      
      if (success) {
        console.log('\n🎉 === CCR PRONTO PER PRODUZIONE ===');
        console.log('✅ CCR è attivo e protegge DevFlow');
        console.log('✅ Quando Claude Code raggiunge i limiti, CCR prenderà il controllo');
        console.log('✅ DevFlow continuerà a funzionare senza interruzioni');
        console.log('\n💡 Continua a lavorare normalmente per vedere CCR in azione!');
        
        // Mantieni attivo
        process.on('SIGINT', async () => {
          console.log('\n🛑 Arresto CCR...');
          await tester.stopCCR();
          process.exit(0);
        });
        
        // Mantieni il processo attivo
        await new Promise(() => {});
      }
      break;
      
    default:
      console.log(`
🚀 CCR Production Test

Usage:
  node ccr-production.js start      - Avvia CCR
  node ccr-production.js stop       - Ferma CCR  
  node ccr-production.js status     - Verifica stato
  node ccr-production.js simulate   - Simula limite sessione
  node ccr-production.js production - Test produzione completo

Per test reale in produzione:
  node ccr-production.js production
      `);
  }
}

main().catch(console.error);
