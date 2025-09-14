// DevFlow Database Diagnostic
const sqlite3 = require('sqlite3');
const fs = require('fs');

class DatabaseDiagnostic {
  constructor() {
    this.dbPath = './data/devflow.sqlite';
  }
  
  async runDiagnostic() {
    console.log('🗄️  DEVFLOW DATABASE DIAGNOSTIC');
    console.log('=' * 50);
    
    // Check if database file exists
    console.log(`Database path: ${this.dbPath}`);
    console.log(`Database exists: ${fs.existsSync(this.dbPath) ? '✅' : '❌'}`);
    
    if (!fs.existsSync(this.dbPath)) {
      console.log('❌ Database file not found');
      return;
    }
    
    // Get file size
    const stats = fs.statSync(this.dbPath);
    console.log(`Database size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.log(`❌ Connection failed: ${err.message}`);
          reject(err);
          return;
        }
        
        console.log('✅ Database connection successful');
        
        // Check tables
        db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
          if (err) {
            console.log(`❌ Table query failed: ${err.message}`);
            reject(err);
            return;
          }
          
          console.log(`\n📊 Tables found: ${rows.length}`);
          rows.forEach(row => console.log(`  - ${row.name}`));
          
          // Check specific tables
          const importantTables = ['task_contexts', 'memory_blocks', 'coordination_sessions'];
          let checks = 0;
          
          importantTables.forEach(table => {
            db.get(`SELECT COUNT(*) as count FROM ${table}`, [], (err, row) => {
              if (err) {
                console.log(`  ❌ ${table}: Error - ${err.message}`);
              } else {
                console.log(`  ✅ ${table}: ${row.count} records`);
              }
              
              checks++;
              if (checks === importantTables.length) {
                db.close();
                resolve();
              }
            });
          });
        });
      });
    });
  }
}

if (require.main === module) {
  new DatabaseDiagnostic().runDiagnostic().catch(console.error);
}

module.exports = DatabaseDiagnostic;