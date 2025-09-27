// DevFlow Parallel Audit Runner
const ServiceStatusChecker = require('./service-status-check');
const DatabaseDiagnostic = require('./database-diagnostic');
const EmbeddingDiagnostic = require('./embedding-diagnostic');
const MemorySystemDiagnostic = require('./memory-system-diagnostic');
const DocsImportDiagnostic = require('./docs-import-diagnostic');

class ParallelAuditRunner {
  async runAllAudits() {
    console.log('🚀 DEVFLOW COMPREHENSIVE SYSTEM AUDIT');
    console.log('🔄 Running all diagnostics in parallel...');
    console.log('=' * 80);
    
    const startTime = Date.now();
    
    try {
      // Run all audits in parallel
      const results = await Promise.allSettled([
        new ServiceStatusChecker().checkAllServices(),
        new DatabaseDiagnostic().runDiagnostic(), 
        new EmbeddingDiagnostic().checkEmbeddingGemma(),
        new MemorySystemDiagnostic().checkMemorySystem(),
        new DocsImportDiagnostic().checkDocsImportSystem()
      ]);
      
      console.log('\n' + '=' * 80);
      console.log('📊 AUDIT SUMMARY');
      console.log('=' * 80);
      
      const auditNames = [
        'Service Status Check',
        'Database Diagnostic', 
        'Embedding System Check',
        'Memory System Diagnostic',
        'Docs Import Diagnostic'
      ];
      
      results.forEach((result, index) => {
        const status = result.status === 'fulfilled' ? '✅ COMPLETED' : '❌ FAILED';
        console.log(`${auditNames[index]}: ${status}`);
        
        if (result.status === 'rejected') {
          console.log(`  Error: ${result.reason.message || result.reason}`);
        }
      });
      
      const totalTime = Date.now() - startTime;
      console.log(`\nTotal audit time: ${totalTime}ms`);
      
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      console.log(`Success rate: ${successCount}/${results.length} (${(successCount/results.length*100).toFixed(1)}%)`);
      
      console.log('\n🎯 RECOMMENDATIONS:');
      if (successCount === results.length) {
        console.log('✅ All systems operational - DevFlow ready for production');
      } else {
        console.log('⚠️  Some systems need attention - review failed audits above');
      }
      
    } catch (error) {
      console.error('💥 Critical audit failure:', error.message);
    }
  }
}

if (require.main === module) {
  new ParallelAuditRunner().runAllAudits();
}

module.exports = ParallelAuditRunner;