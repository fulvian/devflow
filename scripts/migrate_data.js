#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DataMigrator {
    constructor() {
        this.mainDb = null;
        this.dataDb = null;
        this.vectorDb = null;
        this.targetDb = null;
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            try {
                console.log('🔌 Connecting to databases...');

                this.mainDb = new sqlite3.Database('./devflow.sqlite', sqlite3.OPEN_READONLY);
                this.dataDb = new sqlite3.Database('./data/devflow.sqlite', sqlite3.OPEN_READONLY);
                this.vectorDb = new sqlite3.Database('./data/vector.sqlite', sqlite3.OPEN_READONLY);
                this.targetDb = new sqlite3.Database('./data/devflow_unified.sqlite');

                // Enable foreign keys on target
                this.targetDb.run("PRAGMA foreign_keys = ON", (err) => {
                    if (err) reject(err);
                    else {
                        console.log('✅ All databases connected');
                        resolve();
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    async migrateProjects() {
        return new Promise((resolve, reject) => {
            console.log('📊 Migrating projects...');

            this.mainDb.all("SELECT * FROM projects", (err, rows) => {
                if (err) {
                    console.log('ℹ️ No projects table in main DB');
                    resolve(0);
                    return;
                }

                if (rows.length === 0) {
                    console.log('ℹ️ No projects to migrate');
                    resolve(0);
                    return;
                }

                const stmt = this.targetDb.prepare(`
                    INSERT OR REPLACE INTO projects (id, name, description, start_date, end_date, status, progress, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                let completed = 0;
                rows.forEach((row) => {
                    stmt.run([
                        row.id, row.name, row.description, row.start_date,
                        row.end_date, row.status || 'active', row.progress || 0,
                        row.created_at, row.updated_at
                    ], (err) => {
                        if (err) {
                            console.error('❌ Error migrating project:', err);
                        }
                        completed++;
                        if (completed === rows.length) {
                            stmt.finalize();
                            console.log(`✅ Migrated ${rows.length} projects`);
                            resolve(rows.length);
                        }
                    });
                });
            });
        });
    }

    async migratePlans() {
        return new Promise((resolve, reject) => {
            console.log('📋 Migrating plans...');

            this.mainDb.all("SELECT * FROM plans", (err, rows) => {
                if (err) {
                    console.log('ℹ️ No plans table in main DB');
                    resolve(0);
                    return;
                }

                if (rows.length === 0) {
                    console.log('ℹ️ No plans to migrate');
                    resolve(0);
                    return;
                }

                const stmt = this.targetDb.prepare(`
                    INSERT OR REPLACE INTO plans (id, project_id, name, phase, description, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);

                let completed = 0;
                rows.forEach((row) => {
                    stmt.run([
                        row.id, row.project_id, row.name, row.phase || 'planning',
                        row.description, row.created_at, row.updated_at
                    ], (err) => {
                        if (err) {
                            console.error('❌ Error migrating plan:', err);
                        }
                        completed++;
                        if (completed === rows.length) {
                            stmt.finalize();
                            console.log(`✅ Migrated ${rows.length} plans`);
                            resolve(rows.length);
                        }
                    });
                });
            });
        });
    }

    async migrateTaskContexts() {
        return new Promise((resolve, reject) => {
            console.log('📝 Migrating task contexts from main DB...');

            this.mainDb.all("SELECT * FROM task_contexts", (err, rows) => {
                if (err) {
                    console.log('ℹ️ No task_contexts table in main DB');
                    resolve(0);
                    return;
                }

                if (rows.length === 0) {
                    console.log('ℹ️ No task contexts to migrate from main DB');
                    resolve(0);
                    return;
                }

                const stmt = this.targetDb.prepare(`
                    INSERT OR REPLACE INTO task_contexts (
                        id, title, description, status, tags, created_at, updated_at,
                        completed_at, metadata, parent_id, roadmap_id, file_path, content_hash
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                let completed = 0;
                rows.forEach((row) => {
                    stmt.run([
                        row.id, row.title, row.description, row.status || 'pending', row.tags,
                        row.created_at, row.updated_at, row.completed_at, row.metadata,
                        row.parent_id, row.roadmap_id, row.file_path, row.content_hash
                    ], (err) => {
                        if (err) {
                            console.error('❌ Error migrating task context:', err);
                        }
                        completed++;
                        if (completed === rows.length) {
                            stmt.finalize();
                            console.log(`✅ Migrated ${rows.length} task contexts from main DB`);
                            resolve(rows.length);
                        }
                    });
                });
            });
        });
    }

    async migrateTaskContextsFromData() {
        return new Promise((resolve, reject) => {
            console.log('📝 Migrating task contexts from data DB...');

            this.dataDb.all("SELECT * FROM task_contexts", (err, rows) => {
                if (err) {
                    console.log('ℹ️ No task_contexts table in data DB');
                    resolve(0);
                    return;
                }

                if (rows.length === 0) {
                    console.log('ℹ️ No task contexts to migrate from data DB');
                    resolve(0);
                    return;
                }

                const stmt = this.targetDb.prepare(`
                    INSERT OR IGNORE INTO task_contexts (
                        id, title, description, status, tags, created_at, updated_at,
                        completed_at, metadata, parent_id, roadmap_id, file_path, content_hash
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                let completed = 0;
                rows.forEach((row) => {
                    stmt.run([
                        row.id, row.title, row.description, row.status || 'pending', row.tags,
                        row.created_at, row.updated_at, row.completed_at, row.metadata,
                        row.parent_id, row.roadmap_id, row.file_path, row.content_hash
                    ], (err) => {
                        if (err) {
                            console.error('❌ Error migrating task context from data DB:', err);
                        }
                        completed++;
                        if (completed === rows.length) {
                            stmt.finalize();
                            console.log(`✅ Migrated ${rows.length} task contexts from data DB`);
                            resolve(rows.length);
                        }
                    });
                });
            });
        });
    }

    async migrateEmbeddings() {
        return new Promise((resolve, reject) => {
            console.log('🧠 Migrating embeddings from main DB...');

            this.mainDb.all("SELECT * FROM memory_block_embeddings", (err, rows) => {
                if (err) {
                    console.log('ℹ️ No memory_block_embeddings table in main DB');
                    resolve(0);
                    return;
                }

                if (rows.length === 0) {
                    console.log('ℹ️ No embeddings to migrate from main DB');
                    resolve(0);
                    return;
                }

                const stmt = this.targetDb.prepare(`
                    INSERT OR REPLACE INTO memory_block_embeddings (block_id, embedding, model, dimensions, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);

                let completed = 0;
                rows.forEach((row) => {
                    stmt.run([
                        row.block_id, row.embedding, row.model || 'synthetic-embeddings-v1',
                        row.dimensions || 1024, row.created_at, row.updated_at
                    ], (err) => {
                        if (err) {
                            console.error('❌ Error migrating embedding:', err);
                        }
                        completed++;
                        if (completed === rows.length) {
                            stmt.finalize();
                            console.log(`✅ Migrated ${rows.length} embeddings from main DB`);
                            resolve(rows.length);
                        }
                    });
                });
            });
        });
    }

    async migrateEmbeddingsFromData() {
        return new Promise((resolve, reject) => {
            console.log('🧠 Migrating embeddings from data DB...');

            this.dataDb.all("SELECT * FROM memory_block_embeddings", (err, rows) => {
                if (err) {
                    console.log('ℹ️ No memory_block_embeddings table in data DB');
                    resolve(0);
                    return;
                }

                if (rows.length === 0) {
                    console.log('ℹ️ No embeddings to migrate from data DB');
                    resolve(0);
                    return;
                }

                const stmt = this.targetDb.prepare(`
                    INSERT OR IGNORE INTO memory_block_embeddings (block_id, embedding, model, dimensions, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);

                let completed = 0;
                rows.forEach((row) => {
                    stmt.run([
                        row.block_id, row.embedding, row.model || 'synthetic-embeddings-v1',
                        row.dimensions || 1024, row.created_at, row.updated_at
                    ], (err) => {
                        if (err) {
                            console.error('❌ Error migrating embedding from data DB:', err);
                        }
                        completed++;
                        if (completed === rows.length) {
                            stmt.finalize();
                            console.log(`✅ Migrated ${rows.length} embeddings from data DB`);
                            resolve(rows.length);
                        }
                    });
                });
            });
        });
    }

    async migrateMemoryBlocks() {
        return new Promise((resolve, reject) => {
            console.log('💾 Migrating memory blocks...');

            this.dataDb.all("SELECT * FROM memory_blocks", (err, rows) => {
                if (err) {
                    console.log('ℹ️ No memory_blocks table in data DB');
                    resolve(0);
                    return;
                }

                if (rows.length === 0) {
                    console.log('ℹ️ No memory blocks to migrate');
                    resolve(0);
                    return;
                }

                const stmt = this.targetDb.prepare(`
                    INSERT OR REPLACE INTO memory_blocks (id, content, type, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                `);

                let completed = 0;
                rows.forEach((row) => {
                    stmt.run([
                        row.id, row.content, row.type || 'general',
                        row.created_at, row.updated_at
                    ], (err) => {
                        if (err) {
                            console.error('❌ Error migrating memory block:', err);
                        }
                        completed++;
                        if (completed === rows.length) {
                            stmt.finalize();
                            console.log(`✅ Migrated ${rows.length} memory blocks`);
                            resolve(rows.length);
                        }
                    });
                });
            });
        });
    }

    async migrateSessions() {
        return new Promise((resolve, reject) => {
            console.log('🔄 Migrating sessions...');

            this.dataDb.all("SELECT * FROM sessions", (err, rows) => {
                if (err) {
                    console.log('ℹ️ No sessions table in data DB');
                    resolve(0);
                    return;
                }

                if (rows.length === 0) {
                    console.log('ℹ️ No sessions to migrate');
                    resolve(0);
                    return;
                }

                const stmt = this.targetDb.prepare(`
                    INSERT OR REPLACE INTO sessions (id, context, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                `);

                let completed = 0;
                rows.forEach((row) => {
                    stmt.run([
                        row.id, row.context, row.status || 'active',
                        row.created_at, row.updated_at
                    ], (err) => {
                        if (err) {
                            console.error('❌ Error migrating session:', err);
                        }
                        completed++;
                        if (completed === rows.length) {
                            stmt.finalize();
                            console.log(`✅ Migrated ${rows.length} sessions`);
                            resolve(rows.length);
                        }
                    });
                });
            });
        });
    }

    async migrateVectorMemories() {
        return new Promise((resolve, reject) => {
            console.log('🔍 Migrating vector memories from vector DB...');

            this.vectorDb.all("SELECT * FROM vector_memories", (err, vectorRows) => {
                if (err) {
                    console.log('ℹ️ No vector_memories table in vector DB');
                    resolve(0);
                    return;
                }

                // Also get from data DB
                this.dataDb.all("SELECT * FROM vector_memories", (err, dataRows) => {
                    const allRows = [...(vectorRows || []), ...(dataRows || [])];

                    if (allRows.length === 0) {
                        console.log('ℹ️ No vector memories to migrate');
                        resolve(0);
                        return;
                    }

                    const stmt = this.targetDb.prepare(`
                        INSERT OR REPLACE INTO vector_memories (id, content, embedding, metadata, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `);

                    let completed = 0;
                    allRows.forEach((row) => {
                        stmt.run([
                            row.id, row.content, row.embedding, row.metadata,
                            row.created_at, row.updated_at
                        ], (err) => {
                            if (err) {
                                console.error('❌ Error migrating vector memory:', err);
                            }
                            completed++;
                            if (completed === allRows.length) {
                                stmt.finalize();
                                console.log(`✅ Migrated ${allRows.length} vector memories`);
                                resolve(allRows.length);
                            }
                        });
                    });
                });
            });
        });
    }

    async migrateRoadmaps() {
        return new Promise((resolve, reject) => {
            console.log('🗺️ Migrating roadmaps...');

            this.mainDb.all("SELECT * FROM roadmaps", (err, rows) => {
                if (err) {
                    console.log('ℹ️ No roadmaps table in main DB');
                    resolve(0);
                    return;
                }

                if (rows.length === 0) {
                    console.log('ℹ️ No roadmaps to migrate');
                    resolve(0);
                    return;
                }

                const stmt = this.targetDb.prepare(`
                    INSERT OR REPLACE INTO roadmaps (id, title, description, status, priority, created_at, updated_at, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `);

                let completed = 0;
                rows.forEach((row) => {
                    stmt.run([
                        row.id, row.title, row.description, row.status || 'active',
                        row.priority || 0, row.created_at, row.updated_at, row.metadata
                    ], (err) => {
                        if (err) {
                            console.error('❌ Error migrating roadmap:', err);
                        }
                        completed++;
                        if (completed === rows.length) {
                            stmt.finalize();
                            console.log(`✅ Migrated ${rows.length} roadmaps`);
                            resolve(rows.length);
                        }
                    });
                });
            });
        });
    }

    async migrateAdditionalTables() {
        return new Promise((resolve, reject) => {
            console.log('📋 Migrating additional tables...');

            // Migrate macrotasks
            this.mainDb.all("SELECT * FROM macrotasks", (err, rows) => {
                if (!err && rows && rows.length > 0) {
                    const stmt = this.targetDb.prepare(`
                        INSERT OR REPLACE INTO macrotasks (id, title, description, status, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `);

                    rows.forEach((row) => {
                        stmt.run([row.id, row.title, row.description, row.status, row.created_at, row.updated_at]);
                    });
                    stmt.finalize();
                    console.log(`✅ Migrated ${rows.length} macrotasks`);
                }

                // Migrate microtasks
                this.mainDb.all("SELECT * FROM microtasks", (err, rows) => {
                    if (!err && rows && rows.length > 0) {
                        const stmt = this.targetDb.prepare(`
                            INSERT OR REPLACE INTO microtasks (id, title, description, status, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?)
                        `);

                        rows.forEach((row) => {
                            stmt.run([row.id, row.title, row.description, row.status, row.created_at, row.updated_at]);
                        });
                        stmt.finalize();
                        console.log(`✅ Migrated ${rows.length} microtasks`);
                    }

                    resolve();
                });
            });
        });
    }

    async close() {
        return new Promise((resolve) => {
            if (this.mainDb) this.mainDb.close();
            if (this.dataDb) this.dataDb.close();
            if (this.vectorDb) this.vectorDb.close();
            if (this.targetDb) this.targetDb.close();
            console.log('🔌 All database connections closed');
            resolve();
        });
    }

    async runMigration() {
        try {
            console.log('🚀 Starting database migration...');

            await this.initialize();

            const results = {
                projects: await this.migrateProjects(),
                plans: await this.migratePlans(),
                roadmaps: await this.migrateRoadmaps(),
                taskContextsMain: await this.migrateTaskContexts(),
                taskContextsData: await this.migrateTaskContextsFromData(),
                embeddingsMain: await this.migrateEmbeddings(),
                embeddingsData: await this.migrateEmbeddingsFromData(),
                memoryBlocks: await this.migrateMemoryBlocks(),
                sessions: await this.migrateSessions(),
                vectorMemories: await this.migrateVectorMemories()
            };

            await this.migrateAdditionalTables();

            console.log('\n📊 Migration Summary:');
            Object.entries(results).forEach(([key, count]) => {
                console.log(`   ${key}: ${count} records`);
            });

            const totalRecords = Object.values(results).reduce((sum, count) => sum + count, 0);
            console.log(`\n✅ Migration completed successfully! Total: ${totalRecords} records migrated`);

            return true;
        } catch (error) {
            console.error('❌ Migration failed:', error);
            return false;
        } finally {
            await this.close();
        }
    }
}

if (require.main === module) {
    const migrator = new DataMigrator();
    migrator.runMigration().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = DataMigrator;