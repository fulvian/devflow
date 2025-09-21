
const Database = require('better-sqlite3');
const path = require('path');

let db;

try {
    const dbPath = path.resolve(__dirname, '..' , '..' , '..' , 'data/devflow_unified.sqlite');
    db = new Database(dbPath, { readonly: true });

    const stmt = db.prepare(`
        SELECT id, task_id, platform, status, start_time
        FROM coordination_sessions
        WHERE status = 'active'
        ORDER BY start_time DESC
        LIMIT 5
    `);
    
    const sessions = stmt.all();
    
    // Output in a simple format for the shell script to parse
    if (sessions.length > 0) {
        sessions.forEach(s => {
            console.log(`${s.id} (Task: ${s.task_id || 'N/A'}, Platform: ${s.platform})`);
        });
    } else {
        console.log("No active sessions found in the database.");
    }

} catch (error) {
    // console.error(`Error querying sessions from database:`, error.message);
    // Silently fail to not clutter the UI, the main app will handle the logic.
    console.log("Could not query the session database.");
} finally {
    if (db) {
        db.close();
    }
}
