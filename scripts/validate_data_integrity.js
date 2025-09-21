#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function validateDatabase(dbPath, name) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                resolve({ name, error: err.message, valid: false });
                return;
            }

            console.log(`\n📊 Validating ${name}: ${dbPath}`);

            // Check integrity
            db.get("PRAGMA integrity_check", (err, row) => {
                if (err) {
                    db.close();
                    resolve({ name, error: err.message, valid: false });
                    return;
                }

                const integrity = row.integrity_check === 'ok';
                console.log(`   Integrity: ${integrity ? '✅ OK' : '❌ FAILED'}`);

                // Get table counts
                db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
                    if (err) {
                        db.close();
                        resolve({ name, integrity, error: err.message, valid: false });
                        return;
                    }

                    const tablePromises = tables.map(table => {
                        return new Promise((resolve) => {
                            db.get(`SELECT COUNT(*) as count FROM ${table.name}`, (err, row) => {
                                if (err) {
                                    resolve({ table: table.name, count: 'ERROR', error: err.message });
                                } else {
                                    resolve({ table: table.name, count: row.count });
                                }
                            });
                        });
                    });

                    Promise.all(tablePromises).then(tableCounts => {
                        tableCounts.forEach(tc => {
                            console.log(`   ${tc.table}: ${tc.count} ${tc.error ? '(ERROR: ' + tc.error + ')' : 'records'}`);
                        });

                        db.close();
                        resolve({
                            name,
                            valid: integrity && tableCounts.every(tc => !tc.error),
                            integrity,
                            tables: tableCounts
                        });
                    });
                });
            });
        });
    });
}

async function main() {
    console.log('🧪 Data Integrity Validation Pre-Migration');

    const databases = [
        { path: './devflow.sqlite', name: 'Main Database' },
        { path: './data/devflow.sqlite', name: 'Data Database' },
        { path: './data/vector.sqlite', name: 'Vector Database' }
    ];

    const results = [];

    for (const db of databases) {
        try {
            const result = await validateDatabase(db.path, db.name);
            results.push(result);
        } catch (error) {
            results.push({ name: db.name, error: error.message, valid: false });
        }
    }

    console.log('\n📋 Validation Summary:');
    results.forEach(result => {
        console.log(`${result.name}: ${result.valid ? '✅ VALID' : '❌ INVALID'}`);
        if (result.error) console.log(`   Error: ${result.error}`);
    });

    const allValid = results.every(r => r.valid);
    console.log(`\n🎯 Overall Status: ${allValid ? '✅ ALL DATABASES VALID' : '❌ VALIDATION ISSUES FOUND'}`);

    return allValid;
}

if (require.main === module) {
    main().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Validation failed:', error);
        process.exit(1);
    });
}

module.exports = { validateDatabase, main };