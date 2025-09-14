// DevFlow Service Status Diagnostic
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

class ServiceStatusChecker {
  async checkAllServices() {
    console.log('🔍 DEVFLOW SERVICE STATUS AUDIT');
    console.log('=' * 50);
    
    const services = [
      { name: 'Database Manager', pidFile: '.database.pid', path: 'packages/core/dist/services/database-manager.cjs' },
      { name: 'Model Registry', pidFile: '.registry.pid', path: 'packages/core/dist/services/model-registry-service.cjs' },
      { name: 'Vector Memory', pidFile: '.vector.pid', path: 'packages/core/dist/services/vector-memory-service.cjs' },
      { name: 'Token Optimizer', pidFile: '.optimizer.pid', path: 'packages/core/dist/services/token-optimizer-service.cjs' },
      { name: 'Synthetic MCP', pidFile: '.synthetic.pid', path: 'mcp-servers/synthetic/dist/dual-enhanced-index.js' },
      { name: 'Auto CCR Runner', pidFile: '.ccr.pid', path: 'tools/auto-ccr-runner.js' },
      { name: 'Enforcement Daemon', pidFile: '.enforcement.pid', path: 'dist/enforcement-daemon.js' }
    ];
    
    for (const service of services) {
      console.log(`\n📋 ${service.name}:`);
      
      // Check if file exists
      const fileExists = fs.existsSync(service.path);
      console.log(`  File exists: ${fileExists ? '✅' : '❌'} (${service.path})`);
      
      // Check PID file
      const pidExists = fs.existsSync(service.pidFile);
      console.log(`  PID file: ${pidExists ? '✅' : '❌'} (${service.pidFile})`);
      
      if (pidExists) {
        const pid = fs.readFileSync(service.pidFile, 'utf8').trim();
        console.log(`  PID: ${pid}`);
        
        if (pid === 'MCP_READY') {
          console.log(`  Status: MCP Server Ready`);
        } else {
          try {
            process.kill(pid, 0);
            console.log(`  Process: ✅ Running`);
          } catch (e) {
            console.log(`  Process: ❌ Not running`);
          }
        }
      }
    }
  }
}

if (require.main === module) {
  new ServiceStatusChecker().checkAllServices();
}

module.exports = ServiceStatusChecker;