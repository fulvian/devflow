import DreamTeamOrchestrator from './dream-team-orchestrator';

/**
 * Test the updated DreamTeamOrchestrator with real MCP integration
 */
async function testDreamTeamOrchestrator() {
  console.log('Testing Dream Team Orchestrator with real MCP integration...');
  
  const orchestrator = new DreamTeamOrchestrator();
  
  try {
    // Test a simple workflow
    const task = "Create a REST API endpoint for user authentication with JWT tokens";
    
    console.log(`Executing workflow for task: ${task}`);
    
    const results = await orchestrator.executeDreamTeamWorkflow(task);
    
    console.log('Workflow completed successfully!');
    console.log('Results:');
    
    for (const result of results) {
      console.log(`\n${result.metadata.role}:`);
      console.log(`Execution time: ${result.metadata.executionTime}ms`);
      console.log(`Content: ${result.content.substring(0, 200)}...`);
    }
  } catch (error) {
    console.error('Error executing Dream Team workflow:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testDreamTeamOrchestrator().catch(console.error);
}

export default testDreamTeamOrchestrator;