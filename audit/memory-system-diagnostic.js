// Cognitive Memory System Diagnostic
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

class MemorySystemDiagnostic {
  constructor() {
    this.dbPath = './data/devflow.sqlite';
    this.vectorDbPath = './data/vector.sqlite';
  }
  
  async checkMemorySystem() {
    console.log('🧠 COGNITIVE MEMORY SYSTEM DIAGNOSTIC');
    console.log('=' * 50);
    
    // Check database files
    console.log('Database files:');
    console.log(`  DevFlow DB: ${fs.existsSync(this.dbPath) ? '✅' : '❌'} (${this.dbPath})`);
    console.log(`  Vector DB: ${fs.existsSync(this.vectorDbPath) ? '✅' : '❌'} (${this.vectorDbPath})`);
    
    // Check memory-related directories
    const memoryDirs = [
      './sessions',
      './sessions/tasks', 
      './.claude/state',
      './data',
      './logs'
    ];
    
    console.log('\nMemory directories:');
    memoryDirs.forEach(dir => {
      console.log(`  ${dir}: ${fs.existsSync(dir) ? '✅' : '❌'}`);
    });
    
    // Check current task state
    const currentTaskPath = './.claude/state/current_task.json';
    console.log(`\nCurrent task file: ${fs.existsSync(currentTaskPath) ? '✅' : '❌'}`);
    
    if (fs.existsSync(currentTaskPath)) {
      try {
        const taskData = JSON.parse(fs.readFileSync(currentTaskPath, 'utf8'));
        console.log(`  Current task: ${taskData.task}`);
        console.log(`  Branch: ${taskData.branch}`);
        console.log(`  Updated: ${taskData.updated}`);
      } catch (e) {
        console.log(`  ❌ Error reading task file: ${e.message}`);
      }
    }
    
    // Check vector database if exists
    if (fs.existsSync(this.vectorDbPath)) {
      await this.checkVectorDatabase();
    }
    
    // Check for cc-sessions migration
    await this.checkCCSessionsMigration();
  }
  
  async checkVectorDatabase() {
    console.log('\n🔍 Vector Database Analysis:');
    
    return new Promise((resolve) => {
      const db = new sqlite3.Database(this.vectorDbPath, (err) => {
        if (err) {
          console.log(`❌ Vector DB connection failed: ${err.message}`);
          resolve();
          return;
        }
        
        db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
          if (err) {
            console.log(`❌ Vector DB table query failed: ${err.message}`);
          } else {
            console.log(`  Tables: ${rows.map(r => r.name).join(', ')}`);
            
            // Check for embeddings
            if (rows.some(r => r.name.includes('embedding'))) {
              db.get("SELECT COUNT(*) as count FROM memory_block_embeddings", [], (err, row) => {
                if (!err && row) {
                  console.log(`  Embeddings stored: ${row.count}`);
                }
                db.close();
                resolve();
              });
            } else {
              db.close();
              resolve();
            }
          }
        });
      });
    });
  }
  
  async checkCCSessionsMigration() {
    console.log('\n🔄 CC-Sessions Migration Status:');
    
    const ccSessionsPaths = [
      './sessions',
      './.claude/sessions',
      './cc-sessions'
    ];
    
    let foundCCSessions = false;
    ccSessionsPaths.forEach(sessionPath => {
      if (fs.existsSync(sessionPath)) {
        console.log(`  Found sessions at: ${sessionPath}`);
        foundCCSessions = true;
        
        // Count session files
        try {
          const files = fs.readdirSync(sessionPath);
          const sessionFiles = files.filter(f => f.endsWith('.md'));
          console.log(`  Session files: ${sessionFiles.length}`);
        } catch (e) {
          console.log(`  ❌ Error reading sessions: ${e.message}`);
        }
      }
    });
    
    if (!foundCCSessions) {
      console.log('  ❌ No CC-Sessions data found');
    }
    
    console.log(`  Migration status: ${foundCCSessions ? 'Data available' : 'No data to migrate'}`);
  }
}

if (require.main === module) {
  new MemorySystemDiagnostic().checkMemorySystem().catch(console.error);
}

module.exports = MemorySystemDiagnostic;