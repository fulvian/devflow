import { ContinuousVerificationLoop } from './continuous-verification-loop';
import { SyntheticVerificationOrchestrator } from './synthetic-verification-orchestrator';

async function runE2ETest() {
  console.log('🚀 End-to-End Verification Test...');

  try {
    const loop = new ContinuousVerificationLoop();
    const orchestrator = new SyntheticVerificationOrchestrator();
    console.log('✅ Components initialized');

    const mockEvent = {
      id: 'e2e-test-001',
      code: 'console.log("test");',
      metadata: { requirements: 'Test', services: ['test'], branch: 'test', updated: new Date().toISOString() }
    };

    const result = await orchestrator.processVerificationEvent(mockEvent);
    console.log('✅ Verification result:', { score: result.score, status: result.status, alerts: result.details.alerts?.length });

    await loop.start();
    await loop.stop();
    console.log('✅ Loop start/stop working');

    console.log('🎯 All E2E tests passed!');
    return true;
  } catch (error) {
    console.error('❌ E2E test failed:', error);
    return false;
  }
}

runE2ETest().then(success => {
  console.log(success ? '🚀 System working!' : '💥 System failed!');
  process.exit(success ? 0 : 1);
});