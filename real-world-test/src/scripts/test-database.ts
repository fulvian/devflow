#!/usr/bin/env node

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { join } from 'path';

// Test database connection and basic operations
async function testDatabase(dbPath: string) {
  try {
    console.log('Testing database connection...');
    
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    console.log('Database connected successfully');
    
    // Test basic query
    const tables = await db.all(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
    console.log('Database tables:', tables.map(t => t.name));
    
    // Test inserting a sample task
    const result = await db.run(`
      INSERT INTO task_contexts (title, description, priority, status)
      VALUES (?, ?, ?, ?)
    `, ['Test Task', 'Sample task for testing', 'm-', 'planning']);
    
    console.log('Sample task inserted with ID:', result.lastID);
    
    // Verify the insertion
    const task = await db.get(`SELECT * FROM task_contexts WHERE title = ?`, 'Test Task');
    console.log('Retrieved task:', task);
    
    // Clean up
    await db.run(`DELETE FROM task_contexts WHERE title = ?`, 'Test Task');
    console.log('Test task cleaned up');
    
    await db.close();
    console.log('Database test completed successfully');
    
  } catch (error) {
    console.error('Database test failed:', error);
    process.exit(1);
  }
}

// Run test
const dbPath = process.env.DB_PATH || './devflow-test.db';
testDatabase(dbPath);