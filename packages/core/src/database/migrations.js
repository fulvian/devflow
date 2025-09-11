import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
function tableExists(db, name) {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
    return Boolean(row && row.name);
}
export function runInitialSchema(db) {
    // Check if any core tables exist to determine if schema is already applied
    const coreTables = ['task_contexts', 'memory_blocks', 'coordination_sessions', 'schema_versions'];
    const existingTables = coreTables.filter(table => tableExists(db, table));
    // If we have most core tables, assume schema is applied
    if (existingTables.length >= 3) {
        console.log(`Schema already applied. Found tables: ${existingTables.join(', ')}`);
        return;
    }
    const schemaPath = resolve(__dirname, 'schema.sql');
    const sql = readFileSync(schemaPath, 'utf8');
    // Execute the entire schema without transactions for now
    // This avoids PRAGMA issues in transactions
    db.exec(sql);
}
export function ensureMigrations(db) {
    runInitialSchema(db);
}
//# sourceMappingURL=migrations.js.map