/**
 * Smart Session Retry System - Integration Test
 * Testing DEVFLOW31-001 to DEVFLOW31-004 implementation
 */

import { ClaudeSessionTracker } from '../core/session/ClaudeSessionTracker';
import { AutoResumeManager } from '../core/session/AutoResumeManager';
import { DAICResumeCommand } from '../cli/DAICResumeCommand';

async function testSmartSessionRetrySystem(): Promise<void> {
  console.log('🧪 Testing Smart Session Retry System...\n');

  try {
    // Test 1: ClaudeSessionTracker initialization
    console.log('1️⃣ Testing ClaudeSessionTracker...');
    const sessionTracker = new ClaudeSessionTracker();
    await sessionTracker.initialize();
    
    const sessionId = await sessionTracker.startSession(1);
    console.log(`   ✅ Session started: ${sessionId}`);
    
    // Simulate message recording
    await sessionTracker.recordMessage(sessionId);
    console.log('   ✅ Message recorded');
    
    // Test limit message parsing
    const limitMessage = "You've reached the limit. 3h 25m remaining until reset.";
    await sessionTracker.recordLimitEvent(sessionId, limitMessage);
    console.log('   ✅ Limit event parsed and recorded');

    // Test 2: AutoResumeManager integration
    console.log('\n2️⃣ Testing AutoResumeManager...');
    const autoResume = new AutoResumeManager();
    autoResume.initialize();
    
    // Simulate session limit reached
    await autoResume.handleSessionLimitReached(sessionId);
    console.log('   ✅ Session limit handling triggered');

    // Test 3: DAIC Resume Command
    console.log('\n3️⃣ Testing DAIC Resume Command...');
    const resumeCommand = new DAICResumeCommand();
    console.log('   ✅ DAIC Resume Command initialized');
    
    // Test session listing
    console.log('   📋 Available sessions:');
    const sessions = await sessionTracker.getActiveSessions();
    sessions.forEach(s => console.log(`      - ${s.id} (${s.status})`));

    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run test if called directly
if (require.main === module) {
  testSmartSessionRetrySystem()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { testSmartSessionRetrySystem };