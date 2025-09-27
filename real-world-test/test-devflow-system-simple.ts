/**
 * Real-World Test for Cognitive Memory System
 * 
 * This test demonstrates the end-to-end functionality of the cognitive memory system
 * including task hierarchies, semantic memory operations, and memory bridge functionality.
 */

import { Database } from 'sqlite3';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Core system imports
import { TaskManager } from '../src/core/task/TaskManager';
import { SemanticMemory } from '../src/core/memory/SemanticMemory';
import { MemoryBridge } from '../src/core/bridge/MemoryBridge';
import { SyntheticAPI } from '../src/core/api/SyntheticAPI';
import { CognitiveEngine } from '../src/core/engine/CognitiveEngine';

// Database schema initialization
const DB_PATH = join(__dirname, 'test.db');
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES tasks(id)
  );
  
  CREATE TABLE IF NOT EXISTS semantic_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    concept TEXT NOT NULL UNIQUE,
    embedding BLOB,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS semantic_edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_node INTEGER NOT NULL,
    to_node INTEGER NOT NULL,
    relationship TEXT NOT NULL,
    weight REAL DEFAULT 1.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_node) REFERENCES semantic_nodes(id),
    FOREIGN KEY (to_node) REFERENCES semantic_nodes(id)
  );
  
  CREATE TABLE IF NOT EXISTS memory_bridge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_task_id INTEGER,
    target_memory_id INTEGER,
    bridge_type TEXT NOT NULL,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_task_id) REFERENCES tasks(id),
    FOREIGN KEY (target_memory_id) REFERENCES semantic_nodes(id)
  );
