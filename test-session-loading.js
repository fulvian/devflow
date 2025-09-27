const ClaudeSessionTracker = require('./src/core/session/ClaudeSessionTracker').ClaudeSessionTracker;

async function testSessionLoading() {
  const tracker = new ClaudeSessionTracker();
  await tracker.initialize();
  console.log('Sessions loaded:', tracker.sessions.size);
  
  // Try to get active sessions
  const activeSessions = await tracker.getActiveSessions();
  console.log('Active sessions:', activeSessions);
}

testSessionLoading().catch(console.error);