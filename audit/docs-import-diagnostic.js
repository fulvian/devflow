// Documentation Import System Diagnostic
const fs = require('fs');
const path = require('path');

class DocsImportDiagnostic {
  async checkDocsImportSystem() {
    console.log('📚 DOCS IMPORT SYSTEM DIAGNOSTIC');
    console.log('=' * 50);
    
    // Check for docs directory
    const docsPaths = ['./docs', './documentation', './README.md', './CLAUDE.md'];
    
    console.log('Documentation sources:');
    let totalDocs = 0;
    
    docsPaths.forEach(docPath => {
      if (fs.existsSync(docPath)) {
        console.log(`  ✅ ${docPath}`);
        
        if (fs.statSync(docPath).isDirectory()) {
          try {
            const files = this.scanDirectory(docPath);
            console.log(`    Files found: ${files.length}`);
            totalDocs += files.length;
            
            // Show file types
            const extensions = {};
            files.forEach(file => {
              const ext = path.extname(file);
              extensions[ext] = (extensions[ext] || 0) + 1;
            });
            
            console.log(`    Types: ${Object.entries(extensions).map(([ext, count]) => `${ext}(${count})`).join(', ')}`);
          } catch (e) {
            console.log(`    ❌ Error scanning: ${e.message}`);
          }
        } else {
          totalDocs++;
        }
      } else {
        console.log(`  ❌ ${docPath}`);
      }
    });
    
    console.log(`\nTotal documentation files: ${totalDocs}`);
    
    // Check for import scripts
    console.log('\nImport mechanisms:');
    const importScripts = [
      './scripts/import-docs.js',
      './tools/docs-importer.js', 
      './packages/core/src/importers/docs-importer.js'
    ];
    
    let importMechanismExists = false;
    importScripts.forEach(script => {
      const exists = fs.existsSync(script);
      console.log(`  ${exists ? '✅' : '❌'} ${script}`);
      if (exists) importMechanismExists = true;
    });
    
    if (!importMechanismExists) {
      console.log('\n⚠️  No automatic docs import mechanism found');
      console.log('Recommendation: Create docs importer for semantic database');
    }
    
    // Check semantic database for docs
    await this.checkSemanticDocsStorage();
  }
  
  scanDirectory(dir, files = []) {
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.')) {
        this.scanDirectory(fullPath, files);
      } else if (stat.isFile() && (item.endsWith('.md') || item.endsWith('.txt') || item.endsWith('.rst'))) {
        files.push(fullPath);
      }
    });
    
    return files;
  }
  
  async checkSemanticDocsStorage() {
    console.log('\n🔍 Semantic database docs storage:');
    
    // Check if docs are in semantic index
    const semanticPaths = [
      './data/devflow_unified.sqlite',
      './data/vector.sqlite',
      './real-world-test/.devflow/memory/semantic-index.json'
    ];
    
    semanticPaths.forEach(dbPath => {
      if (fs.existsSync(dbPath)) {
        console.log(`  ✅ Found: ${dbPath}`);
        // In a real implementation, would query for docs-related entries
      } else {
        console.log(`  ❌ Missing: ${dbPath}`);
      }
    });
  }
}

if (require.main === module) {
  new DocsImportDiagnostic().checkDocsImportSystem();
}

module.exports = DocsImportDiagnostic;