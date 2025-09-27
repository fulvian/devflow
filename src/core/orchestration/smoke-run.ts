import RealDreamTeamOrchestrator from './real-dream-team-orchestrator';

async function main() {
  const input = process.argv.slice(2).join(' ') || 'smoke test';
  const orchestrator = new RealDreamTeamOrchestrator();

  const startedAt = Date.now();
  try {
    const results = await orchestrator.executeDreamTeam(input);
    const duration = Date.now() - startedAt;

    const summary = results.map(r => ({
      model: r.model,
      success: r.success,
      ms: r.executionTime,
      outputPreview: (r.output || '').toString().slice(0, 120)
    }));

    console.log('Orchestrator Smoke Summary');
    console.log('='.repeat(60));
    summary.forEach(s => {
      console.log(`${s.model.padEnd(8)} | ${s.success ? 'OK ' : 'ERR'} | ${String(s.ms).padStart(5)} ms | ${s.outputPreview}`);
    });
    console.log('-'.repeat(60));
    console.log(`Total time: ${duration} ms`);

    const ok = results.some(r => r.success);
    process.exit(ok ? 0 : 1);
  } catch (err: any) {
    console.error('Smoke run failed:', err?.message || String(err));
    process.exit(1);
  } finally {
    await orchestrator.shutdown();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

