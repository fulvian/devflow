
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '..' , '..' , '..' , 'devflow.sqlite');
let db;

try {
    db = new Database(dbPath);
} catch (error) {
    console.error(`Failed to connect to database at ${dbPath}:`, error.message);
    process.exit(1);
}

const sessionId = process.argv[2];
const taskId = process.argv[3] || null;

if (!sessionId) {
    console.error('Error: Session ID is a required argument.');
    process.exit(1);
}

try {
    const stmt = db.prepare(`
        INSERT INTO coordination_sessions (id, task_id, platform, status, start_time, updated_at)
        VALUES (?, ?, 'claude_code', 'active', datetime('now', 'utc'), datetime('now', 'utc'))
        ON CONFLICT(id) DO UPDATE SET
            updated_at = datetime('now', 'utc'),
            status = 'active'
    `);
    
    const info = stmt.run(sessionId, taskId);
    
    if (info.changes > 0) {
        console.log(`✅ DevFlow DB: Session ${sessionId} registered/updated successfully.`);
    } else {
        console.log(`ℹ️ DevFlow DB: Session ${sessionId} already up to date.`);
    }
    
} catch (error) {
    console.error(`Error registering session in database:`, error.message);
    process.exit(1);
} finally {
    if (db) {
        db.close();
    }
}