`;

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

class RealWorldCognitiveTest {
  private db: Database;
  private taskManager: TaskManager;
  private semanticMemory: SemanticMemory;
  private memoryBridge: MemoryBridge;
  private syntheticAPI: SyntheticAPI;
  private cognitiveEngine: CognitiveEngine;
  private results: TestResult[] = [];

  constructor() {
    // Ensure database directory exists
    const dbDir = join(__dirname, '..', '..', 'data');
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(DB_PATH);
    this.initializeDatabase();
    
    // Initialize core components
    this.taskManager = new TaskManager(this.db);
    this.semanticMemory = new SemanticMemory(this.db);
    this.memoryBridge = new MemoryBridge(this.db);
    this.syntheticAPI = new SyntheticAPI();
    this.cognitiveEngine = new CognitiveEngine(
      this.taskManager,
      this.semanticMemory,
      this.memoryBridge,
      this.syntheticAPI
    );
  }

  private initializeDatabase(): void {
    const exec = promisify(this.db.exec.bind(this.db));
    exec(SCHEMA_SQL)
      .then(() => console.log('Database schema initialized'))
      .catch(err => {
        console.error('Failed to initialize database:', err);
        process.exit(1);
      });
  }

  async runAllTests(): Promise<void> {
    console.log('Starting Real-World Cognitive Memory Test...\n');

    try {
      await this.testTaskHierarchy();
      await this.testSemanticMemory();
      await this.testMemoryBridge();
      await this.testSyntheticAPI();
      await this.testCognitiveCapabilities();
      
      this.printResults();
    } catch (error) {
      console.error('Test execution failed:', error);
    } finally {
      this.db.close();
    }
  }

  private async testTaskHierarchy(): Promise<void> {
    console.log('1. Testing Task Hierarchy...');
    
    try {
      // Create root task
      const rootTask = await this.taskManager.createTask({
        name: 'Project Alpha',
        description: 'Main project task'
      });
      
      // Create subtasks
      const designTask = await this.taskManager.createTask({
        name: 'Design Phase',
        description: 'Initial design work',
        parentId: rootTask.id
      });
      
      const implementationTask = await this.taskManager.createTask({
        name: 'Implementation',
        description: 'Coding and development',
        parentId: rootTask.id
      });
      
      // Verify hierarchy
      const children = await this.taskManager.getSubtasks(rootTask.id);
      const isValidHierarchy = children.length === 2 && 
        children.some(t => t.id === designTask.id) && 
        children.some(t => t.id === implementationTask.id);
      
      this.results.push({
        name: 'Task Hierarchy',
        passed: isValidHierarchy,
        details: `Created root task with ${children.length} subtasks`
      });
      
      console.log('   ✓ Task hierarchy test completed\n');
    } catch (error) {
      this.results.push({
        name: 'Task Hierarchy',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      console.log('   ✗ Task hierarchy test failed\n');
    }
  }

  private async testSemanticMemory(): Promise<void> {
    console.log('2. Testing Semantic Memory...');
    
    try {
      // Create semantic concepts
      const concept1 = await this.semanticMemory.createConcept('artificial intelligence');
      const concept2 = await this.semanticMemory.createConcept('machine learning');
      const concept3 = await this.semanticMemory.createConcept('neural networks');
      
      // Create relationships
      await this.semanticMemory.createRelationship(
        concept1.id, 
        concept2.id, 
        'subset', 
        0.8
      );
      
      await this.semanticMemory.createRelationship(
        concept2.id, 
        concept3.id, 
        'implementation', 
        0.9
      );
      
      // Test retrieval
      const related = await this.semanticMemory.getRelatedConcepts(concept1.id);
      const isValid = related.length === 1 && related[0].toConcept === 'machine learning';
      
      this.results.push({
        name: 'Semantic Memory',
        passed: isValid,
        details: `Created ${related.length} relationships between concepts`
      });
      
      console.log('   ✓ Semantic memory test completed\n');
    } catch (error) {
      this.results.push({
        name: 'Semantic Memory',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      console.log('   ✗ Semantic memory test failed\n');
    }
  }

  private async testMemoryBridge(): Promise<void> {
    console.log('3. Testing Memory Bridge...');
    
    try {
      // Create a task
      const task = await this.taskManager.createTask({
        name: 'Research Task',
        description: 'Study artificial intelligence concepts'
      });
      
      // Create semantic memory
      const concept = await this.semanticMemory.createConcept('research methodology');
      
      // Create bridge
      const bridge = await this.memoryBridge.createBridge({
        sourceTaskId: task.id,
        targetMemoryId: concept.id,
        bridgeType: 'related_to',
        metadata: JSON.stringify({ confidence: 0.75 })
      });
      
      // Verify bridge
      const bridges = await this.memoryBridge.getBridgesForTask(task.id);
      const isValid = bridges.length === 1 && bridges[0].id === bridge.id;
      
      this.results.push({
        name: 'Memory Bridge',
        passed: isValid,
        details: `Created bridge between task ${task.id} and concept ${concept.id}`
      });
      
      console.log('   ✓ Memory bridge test completed\n');
    } catch (error) {
      this.results.push({
        name: 'Memory Bridge',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      console.log('   ✗ Memory bridge test failed\n');
    }
  }

  private async testSyntheticAPI(): Promise<void> {
    console.log('4. Testing Synthetic API...');
    
    try {
      // Mock API response
      const mockResponse = {
        data: {
          insights: ['AI is transforming industries', 'Ethical considerations are important'],
          confidence: 0.85
        }
      };
      
      // Register mock handler
      this.syntheticAPI.registerHandler('analyze', async () => mockResponse);
      
      // Test API call
      const result = await this.syntheticAPI.call('analyze', { topic: 'AI ethics' });
      const isValid = result.data.confidence > 0.8;
      
      this.results.push({
        name: 'Synthetic API',
        passed: isValid,
        details: `API returned insights with ${result.data.confidence} confidence`
      });
      
      console.log('   ✓ Synthetic API test completed\n');
    } catch (error) {
      this.results.push({
        name: 'Synthetic API',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      console.log('   ✗ Synthetic API test failed\n');
    }
  }

  private async testCognitiveCapabilities(): Promise<void> {
    console.log('5. Testing Cognitive Capabilities...');
    
    try {
      // Create complex scenario
      const projectTask = await this.taskManager.createTask({
        name: 'AI Development Project',
        description: 'Develop an AI system for medical diagnosis'
      });
      
      const researchTask = await this.taskManager.createTask({
        name: 'Literature Review',
        description: 'Review current research in medical AI',
        parentId: projectTask.id
      });
      
      // Create semantic knowledge
      const aiConcept = await this.semanticMemory.createConcept('artificial intelligence');
      const medicalConcept = await this.semanticMemory.createConcept('medical diagnosis');
      const ethicsConcept = await this.semanticMemory.createConcept('AI ethics');
      
      await this.semanticMemory.createRelationship(
        aiConcept.id, 
        medicalConcept.id, 
        'application', 
        0.9
      );
      
      // Create bridges
      await this.memoryBridge.createBridge({
        sourceTaskId: researchTask.id,
        targetMemoryId: aiConcept.id,
        bridgeType: 'involves'
      });
      
      await this.memoryBridge.createBridge({
        sourceTaskId: researchTask.id,
        targetMemoryId: ethicsConcept.id,
        bridgeType: 'considers'
      });
      
      // Test cognitive processing
      const insights = await this.cognitiveEngine.processTask(projectTask.id);
      const hasInsights = insights.length > 0;
      
      this.results.push({
        name: 'Cognitive Capabilities',
        passed: hasInsights,
        details: `Generated ${insights.length} cognitive insights for task ${projectTask.id}`
      });
      
      console.log('   ✓ Cognitive capabilities test completed\n');
    } catch (error) {
      this.results.push({
        name: 'Cognitive Capabilities',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      console.log('   ✗ Cognitive capabilities test failed\n');
    }
  }

  private printResults(): void {
    console.log('\n=== TEST RESULTS ===');
    let passed = 0;
    
    for (const result of this.results) {
      const status = result.passed ? 'PASS' : 'FAIL';
      console.log(`${status}: ${result.name} - ${result.details}`);
      if (result.passed) passed++;
    }
    
    console.log(`\nSummary: ${passed}/${this.results.length} tests passed`);
    
    if (passed === this.results.length) {
      console.log('🎉 All tests passed! Cognitive memory system is functioning correctly.');
    } else {
      console.log('⚠️  Some tests failed. Please review the implementation.');
    }
  }
}

// Execute the test
const test = new RealWorldCognitiveTest();
test.runAllTests().catch(console.error);