import readline from 'readline';
import RealDreamTeamOrchestrator from '../orchestration/real-dream-team-orchestrator';
import { PlatformStatusTracker } from './platform-status-tracker';

function clear() {
  process.stdout.write('\x1Bc');
}

function render(tracker: PlatformStatusTracker) {
  const statuses = tracker.getAllStatuses();
  console.log('DEVFLOW PLATFORM STATUS (Realtime)');
  console.log('='.repeat(60));
  console.log(['Platform'.padEnd(10), 'Active', 'Execs', 'Success%', 'Avg ms', 'Load%'].join(' | '));
  console.log('-'.repeat(60));
  for (const s of statuses) {
    const row = [
      s.name.padEnd(10),
      (s.active ? 'YES' : 'NO ').padEnd(5),
      String(s.executionCount).padEnd(5),
      s.successRate.toFixed(1).padEnd(7),
      s.averageResponseTime.toFixed(0).padEnd(6),
      String(s.currentLoad).padEnd(5)
    ].join(' | ');
    console.log(row);
  }
  const health = tracker.getOverallSystemHealth();
  console.log('-'.repeat(60));
  console.log(`Health: ${health.healthy ? 'OK' : 'DEGRADED'} - ${health.message}`);
  console.log('Press Ctrl+C to exit');
}

async function main() {
  const orchestrator = new RealDreamTeamOrchestrator();
  const tracker = orchestrator.getStatusTracker();

  const repaint = () => { clear(); render(tracker); };
  tracker.on('statusUpdate', repaint as any);
  tracker.on('periodicUpdate', repaint as any);
  orchestrator.on('modelExecutionComplete', repaint as any);
  orchestrator.on('modelExecutionFailed', repaint as any);

  // Initial render
  repaint();

  // Demo loop: execute the dream team on a sample input every ~10s (optional)
  let running = true;
  const loop = async () => {
    while (running) {
      try {
        await orchestrator.executeDreamTeam('status ping');
      } catch (_) {
        // ignore
      }
      await new Promise(r => setTimeout(r, 10000));
    }
  };
  loop().catch(() => {});

  // Graceful exit
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const exit = async () => { running = false; rl.close(); await orchestrator.shutdown(); process.exit(0); };
  process.on('SIGINT', exit);
  process.on('SIGTERM', exit);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Terminal UI failed:', err);
    process.exit(1);
  });
}
