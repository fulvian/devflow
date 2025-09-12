import { DevFlowDatabase, DatabaseUtils } from '../../core/database/devflow-database';
import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';

describe('Task Hierarchy Integration Tests', () => {
  let db: DevFlowDatabase;
  let testDbPath: string;

  beforeAll(async () => {
    // Create test database
    testDbPath = join(__dirname, '../../../test-devflow.db');
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    db = new DevFlowDatabase(testDbPath);
    
    // Wait for database initialization
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    if (db) {
      await db.close();
    }
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  it('should create and retrieve task hierarchy', async () => {
    // Create a coordination session first
    const sessionId = DatabaseUtils.generateId('session');
    await db.run(`
      INSERT INTO coordination_sessions (id, session_name, session_description)
      VALUES (?, ?, ?)
    `, [sessionId, 'Test Session', 'Integration test session']);

    // Create root task
    const rootTaskId = DatabaseUtils.generateId('task');
    await db.run(`
      INSERT INTO task_contexts (id, session_id, task_name, task_description, task_status)
      VALUES (?, ?, ?, ?, ?)
    `, [rootTaskId, sessionId, 'Root Task', 'Main integration test task', 'active']);

    // Create child tasks
    const child1Id = DatabaseUtils.generateId('task');
    const child2Id = DatabaseUtils.generateId('task');
    
    await db.run(`
      INSERT INTO task_contexts (id, session_id, task_name, task_description, task_status, parent_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [child1Id, sessionId, 'Child Task 1', 'First subtask', 'pending', rootTaskId]);
    
    await db.run(`
      INSERT INTO task_contexts (id, session_id, task_name, task_description, task_status, parent_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [child2Id, sessionId, 'Child Task 2', 'Second subtask', 'pending', rootTaskId]);

    // Verify hierarchy creation
    const tasks = await db.all(`
      SELECT * FROM task_contexts WHERE session_id = ?
    `, [sessionId]);
    
    expect(tasks).toHaveLength(3);
    expect(tasks.find(t => t.id === rootTaskId)).toBeDefined();
    expect(tasks.find(t => t.id === child1Id)).toBeDefined();
    expect(tasks.find(t => t.id === child2Id)).toBeDefined();

    // Verify parent-child relationships
    const childTasks = tasks.filter(t => t.parent_id === rootTaskId);
    expect(childTasks).toHaveLength(2);
  });

  it('should handle task status updates', async () => {
    // Create session and task
    const sessionId = DatabaseUtils.generateId('session');
    const taskId = DatabaseUtils.generateId('task');
    
    await db.run(`
      INSERT INTO coordination_sessions (id, session_name)
      VALUES (?, ?)
    `, [sessionId, 'Status Test Session']);

    await db.run(`
      INSERT INTO task_contexts (id, session_id, task_name, task_status)
      VALUES (?, ?, ?, ?)
    `, [taskId, sessionId, 'Status Test Task', 'pending']);

    // Update task status
    await db.run(`
      UPDATE task_contexts SET task_status = ? WHERE id = ?
    `, ['in-progress', taskId]);

    // Verify status update
    const task = await db.get(`
      SELECT task_status, updated_at FROM task_contexts WHERE id = ?
    `, [taskId]);
    
    expect(task.task_status).toBe('in-progress');
    expect(task.updated_at).toBeDefined();
  });

  it('should create memory block embeddings', async () => {
    // Create session and task
    const sessionId = DatabaseUtils.generateId('session');
    const taskId = DatabaseUtils.generateId('task');
    const embeddingId = DatabaseUtils.generateId('emb');
    
    await db.run(`
      INSERT INTO coordination_sessions (id, session_name)
      VALUES (?, ?)
    `, [sessionId, 'Embedding Test Session']);

    await db.run(`
      INSERT INTO task_contexts (id, session_id, task_name)
      VALUES (?, ?, ?)
    `, [taskId, sessionId, 'Embedding Test Task']);

    // Create embedding vector
    const vector = [0.1, 0.5, -0.2, 0.8, 0.3];
    const vectorBlob = DatabaseUtils.vectorToBlob(vector);
    
    await db.run(`
      INSERT INTO memory_block_embeddings (id, task_context_id, embedding_vector, embedding_metadata)
      VALUES (?, ?, ?, ?)
    `, [embeddingId, taskId, vectorBlob, JSON.stringify({ model: 'test', dimensions: 5 })]);

    // Verify embedding creation
    const embedding = await db.get(`
      SELECT * FROM memory_block_embeddings WHERE id = ?
    `, [embeddingId]);
    
    expect(embedding).toBeDefined();
    expect(embedding.task_context_id).toBe(taskId);
    
    // Verify vector conversion
    const retrievedVector = DatabaseUtils.blobToVector(embedding.embedding_vector);
    expect(retrievedVector).toHaveLength(5);
    expect(retrievedVector[0]).toBeCloseTo(0.1, 6);
    expect(retrievedVector[4]).toBeCloseTo(0.3, 6);
  });

  it('should perform database health check', async () => {
    const healthCheck = await db.healthCheck();
    
    expect(healthCheck.status).toBe('healthy');
    expect(healthCheck.details.tables.expected).toBe(7);
    expect(healthCheck.details.tables.found).toBe(7);
    expect(healthCheck.details.tableList).toContain('task_contexts');
    expect(healthCheck.details.tableList).toContain('memory_block_embeddings');
    expect(healthCheck.details.tableList).toContain('coordination_sessions');
  });

  it('should handle cascade deletions', async () => {
    // Create session, task, and embedding
    const sessionId = DatabaseUtils.generateId('session');
    const taskId = DatabaseUtils.generateId('task');
    const embeddingId = DatabaseUtils.generateId('emb');
    
    await db.run(`
      INSERT INTO coordination_sessions (id, session_name)
      VALUES (?, ?)
    `, [sessionId, 'Cascade Test Session']);

    await db.run(`
      INSERT INTO task_contexts (id, session_id, task_name)
      VALUES (?, ?, ?)
    `, [taskId, sessionId, 'Cascade Test Task']);

    const vector = [0.1, 0.2, 0.3];
    const vectorBlob = DatabaseUtils.vectorToBlob(vector);
    
    await db.run(`
      INSERT INTO memory_block_embeddings (id, task_context_id, embedding_vector)
      VALUES (?, ?, ?)
    `, [embeddingId, taskId, vectorBlob]);

    // Delete the task - should cascade delete the embedding
    await db.run(`
      DELETE FROM task_contexts WHERE id = ?
    `, [taskId]);

    // Verify embedding was deleted
    const embedding = await db.get(`
      SELECT * FROM memory_block_embeddings WHERE id = ?
    `, [embeddingId]);
    
    expect(embedding).toBeUndefined();
  });

  it('should measure task creation performance', async () => {
    const sessionId = DatabaseUtils.generateId('session');
    await db.run(`
      INSERT INTO coordination_sessions (id, session_name)
      VALUES (?, ?)
    `, [sessionId, 'Performance Test Session']);

    const numTasks = 100;
    const taskIds: string[] = [];
    
    const startTime = Date.now();
    
    // Create multiple tasks to measure performance
    for (let i = 0; i < numTasks; i++) {
      const taskId = DatabaseUtils.generateId('perf');
      taskIds.push(taskId);
      
      await db.run(`
        INSERT INTO task_contexts (id, session_id, task_name, task_description)
        VALUES (?, ?, ?, ?)
      `, [taskId, sessionId, `Performance Test Task ${i}`, `Task for performance testing #${i}`]);
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const avgTimePerTask = totalTime / numTasks;
    
    console.log(`Task creation performance:`);
    console.log(`- Created ${numTasks} tasks in ${totalTime}ms`);
    console.log(`- Average time per task: ${avgTimePerTask.toFixed(2)}ms`);
    
    // Verify tasks were created
    const createdTasks = await db.all(`
      SELECT COUNT(*) as count FROM task_contexts WHERE session_id = ?
    `, [sessionId]);
    
    expect(createdTasks[0].count).toBe(numTasks);
    
    // Performance should be under target (10ms per task)
    expect(avgTimePerTask).toBeLessThan(10);
  });
});