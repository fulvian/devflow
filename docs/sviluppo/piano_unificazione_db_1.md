# Piano di Unificazione e Migrazione Database - v1.0

## Executive Summary

Questo documento delinea il piano completo per consolidare i tre database SQLite attualmente separati in un unico database unificato nella cartella `data/`, seguendo le best practice Context7 e ottimizzando le performance del sistema DevFlow.

### Database Attuali
- `./devflow.sqlite` (560KB) - Database principale con schema completo
- `./data/devflow.sqlite` (104KB) - Database secondario con memoria/sessioni
- `./data/vector.sqlite` (44KB) - Database vettoriale per semantic memory

### Obiettivo
Consolidare in: `./data/devflow_unified.sqlite` - Database unificato completo

---

## 1. Analisi dello Stato Attuale

### 1.1 Mapping Database Correnti

#### Database Principale: `./devflow.sqlite` (560KB)
```sql
-- Schema completo identificato:
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'active',
    progress INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    name TEXT NOT NULL,
    phase TEXT DEFAULT 'planning',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    plan_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (plan_id) REFERENCES plans(id)
);

CREATE TABLE task_contexts (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    status TEXT,
    tags TEXT,
    created_at TEXT,
    updated_at TEXT,
    completed_at TEXT,
    metadata TEXT,
    parent_id TEXT,
    roadmap_id TEXT,
    file_path TEXT,
    content_hash TEXT,
    FOREIGN KEY (parent_id) REFERENCES task_contexts(id),
    FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id)
);

CREATE TABLE roadmaps (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    priority INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT,
    metadata TEXT
);

CREATE TABLE knowledge_entities (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    metadata TEXT,
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE memory_block_embeddings (
    block_id TEXT PRIMARY KEY,
    embedding BLOB,
    model TEXT,
    dimensions INTEGER,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (block_id) REFERENCES task_contexts(id)
);
```

#### Database Secondario: `./data/devflow.sqlite` (104KB)
```sql
-- Schema ridotto:
CREATE TABLE memories (
    id TEXT PRIMARY KEY,
    content TEXT,
    type TEXT,
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    context TEXT,
    status TEXT,
    created_at TEXT,
    updated_at TEXT
);
```

#### Database Vettoriale: `./data/vector.sqlite` (44KB)
```sql
-- Schema vettoriale specializzato:
CREATE TABLE vector_memories (
    id TEXT PRIMARY KEY,
    content TEXT,
    embedding BLOB,
    metadata TEXT,
    created_at TEXT,
    updated_at TEXT
);
```

### 1.2 Dipendenze dei Servizi

#### Servizi che utilizzano `./devflow.sqlite`:
- `src/api/project-lifecycle-api.js` (porta 3003)
- `src/cli/devflow-project-cli.ts`
- `src/core/database/database-daemon.ts`
- Hook naturali: `.claude/hooks/project-lifecycle-automation.py`

#### Servizi che utilizzano `./data/devflow.sqlite`:
- `src/core/database/database-daemon.ts` (tramite ENV DEVFLOW_DB_PATH)
- Servizi di memoria e sessioni

#### Servizi che utilizzano `./data/vector.sqlite`:
- `packages/core/dist/services/vector-memory-service.cjs`
- `src/core/semantic-memory/semantic-memory-service.ts`

---

## 2. Architettura Target Unificata

### 2.1 Schema Database Unificato: `./data/devflow_unified.sqlite`

```sql
-- ===============================
-- SEZIONE GERARCHIA PROGETTI
-- ===============================

CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on-hold', 'cancelled')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    phase TEXT DEFAULT 'planning' CHECK (phase IN ('planning', 'design', 'development', 'testing', 'deployment', 'completed')),
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE roadmaps (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    priority INTEGER DEFAULT 0,
    project_id INTEGER,
    created_at TEXT,
    updated_at TEXT,
    metadata TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE TABLE task_contexts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    tags TEXT,
    created_at TEXT,
    updated_at TEXT,
    completed_at TEXT,
    metadata TEXT,
    parent_id TEXT,
    roadmap_id TEXT,
    project_id INTEGER,
    plan_id INTEGER,
    file_path TEXT,
    content_hash TEXT,
    FOREIGN KEY (parent_id) REFERENCES task_contexts(id),
    FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (plan_id) REFERENCES plans(id)
);

CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    plan_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    task_context_id TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
    FOREIGN KEY (task_context_id) REFERENCES task_contexts(id) ON DELETE SET NULL
);

-- ===============================
-- SEZIONE KNOWLEDGE MANAGEMENT
-- ===============================

CREATE TABLE knowledge_entities (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    metadata TEXT,
    project_id INTEGER,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- ===============================
-- SEZIONE MEMORIA E SESSIONI
-- ===============================

CREATE TABLE memories (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'general' CHECK (type IN ('general', 'task', 'session', 'project')),
    project_id INTEGER,
    task_context_id TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (task_context_id) REFERENCES task_contexts(id) ON DELETE SET NULL
);

CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    context TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    project_id INTEGER,
    created_at TEXT,
    updated_at TEXT,
    metadata TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- ===============================
-- SEZIONE VETTORIALE UNIFICATA
-- ===============================

CREATE TABLE vector_memories (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    embedding BLOB NOT NULL,
    metadata TEXT,
    project_id INTEGER,
    task_context_id TEXT,
    memory_id TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (task_context_id) REFERENCES task_contexts(id) ON DELETE SET NULL,
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

CREATE TABLE memory_block_embeddings (
    block_id TEXT PRIMARY KEY,
    embedding BLOB NOT NULL,
    model TEXT NOT NULL DEFAULT 'synthetic-embeddings-v1',
    dimensions INTEGER NOT NULL DEFAULT 1024,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (block_id) REFERENCES task_contexts(id) ON DELETE CASCADE
);

-- ===============================
-- SEZIONE AUDIT E TRACKING
-- ===============================

CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values TEXT,
    new_values TEXT,
    user_context TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_id TEXT
);

-- ===============================
-- INDICI PER PERFORMANCE
-- ===============================

-- Indici per ricerche frequenti
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_name ON projects(name);
CREATE INDEX idx_tasks_project_status ON tasks(project_id, status);
CREATE INDEX idx_task_contexts_status ON task_contexts(status);
CREATE INDEX idx_task_contexts_project ON task_contexts(project_id);
CREATE INDEX idx_memories_project ON memories(project_id);
CREATE INDEX idx_sessions_project ON sessions(project_id);
CREATE INDEX idx_vector_memories_project ON vector_memories(project_id);

-- Indici per relazioni FK
CREATE INDEX idx_plans_project ON plans(project_id);
CREATE INDEX idx_roadmaps_project ON roadmaps(project_id);
CREATE INDEX idx_tasks_plan ON tasks(plan_id);
CREATE INDEX idx_knowledge_entities_project ON knowledge_entities(project_id);

-- Indici per ricerche temporali
CREATE INDEX idx_projects_created ON projects(created_at);
CREATE INDEX idx_tasks_created ON tasks(created_at);
CREATE INDEX idx_memories_created ON memories(created_at);

-- ===============================
-- TRIGGER PER AUDIT LOG
-- ===============================

CREATE TRIGGER audit_projects_insert AFTER INSERT ON projects
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, new_values)
    VALUES ('projects', NEW.id, 'INSERT', json_object(
        'name', NEW.name,
        'status', NEW.status,
        'progress', NEW.progress
    ));
END;

CREATE TRIGGER audit_projects_update AFTER UPDATE ON projects
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_values, new_values)
    VALUES ('projects', NEW.id, 'UPDATE',
        json_object('name', OLD.name, 'status', OLD.status, 'progress', OLD.progress),
        json_object('name', NEW.name, 'status', NEW.status, 'progress', NEW.progress)
    );
END;

-- ===============================
-- TRIGGER PER AUTO-UPDATE
-- ===============================

CREATE TRIGGER update_project_timestamp AFTER UPDATE ON projects
BEGIN
    UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_task_timestamp AFTER UPDATE ON tasks
BEGIN
    UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
```

### 2.2 Vantaggi dell'Architettura Unificata

1. **Integrità Referenziale Completa**: Tutte le relazioni FK sono preservate
2. **Performance Ottimizzate**: Indici strategici per query frequenti
3. **Audit Trail Completo**: Tracking automatico di tutte le modifiche
4. **Gestione Vettoriale Integrata**: Embeddings collegati direttamente alle entità
5. **Scalabilità**: Schema progettato per crescita futura
6. **Context7 Compliance**: Organizzazione dati in cartella dedicata

---

## 3. Piano di Migrazione Dettagliato

### 3.1 Fase 1: Preparazione e Backup (Durata: 30 minuti)

#### 3.1.1 Backup Completo
```bash
#!/bin/bash
# Script: backup_databases.sh

BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup database principali
cp ./devflow.sqlite "$BACKUP_DIR/devflow_main.sqlite"
cp ./data/devflow.sqlite "$BACKUP_DIR/devflow_data.sqlite"
cp ./data/vector.sqlite "$BACKUP_DIR/vector.sqlite"

# Backup file di configurazione
cp .env "$BACKUP_DIR/env_backup"
cp .claude/settings.json "$BACKUP_DIR/claude_settings.json"

echo "Backup completato in: $BACKUP_DIR"
```

#### 3.1.2 Arresto Servizi
```bash
#!/bin/bash
# Script: stop_services.sh

# Arresta tutti i servizi DevFlow
pkill -f "database-daemon"
pkill -f "project-lifecycle-api"
pkill -f "vector-memory-service"
pkill -f "model-registry-daemon"

# Verifica arresto
sleep 5
pgrep -f "devflow" || echo "Tutti i servizi arrestati"
```

#### 3.1.3 Validazione Dati Pre-Migrazione
```typescript
// Script: validate_data_integrity.ts
import { Database } from 'sqlite3';

async function validateDataIntegrity() {
    const results = {
        mainDb: await validateMainDatabase(),
        dataDb: await validateDataDatabase(),
        vectorDb: await validateVectorDatabase()
    };

    console.log('Validation Results:', JSON.stringify(results, null, 2));
    return results;
}

async function validateMainDatabase(): Promise<any> {
    return new Promise((resolve, reject) => {
        const db = new Database('./devflow.sqlite');

        db.serialize(() => {
            const queries = [
                "SELECT COUNT(*) as count FROM projects",
                "SELECT COUNT(*) as count FROM plans",
                "SELECT COUNT(*) as count FROM tasks",
                "SELECT COUNT(*) as count FROM task_contexts",
                "SELECT COUNT(*) as count FROM roadmaps",
                "SELECT COUNT(*) as count FROM knowledge_entities",
                "SELECT COUNT(*) as count FROM memory_block_embeddings"
            ];

            const results: any = {};
            let completed = 0;

            queries.forEach((query, index) => {
                const tableName = query.match(/FROM (\w+)/)?.[1];
                db.get(query, (err, row: any) => {
                    if (err) {
                        results[tableName] = { error: err.message };
                    } else {
                        results[tableName] = { count: row.count };
                    }

                    completed++;
                    if (completed === queries.length) {
                        db.close();
                        resolve(results);
                    }
                });
            });
        });
    });
}
```

### 3.2 Fase 2: Creazione Database Unificato (Durata: 15 minuti)

#### 3.2.1 Inizializzazione Schema
```typescript
// Script: create_unified_database.ts
import { Database } from 'sqlite3';
import * as fs from 'fs';

async function createUnifiedDatabase() {
    // Assicura che la directory data esista
    if (!fs.existsSync('./data')) {
        fs.mkdirSync('./data', { recursive: true });
    }

    const db = new Database('./data/devflow_unified.sqlite');

    // Leggi e esegui lo schema completo
    const schema = fs.readFileSync('./docs/sviluppo/unified_schema.sql', 'utf8');

    return new Promise((resolve, reject) => {
        db.exec(schema, (err) => {
            if (err) {
                reject(err);
            } else {
                console.log('Database unificato creato con successo');
                db.close();
                resolve(true);
            }
        });
    });
}
```

#### 3.2.2 Verifica Schema
```sql
-- Script: verify_schema.sql
-- Verifica che tutte le tabelle siano state create

.tables

-- Verifica vincoli FK
PRAGMA foreign_key_check;

-- Verifica indici
.indices

-- Test integrità
PRAGMA integrity_check;
```

### 3.3 Fase 3: Migrazione Dati (Durata: 45 minuti)

#### 3.3.1 Migrazione Dati Principali
```typescript
// Script: migrate_main_data.ts
import { Database } from 'sqlite3';

class DataMigrator {
    private sourceDb: Database;
    private targetDb: Database;

    constructor(sourcePath: string, targetPath: string) {
        this.sourceDb = new Database(sourcePath);
        this.targetDb = new Database(targetPath);
    }

    async migrateProjects(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.sourceDb.all("SELECT * FROM projects", (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                const stmt = this.targetDb.prepare(`
                    INSERT INTO projects (id, name, description, start_date, end_date, status, progress, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                let completed = 0;
                rows.forEach((row: any) => {
                    stmt.run([
                        row.id, row.name, row.description, row.start_date,
                        row.end_date, row.status, row.progress, row.created_at, row.updated_at
                    ], (err) => {
                        if (err) {
                            console.error('Errore migrazione progetto:', err);
                        }
                        completed++;
                        if (completed === rows.length) {
                            stmt.finalize();
                            console.log(`Migrati ${rows.length} progetti`);
                            resolve();
                        }
                    });
                });

                if (rows.length === 0) {
                    stmt.finalize();
                    resolve();
                }
            });
        });
    }

    async migratePlans(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.sourceDb.all("SELECT * FROM plans", (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                const stmt = this.targetDb.prepare(`
                    INSERT INTO plans (id, project_id, name, phase, description, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);

                let completed = 0;
                rows.forEach((row: any) => {
                    stmt.run([
                        row.id, row.project_id, row.name, row.phase,
                        row.description, row.created_at, row.updated_at
                    ], (err) => {
                        if (err) {
                            console.error('Errore migrazione piano:', err);
                        }
                        completed++;
                        if (completed === rows.length) {
                            stmt.finalize();
                            console.log(`Migrati ${rows.length} piani`);
                            resolve();
                        }
                    });
                });

                if (rows.length === 0) {
                    stmt.finalize();
                    resolve();
                }
            });
        });
    }

    async migrateTaskContexts(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.sourceDb.all("SELECT * FROM task_contexts", (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                const stmt = this.targetDb.prepare(`
                    INSERT INTO task_contexts (
                        id, title, description, status, tags, created_at, updated_at,
                        completed_at, metadata, parent_id, roadmap_id, file_path, content_hash
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                let completed = 0;
                rows.forEach((row: any) => {
                    stmt.run([
                        row.id, row.title, row.description, row.status, row.tags,
                        row.created_at, row.updated_at, row.completed_at, row.metadata,
                        row.parent_id, row.roadmap_id, row.file_path, row.content_hash
                    ], (err) => {
                        if (err) {
                            console.error('Errore migrazione task context:', err);
                        }
                        completed++;
                        if (completed === rows.length) {
                            stmt.finalize();
                            console.log(`Migrati ${rows.length} task contexts`);
                            resolve();
                        }
                    });
                });

                if (rows.length === 0) {
                    stmt.finalize();
                    resolve();
                }
            });
        });
    }

    async migrateEmbeddings(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.sourceDb.all("SELECT * FROM memory_block_embeddings", (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                const stmt = this.targetDb.prepare(`
                    INSERT INTO memory_block_embeddings (block_id, embedding, model, dimensions, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);

                let completed = 0;
                rows.forEach((row: any) => {
                    stmt.run([
                        row.block_id, row.embedding, row.model, row.dimensions,
                        row.created_at, row.updated_at
                    ], (err) => {
                        if (err) {
                            console.error('Errore migrazione embedding:', err);
                        }
                        completed++;
                        if (completed === rows.length) {
                            stmt.finalize();
                            console.log(`Migrati ${rows.length} embeddings`);
                            resolve();
                        }
                    });
                });

                if (rows.length === 0) {
                    stmt.finalize();
                    resolve();
                }
            });
        });
    }

    async close(): Promise<void> {
        return new Promise((resolve) => {
            this.sourceDb.close((err) => {
                if (err) console.error('Errore chiusura source DB:', err);
                this.targetDb.close((err) => {
                    if (err) console.error('Errore chiusura target DB:', err);
                    resolve();
                });
            });
        });
    }
}

// Esecuzione migrazione
async function runMainDataMigration() {
    const migrator = new DataMigrator('./devflow.sqlite', './data/devflow_unified.sqlite');

    try {
        await migrator.migrateProjects();
        await migrator.migratePlans();
        await migrator.migrateTaskContexts();
        await migrator.migrateEmbeddings();

        console.log('Migrazione dati principali completata');
    } catch (error) {
        console.error('Errore migrazione:', error);
    } finally {
        await migrator.close();
    }
}
```

#### 3.3.2 Migrazione Memoria e Sessioni
```typescript
// Script: migrate_memory_data.ts
import { Database } from 'sqlite3';

class MemoryDataMigrator {
    private dataDb: Database;
    private vectorDb: Database;
    private targetDb: Database;

    constructor() {
        this.dataDb = new Database('./data/devflow.sqlite');
        this.vectorDb = new Database('./data/vector.sqlite');
        this.targetDb = new Database('./data/devflow_unified.sqlite');
    }

    async migrateMemories(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.dataDb.all("SELECT * FROM memories", (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                const stmt = this.targetDb.prepare(`
                    INSERT INTO memories (id, content, type, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                `);

                let completed = 0;
                rows.forEach((row: any) => {
                    stmt.run([
                        row.id, row.content, row.type || 'general',
                        row.created_at, row.updated_at
                    ], (err) => {
                        if (err) {
                            console.error('Errore migrazione memoria:', err);
                        }
                        completed++;
                        if (completed === rows.length) {
                            stmt.finalize();
                            console.log(`Migrate ${rows.length} memorie`);
                            resolve();
                        }
                    });
                });

                if (rows.length === 0) {
                    stmt.finalize();
                    resolve();
                }
            });
        });
    }

    async migrateSessions(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.dataDb.all("SELECT * FROM sessions", (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                const stmt = this.targetDb.prepare(`
                    INSERT INTO sessions (id, context, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                `);

                let completed = 0;
                rows.forEach((row: any) => {
                    stmt.run([
                        row.id, row.context, row.status || 'active',
                        row.created_at, row.updated_at
                    ], (err) => {
                        if (err) {
                            console.error('Errore migrazione sessione:', err);
                        }
                        completed++;
                        if (completed === rows.length) {
                            stmt.finalize();
                            console.log(`Migrate ${rows.length} sessioni`);
                            resolve();
                        }
                    });
                });

                if (rows.length === 0) {
                    stmt.finalize();
                    resolve();
                }
            });
        });
    }

    async migrateVectorMemories(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.vectorDb.all("SELECT * FROM vector_memories", (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                const stmt = this.targetDb.prepare(`
                    INSERT INTO vector_memories (id, content, embedding, metadata, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);

                let completed = 0;
                rows.forEach((row: any) => {
                    stmt.run([
                        row.id, row.content, row.embedding, row.metadata,
                        row.created_at, row.updated_at
                    ], (err) => {
                        if (err) {
                            console.error('Errore migrazione vector memory:', err);
                        }
                        completed++;
                        if (completed === rows.length) {
                            stmt.finalize();
                            console.log(`Migrate ${rows.length} vector memories`);
                            resolve();
                        }
                    });
                });

                if (rows.length === 0) {
                    stmt.finalize();
                    resolve();
                }
            });
        });
    }

    async close(): Promise<void> {
        return new Promise((resolve) => {
            this.dataDb.close((err) => {
                if (err) console.error('Errore chiusura data DB:', err);
                this.vectorDb.close((err) => {
                    if (err) console.error('Errore chiusura vector DB:', err);
                    this.targetDb.close((err) => {
                        if (err) console.error('Errore chiusura target DB:', err);
                        resolve();
                    });
                });
            });
        });
    }
}
```

### 3.4 Fase 4: Aggiornamento Configurazioni (Durata: 20 minuti)

#### 3.4.1 Aggiornamento File di Ambiente
```bash
# Nuovo contenuto .env
DEVFLOW_DB_PATH=./data/devflow_unified.sqlite
DB_MANAGER_PORT=3002
MODEL_REGISTRY_PORT=3004
VECTOR_MEMORY_PORT=3008
TOKEN_OPTIMIZER_PORT=3006

# Database unificato
DATABASE_URL=sqlite:./data/devflow_unified.sqlite

# Configurazioni vettoriali
VECTOR_DB_PATH=./data/devflow_unified.sqlite
EMBEDDING_TABLE=memory_block_embeddings
VECTOR_MEMORY_TABLE=vector_memories

# Servizi
PROJECT_API_PORT=3003
CLI_INTEGRATION_PORT=3009
```

#### 3.4.2 Aggiornamento Servizi

##### Database Daemon
```typescript
// src/core/database/database-daemon.ts - Aggiornamenti necessari

// Cambio path database
const DB_PATH = process.env.DEVFLOW_DB_PATH || './data/devflow_unified.sqlite';

// Aggiornamento query per nuova struttura
class UnifiedDatabaseManager {
    private db: Database;

    constructor(dbPath: string) {
        this.db = new Database(dbPath);
        this.db.run("PRAGMA foreign_keys = ON");
    }

    // Nuovi metodi per gestione unificata
    async getProjectHierarchy(projectId: number): Promise<any> {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT
                    p.*,
                    COUNT(DISTINCT pl.id) as plan_count,
                    COUNT(DISTINCT t.id) as task_count,
                    COUNT(DISTINCT tc.id) as context_count
                FROM projects p
                LEFT JOIN plans pl ON p.id = pl.project_id
                LEFT JOIN tasks t ON p.id = t.project_id
                LEFT JOIN task_contexts tc ON p.id = tc.project_id
                WHERE p.id = ?
                GROUP BY p.id
            `;

            this.db.get(query, [projectId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async getTaskWithEmbedding(taskId: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT
                    tc.*,
                    mbe.embedding,
                    mbe.model,
                    mbe.dimensions
                FROM task_contexts tc
                LEFT JOIN memory_block_embeddings mbe ON tc.id = mbe.block_id
                WHERE tc.id = ?
            `;

            this.db.get(query, [taskId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async searchSimilarTasks(embedding: Buffer, threshold: number = 0.7): Promise<any[]> {
        return new Promise((resolve, reject) => {
            // Implementazione ricerca similarità utilizzando SQLite con estensioni vettoriali
            // o fallback su calcolo cosine similarity in applicazione
            const query = `
                SELECT
                    tc.*,
                    mbe.embedding,
                    p.name as project_name
                FROM task_contexts tc
                JOIN memory_block_embeddings mbe ON tc.id = mbe.block_id
                LEFT JOIN projects p ON tc.project_id = p.id
                WHERE mbe.embedding IS NOT NULL
            `;

            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // Calcolo similarità in applicazione
                    const similarities = rows.map((row: any) => ({
                        ...row,
                        similarity: this.calculateCosineSimilarity(embedding, row.embedding)
                    })).filter(row => row.similarity >= threshold)
                      .sort((a, b) => b.similarity - a.similarity);

                    resolve(similarities);
                }
            });
        });
    }

    private calculateCosineSimilarity(a: Buffer, b: Buffer): number {
        // Implementazione calcolo cosine similarity
        const vectorA = new Float32Array(a.buffer);
        const vectorB = new Float32Array(b.buffer);

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vectorA.length; i++) {
            dotProduct += vectorA[i] * vectorB[i];
            normA += vectorA[i] * vectorA[i];
            normB += vectorB[i] * vectorB[i];
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
```

##### Project Lifecycle API
```javascript
// src/api/project-lifecycle-api.js - Aggiornamenti
const dbPath = path.resolve(__dirname, '../../data/devflow_unified.sqlite');

// Nuovi endpoint per gestione unificata
app.get('/projects/:id/hierarchy', async (req, res, next) => {
    try {
        const { id } = req.params;

        const hierarchy = await getQuery(`
            SELECT
                'project' as type, p.id, p.name, p.description, p.status, p.progress, NULL as parent_id
            FROM projects p
            WHERE p.id = ?

            UNION ALL

            SELECT
                'plan' as type, pl.id, pl.name, pl.description, 'active' as status, 0 as progress, p.id as parent_id
            FROM plans pl
            JOIN projects p ON pl.project_id = p.id
            WHERE p.id = ?

            UNION ALL

            SELECT
                'task' as type, t.id, t.name, t.description, t.status, 0 as progress,
                COALESCE(t.plan_id, t.project_id) as parent_id
            FROM tasks t
            WHERE t.project_id = ?

            ORDER BY type, id
        `, [id, id, id]);

        res.json({ hierarchy });
    } catch (err) {
        next(err);
    }
});

app.get('/search/tasks', async (req, res, next) => {
    try {
        const { query, limit = 10 } = req.query;

        const tasks = await allQuery(`
            SELECT
                tc.*,
                p.name as project_name,
                CASE
                    WHEN tc.title LIKE ? OR tc.description LIKE ? THEN 3
                    WHEN tc.tags LIKE ? THEN 2
                    ELSE 1
                END as relevance
            FROM task_contexts tc
            LEFT JOIN projects p ON tc.project_id = p.id
            WHERE tc.title LIKE ? OR tc.description LIKE ? OR tc.tags LIKE ?
            ORDER BY relevance DESC, tc.updated_at DESC
            LIMIT ?
        `, [
            `%${query}%`, `%${query}%`, `%${query}%`,
            `%${query}%`, `%${query}%`, `%${query}%`,
            limit
        ]);

        res.json({ tasks, query, count: tasks.length });
    } catch (err) {
        next(err);
    }
});
```

##### Vector Memory Service
```javascript
// packages/core/dist/services/vector-memory-service.cjs - Aggiornamenti
const DB_PATH = process.env.DEVFLOW_DB_PATH || './data/devflow_unified.sqlite';

class UnifiedVectorMemoryService {
    constructor(dbPath) {
        this.db = new sqlite3.Database(dbPath);
        this.db.run("PRAGMA foreign_keys = ON");
    }

    async storeTaskEmbedding(taskId, embedding, model = 'synthetic-embeddings-v1') {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT OR REPLACE INTO memory_block_embeddings
                (block_id, embedding, model, dimensions, created_at, updated_at)
                VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
            `;

            const dimensions = embedding.length;
            const buffer = Buffer.from(embedding.buffer);

            this.db.run(query, [taskId, buffer, model, dimensions], function(err) {
                if (err) reject(err);
                else resolve({ taskId, embeddingStored: true });
            });
        });
    }

    async storeVectorMemory(content, embedding, metadata = {}) {
        return new Promise((resolve, reject) => {
            const id = `vm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const query = `
                INSERT INTO vector_memories
                (id, content, embedding, metadata, created_at, updated_at)
                VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
            `;

            const buffer = Buffer.from(embedding.buffer);
            const metadataJson = JSON.stringify(metadata);

            this.db.run(query, [id, content, buffer, metadataJson], function(err) {
                if (err) reject(err);
                else resolve({ id, stored: true });
            });
        });
    }

    async searchSimilarContent(queryEmbedding, threshold = 0.7, limit = 10) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT
                    vm.id,
                    vm.content,
                    vm.metadata,
                    vm.embedding,
                    vm.created_at
                FROM vector_memories vm
                WHERE vm.embedding IS NOT NULL
                ORDER BY vm.created_at DESC
            `;

            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const similarities = rows.map(row => ({
                        ...row,
                        metadata: JSON.parse(row.metadata || '{}'),
                        similarity: this.calculateSimilarity(queryEmbedding, row.embedding)
                    })).filter(row => row.similarity >= threshold)
                      .sort((a, b) => b.similarity - a.similarity)
                      .slice(0, limit);

                    resolve(similarities);
                }
            });
        });
    }

    calculateSimilarity(queryEmbedding, storedEmbedding) {
        const query = new Float32Array(queryEmbedding.buffer || queryEmbedding);
        const stored = new Float32Array(storedEmbedding.buffer || storedEmbedding);

        let dotProduct = 0;
        let queryNorm = 0;
        let storedNorm = 0;

        for (let i = 0; i < query.length; i++) {
            dotProduct += query[i] * stored[i];
            queryNorm += query[i] * query[i];
            storedNorm += stored[i] * stored[i];
        }

        return dotProduct / (Math.sqrt(queryNorm) * Math.sqrt(storedNorm));
    }
}
```

### 3.5 Fase 5: Test e Validazione (Durata: 30 minuti)

#### 3.5.1 Test di Integrità Database
```typescript
// Script: test_database_integrity.ts
import { Database } from 'sqlite3';

class DatabaseIntegrityTester {
    private db: Database;

    constructor(dbPath: string) {
        this.db = new Database(dbPath);
    }

    async runAllTests(): Promise<any> {
        const results = {
            foreignKeyCheck: await this.testForeignKeys(),
            dataConsistency: await this.testDataConsistency(),
            indexPerformance: await this.testIndexPerformance(),
            embeddingIntegrity: await this.testEmbeddingIntegrity(),
            auditLogFunctionality: await this.testAuditLog()
        };

        return results;
    }

    async testForeignKeys(): Promise<any> {
        return new Promise((resolve, reject) => {
            this.db.all("PRAGMA foreign_key_check", (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        passed: rows.length === 0,
                        violations: rows
                    });
                }
            });
        });
    }

    async testDataConsistency(): Promise<any> {
        const tests = [
            {
                name: "projects_plans_consistency",
                query: "SELECT COUNT(*) as count FROM plans p LEFT JOIN projects pr ON p.project_id = pr.id WHERE pr.id IS NULL"
            },
            {
                name: "tasks_projects_consistency",
                query: "SELECT COUNT(*) as count FROM tasks t LEFT JOIN projects p ON t.project_id = p.id WHERE p.id IS NULL AND t.project_id IS NOT NULL"
            },
            {
                name: "embeddings_tasks_consistency",
                query: "SELECT COUNT(*) as count FROM memory_block_embeddings e LEFT JOIN task_contexts tc ON e.block_id = tc.id WHERE tc.id IS NULL"
            }
        ];

        const results: any = {};

        for (const test of tests) {
            const result = await new Promise((resolve, reject) => {
                this.db.get(test.query, (err, row: any) => {
                    if (err) reject(err);
                    else resolve(row.count === 0);
                });
            });
            results[test.name] = result;
        }

        return results;
    }

    async testIndexPerformance(): Promise<any> {
        const performanceTests = [
            {
                name: "project_lookup",
                query: "EXPLAIN QUERY PLAN SELECT * FROM projects WHERE name = 'test'"
            },
            {
                name: "task_by_project",
                query: "EXPLAIN QUERY PLAN SELECT * FROM tasks WHERE project_id = 1"
            },
            {
                name: "embedding_lookup",
                query: "EXPLAIN QUERY PLAN SELECT * FROM memory_block_embeddings WHERE block_id = 'test'"
            }
        ];

        const results: any = {};

        for (const test of performanceTests) {
            const result = await new Promise((resolve, reject) => {
                this.db.all(test.query, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            // Verifica che utilizzi indici (cerca "USING INDEX" nel piano)
            const usesIndex = JSON.stringify(result).includes('USING INDEX');
            results[test.name] = { usesIndex, plan: result };
        }

        return results;
    }

    async testEmbeddingIntegrity(): Promise<any> {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT
                    block_id,
                    LENGTH(embedding) as embedding_size,
                    dimensions,
                    model
                FROM memory_block_embeddings
                LIMIT 5
            `, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const results = rows.map((row: any) => ({
                        ...row,
                        size_matches_dimensions: (row.embedding_size / 4) === row.dimensions, // Float32 = 4 bytes
                        has_valid_size: row.embedding_size > 0
                    }));

                    resolve({
                        count: rows.length,
                        all_valid: results.every(r => r.size_matches_dimensions && r.has_valid_size),
                        samples: results
                    });
                }
            });
        });
    }

    async testAuditLog(): Promise<any> {
        return new Promise((resolve, reject) => {
            // Test inserimento progetto per verificare trigger audit
            this.db.run(`
                INSERT INTO projects (name, description, status)
                VALUES ('Test Audit Project', 'Test audit functionality', 'active')
            `, function(err) {
                if (err) {
                    reject(err);
                } else {
                    const projectId = this.lastID;

                    // Verifica che il trigger abbia creato un record audit
                    this.db.get(`
                        SELECT * FROM audit_log
                        WHERE table_name = 'projects' AND record_id = ? AND operation = 'INSERT'
                    `, [projectId], (err, row) => {
                        if (err) {
                            reject(err);
                        } else {
                            // Cleanup
                            this.db.run('DELETE FROM projects WHERE id = ?', [projectId]);
                            resolve({
                                audit_created: !!row,
                                audit_record: row
                            });
                        }
                    });
                }
            });
        });
    }
}
```

#### 3.5.2 Test Funzionalità API
```typescript
// Script: test_api_functionality.ts
import axios from 'axios';

class APIFunctionalityTester {
    private baseURL: string;

    constructor(baseURL: string = 'http://localhost:3003') {
        this.baseURL = baseURL;
    }

    async runAllTests(): Promise<any> {
        const results = {
            healthCheck: await this.testHealthCheck(),
            createProject: await this.testCreateProject(),
            projectHierarchy: await this.testProjectHierarchy(),
            taskCompletion: await this.testTaskCompletion(),
            searchFunctionality: await this.testSearchFunctionality()
        };

        return results;
    }

    async testHealthCheck(): Promise<any> {
        try {
            const response = await axios.get(`${this.baseURL}/health`);
            return {
                passed: response.status === 200,
                response: response.data
            };
        } catch (error: any) {
            return {
                passed: false,
                error: error.message
            };
        }
    }

    async testCreateProject(): Promise<any> {
        try {
            const projectData = {
                name: `Test Project ${Date.now()}`,
                description: 'Test project for validation',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            };

            const response = await axios.post(`${this.baseURL}/projects`, projectData);

            return {
                passed: response.status === 201 && response.data.id,
                projectId: response.data.id,
                response: response.data
            };
        } catch (error: any) {
            return {
                passed: false,
                error: error.message
            };
        }
    }

    async testProjectHierarchy(): Promise<any> {
        try {
            // Prima crea un progetto di test
            const projectResponse = await this.testCreateProject();
            if (!projectResponse.passed) {
                return { passed: false, error: 'Could not create test project' };
            }

            const projectId = projectResponse.projectId;
            const response = await axios.get(`${this.baseURL}/projects/${projectId}/hierarchy`);

            return {
                passed: response.status === 200 && Array.isArray(response.data.hierarchy),
                hierarchy: response.data.hierarchy
            };
        } catch (error: any) {
            return {
                passed: false,
                error: error.message
            };
        }
    }

    async testTaskCompletion(): Promise<any> {
        try {
            // Questo test richiede task esistenti, per ora verifica solo l'endpoint
            const response = await axios.put(`${this.baseURL}/tasks/999/complete`, {});

            // Ci aspettiamo un 404 o un successo se il task esiste
            return {
                passed: response.status === 404 || response.status === 200,
                response: response.data
            };
        } catch (error: any) {
            if (error.response?.status === 404) {
                return { passed: true, note: 'Endpoint correctly returns 404 for non-existent task' };
            }
            return {
                passed: false,
                error: error.message
            };
        }
    }

    async testSearchFunctionality(): Promise<any> {
        try {
            const response = await axios.get(`${this.baseURL}/search/tasks?query=test&limit=5`);

            return {
                passed: response.status === 200 && response.data.tasks !== undefined,
                response: response.data
            };
        } catch (error: any) {
            return {
                passed: false,
                error: error.message
            };
        }
    }
}
```

### 3.6 Fase 6: Avvio e Verifica Servizi (Durata: 15 minuti)

#### 3.6.1 Script di Avvio Unificato
```bash
#!/bin/bash
# Script: start_unified_services.sh

set -e

echo "🚀 Avvio servizi DevFlow con database unificato..."

# Verifica che il database unificato esista
if [ ! -f "./data/devflow_unified.sqlite" ]; then
    echo "❌ Errore: Database unificato non trovato!"
    exit 1
fi

# Export variabili ambiente
export DEVFLOW_DB_PATH=./data/devflow_unified.sqlite
export DATABASE_URL=sqlite:./data/devflow_unified.sqlite

# Avvia servizi in ordine di dipendenza
echo "📡 Avvio Database Daemon..."
DEVFLOW_DB_PATH=$DEVFLOW_DB_PATH node -r ts-node/register src/core/database/database-daemon.ts &
DB_DAEMON_PID=$!
sleep 3

echo "🎯 Avvio Model Registry..."
MODEL_REGISTRY_PORT=3004 node -r ts-node/register src/core/services/model-registry-daemon.ts &
MODEL_REGISTRY_PID=$!
sleep 2

echo "🧠 Avvio Vector Memory Service..."
VECTOR_MEMORY_PORT=3008 DEVFLOW_DB_PATH=$DEVFLOW_DB_PATH node packages/core/dist/services/vector-memory-service.cjs &
VECTOR_MEMORY_PID=$!
sleep 2

echo "🔧 Avvio Project Lifecycle API..."
DEVFLOW_DB_PATH=$DEVFLOW_DB_PATH node src/api/project-lifecycle-api.js &
API_PID=$!
sleep 3

echo "✅ Tutti i servizi avviati!"

# Salva PID per cleanup
echo "DB_DAEMON_PID=$DB_DAEMON_PID" > .services.pid
echo "MODEL_REGISTRY_PID=$MODEL_REGISTRY_PID" >> .services.pid
echo "VECTOR_MEMORY_PID=$VECTOR_MEMORY_PID" >> .services.pid
echo "API_PID=$API_PID" >> .services.pid

# Test di connettività
echo "🧪 Test connettività servizi..."
sleep 5

# Test Database Daemon
if pgrep -f "database-daemon" > /dev/null; then
    echo "✅ Database Daemon: ATTIVO"
else
    echo "❌ Database Daemon: NON ATTIVO"
fi

# Test Vector Memory Service
if curl -s http://localhost:3008/health > /dev/null; then
    echo "✅ Vector Memory Service: ATTIVO"
else
    echo "❌ Vector Memory Service: NON ATTIVO"
fi

# Test Project API
if curl -s http://localhost:3003/health > /dev/null; then
    echo "✅ Project Lifecycle API: ATTIVO"
else
    echo "❌ Project Lifecycle API: NON ATTIVO"
fi

echo "🎉 Migrazione completata e servizi operativi!"
echo "📊 Database unificato: ./data/devflow_unified.sqlite"
echo "📝 Log servizi: ./logs/"
echo "🔍 Monitoraggio: tail -f ./logs/*.log"
```

#### 3.6.2 Script di Test Post-Migrazione
```bash
#!/bin/bash
# Script: test_post_migration.sh

echo "🧪 Test completo post-migrazione..."

# Test comandi CLI
echo "📝 Test comandi CLI..."
echo "crea progetto Test Migration Project" | node dist/cli/devflow-project-cli.js
echo "stato progetto" | node dist/cli/devflow-project-cli.js

# Test API endpoints
echo "🌐 Test API endpoints..."
curl -X POST http://localhost:3003/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"API Test Project","description":"Test via API"}'

curl http://localhost:3003/health

# Test ricerca semantica
echo "🔍 Test ricerca semantica..."
curl "http://localhost:3003/search/tasks?query=test&limit=5"

# Test database integrity
echo "🗄️ Test integrità database..."
node -r ts-node/register -e "
import { Database } from 'sqlite3';
const db = new Database('./data/devflow_unified.sqlite');
db.all('PRAGMA foreign_key_check', (err, rows) => {
  if (err) console.error('❌ Errore FK:', err);
  else if (rows.length === 0) console.log('✅ Integrità FK OK');
  else console.log('❌ Violazioni FK:', rows);

  db.all('PRAGMA integrity_check', (err, rows) => {
    if (err) console.error('❌ Errore integrità:', err);
    else if (rows[0] === 'ok') console.log('✅ Integrità database OK');
    else console.log('❌ Problemi integrità:', rows);
    db.close();
  });
});
"

echo "✅ Test post-migrazione completato!"
```

---

## 4. Rollback e Recovery

### 4.1 Piano di Rollback
```bash
#!/bin/bash
# Script: rollback_migration.sh

echo "⚠️ Avvio procedura di rollback..."

# Trova l'ultimo backup
LATEST_BACKUP=$(ls -1 ./backups/ | tail -1)
if [ -z "$LATEST_BACKUP" ]; then
    echo "❌ Nessun backup trovato!"
    exit 1
fi

echo "📂 Utilizzando backup: $LATEST_BACKUP"

# Arresta tutti i servizi
echo "🛑 Arresto servizi..."
pkill -f "devflow"
sleep 5

# Ripristina database originali
echo "📥 Ripristino database..."
cp "./backups/$LATEST_BACKUP/devflow_main.sqlite" "./devflow.sqlite"
cp "./backups/$LATEST_BACKUP/devflow_data.sqlite" "./data/devflow.sqlite"
cp "./backups/$LATEST_BACKUP/vector.sqlite" "./data/vector.sqlite"

# Ripristina configurazioni
echo "⚙️ Ripristino configurazioni..."
cp "./backups/$LATEST_BACKUP/env_backup" ".env"
cp "./backups/$LATEST_BACKUP/claude_settings.json" ".claude/settings.json"

# Rimuovi database unificato se esiste
if [ -f "./data/devflow_unified.sqlite" ]; then
    mv "./data/devflow_unified.sqlite" "./data/devflow_unified.sqlite.rollback"
fi

echo "✅ Rollback completato!"
echo "🔄 Riavvia i servizi con la configurazione precedente"
```

### 4.2 Verifica Post-Rollback
```bash
#!/bin/bash
# Script: verify_rollback.sh

echo "🧪 Verifica stato post-rollback..."

# Verifica esistenza database originali
if [ -f "./devflow.sqlite" ] && [ -f "./data/devflow.sqlite" ] && [ -f "./data/vector.sqlite" ]; then
    echo "✅ Database originali ripristinati"
else
    echo "❌ Database mancanti!"
fi

# Test comando progetti
echo "📝 Test comando progetti..."
echo "stato progetto" | timeout 10 python3 .claude/hooks/project-lifecycle-automation.py

# Verifica dimensioni database (devono corrispondere al backup)
echo "📊 Verifica dimensioni database..."
ls -lh ./devflow.sqlite ./data/devflow.sqlite ./data/vector.sqlite

echo "✅ Verifica rollback completata"
```

---

## 5. Monitoraggio e Manutenzione

### 5.1 Dashboard di Monitoraggio
```typescript
// Script: monitoring_dashboard.ts
import { Database } from 'sqlite3';
import * as fs from 'fs';

class UnifiedDatabaseMonitor {
    private db: Database;

    constructor(dbPath: string) {
        this.db = new Database(dbPath);
    }

    async generateReport(): Promise<any> {
        const report = {
            timestamp: new Date().toISOString(),
            database: {
                size: await this.getDatabaseSize(),
                integrity: await this.checkIntegrity(),
                performance: await this.checkPerformance()
            },
            statistics: await this.getStatistics(),
            health: await this.checkHealth()
        };

        return report;
    }

    async getDatabaseSize(): Promise<any> {
        const stats = fs.statSync('./data/devflow_unified.sqlite');
        return {
            bytes: stats.size,
            mb: (stats.size / 1024 / 1024).toFixed(2),
            lastModified: stats.mtime
        };
    }

    async checkIntegrity(): Promise<any> {
        return new Promise((resolve, reject) => {
            this.db.all("PRAGMA integrity_check", (err, rows) => {
                if (err) reject(err);
                else resolve({
                    passed: rows.length === 1 && rows[0] === 'ok',
                    details: rows
                });
            });
        });
    }

    async checkPerformance(): Promise<any> {
        const tests = [
            { name: 'project_count', query: 'SELECT COUNT(*) as count FROM projects' },
            { name: 'task_count', query: 'SELECT COUNT(*) as count FROM tasks' },
            { name: 'memory_count', query: 'SELECT COUNT(*) as count FROM memories' },
            { name: 'embedding_count', query: 'SELECT COUNT(*) as count FROM memory_block_embeddings' },
            { name: 'vector_memory_count', query: 'SELECT COUNT(*) as count FROM vector_memories' }
        ];

        const results: any = {};

        for (const test of tests) {
            const start = Date.now();
            const result = await new Promise((resolve, reject) => {
                this.db.get(test.query, (err, row: any) => {
                    if (err) reject(err);
                    else resolve(row.count);
                });
            });
            const duration = Date.now() - start;

            results[test.name] = {
                count: result,
                queryTime: duration
            };
        }

        return results;
    }

    async getStatistics(): Promise<any> {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT
                    (SELECT COUNT(*) FROM projects) as total_projects,
                    (SELECT COUNT(*) FROM projects WHERE status = 'active') as active_projects,
                    (SELECT COUNT(*) FROM projects WHERE status = 'completed') as completed_projects,
                    (SELECT COUNT(*) FROM plans) as total_plans,
                    (SELECT COUNT(*) FROM tasks) as total_tasks,
                    (SELECT COUNT(*) FROM tasks WHERE status = 'completed') as completed_tasks,
                    (SELECT COUNT(*) FROM task_contexts) as total_task_contexts,
                    (SELECT COUNT(*) FROM memories) as total_memories,
                    (SELECT COUNT(*) FROM sessions) as total_sessions,
                    (SELECT COUNT(*) FROM memory_block_embeddings) as total_embeddings,
                    (SELECT COUNT(*) FROM vector_memories) as total_vector_memories,
                    (SELECT COUNT(*) FROM audit_log) as total_audit_records
            `;

            this.db.get(query, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async checkHealth(): Promise<any> {
        const issues = [];

        // Verifica FK
        const fkCheck = await new Promise((resolve, reject) => {
            this.db.all("PRAGMA foreign_key_check", (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        if ((fkCheck as any[]).length > 0) {
            issues.push('Foreign key violations detected');
        }

        // Verifica embeddings orfani
        const orphanEmbeddings = await new Promise((resolve, reject) => {
            this.db.get(`
                SELECT COUNT(*) as count
                FROM memory_block_embeddings e
                LEFT JOIN task_contexts tc ON e.block_id = tc.id
                WHERE tc.id IS NULL
            `, (err, row: any) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });

        if (orphanEmbeddings > 0) {
            issues.push(`${orphanEmbeddings} orphaned embeddings found`);
        }

        return {
            healthy: issues.length === 0,
            issues: issues
        };
    }
}

// Esportazione del report
async function generateMonitoringReport() {
    const monitor = new UnifiedDatabaseMonitor('./data/devflow_unified.sqlite');
    const report = await monitor.generateReport();

    // Salva report
    const reportPath = `./logs/monitoring_${new Date().toISOString().slice(0, 10)}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('Monitoring Report Generated:', reportPath);
    console.log(JSON.stringify(report, null, 2));
}
```

### 5.2 Manutenzione Automatica
```bash
#!/bin/bash
# Script: maintenance_routine.sh

echo "🔧 Avvio routine di manutenzione database unificato..."

# Backup giornaliero
BACKUP_DIR="./backups/daily/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"
cp ./data/devflow_unified.sqlite "$BACKUP_DIR/devflow_unified.sqlite"

# Ottimizzazione database
echo "⚡ Ottimizzazione database..."
sqlite3 ./data/devflow_unified.sqlite << EOF
PRAGMA optimize;
VACUUM;
ANALYZE;
EOF

# Pulizia audit log (mantieni solo ultimi 30 giorni)
echo "🧹 Pulizia audit log..."
sqlite3 ./data/devflow_unified.sqlite << EOF
DELETE FROM audit_log
WHERE timestamp < datetime('now', '-30 days');
EOF

# Pulizia log file
echo "📝 Rotazione log file..."
find ./logs -name "*.log" -mtime +7 -delete

# Generazione report monitoraggio
echo "📊 Generazione report monitoraggio..."
node -r ts-node/register scripts/monitoring_dashboard.ts

echo "✅ Manutenzione completata!"
```

---

## 6. Timeline di Implementazione

### Settimana 1: Preparazione e Backup
- **Giorno 1-2**: Setup ambiente di test e backup completo
- **Giorno 3-4**: Sviluppo script di migrazione e test
- **Giorno 5**: Validazione script su copia dati

### Settimana 2: Migrazione e Testing
- **Giorno 1**: Esecuzione migrazione in ambiente di test
- **Giorno 2-3**: Test intensivo funzionalità
- **Giorno 4**: Correzione issue e ottimizzazioni
- **Giorno 5**: Migrazione produzione

### Settimana 3: Ottimizzazione e Monitoring
- **Giorno 1-2**: Setup monitoraggio e dashboard
- **Giorno 3-4**: Ottimizzazione performance
- **Giorno 5**: Documentazione finale

---

## 7. Rischi e Mitigazioni

### 7.1 Rischi Identificati

| Rischio | Probabilità | Impatto | Mitigazione |
|---------|-------------|---------|-------------|
| Perdita dati durante migrazione | Bassa | Critico | Backup multipli + test su copie |
| Incompatibilità servizi | Media | Alto | Test estensivo + rollback plan |
| Performance degradate | Media | Medio | Ottimizzazione indici + monitoring |
| Corruzione database | Bassa | Critico | Validation checks + integrity tests |
| Downtime prolungato | Media | Alto | Migrazione graduale + rollback rapido |

### 7.2 Piani di Mitigazione

#### Backup Strategy
- Backup automatico ogni ora durante migrazione
- Backup completo pre-migrazione
- Backup incrementale post-migrazione
- Test restore procedure

#### Validation Strategy
- Checksum validation su tutti i dati
- Foreign key integrity checks
- Performance benchmark tests
- Functional API tests

#### Recovery Strategy
- Rollback completo in < 5 minuti
- Partial recovery per tabelle specifiche
- Data reconstruction da audit log
- Emergency contact procedures

---

## 8. Success Metrics

### 8.1 Metriche Tecniche
- **Integrità Dati**: 100% dati migrati senza perdite
- **Performance**: Query response time < 100ms per 95% operazioni
- **Uptime**: 99.9% availability post-migrazione
- **Storage**: Riduzione spazio utilizzato > 20%

### 8.2 Metriche Funzionali
- **Comandi CLI**: 100% comandi funzionanti
- **API Endpoints**: 100% endpoint operativi
- **Ricerca Semantica**: Response time < 500ms
- **Embedding Generation**: Success rate > 99%

### 8.3 Metriche di Business
- **User Experience**: Zero interruzioni significative
- **Development Velocity**: Nessun rallentamento team
- **Maintenance Cost**: Riduzione 30% effort manutenzione
- **Scalability**: Supporto per 10x volume dati corrente

---

## 9. Post-Implementation

### 9.1 Attività Immediate (Settimana 1)
- [ ] Monitoring 24/7 per prime 72 ore
- [ ] Daily performance reports
- [ ] User feedback collection
- [ ] Issue tracking e resolution

### 9.2 Attività Medio Termine (Mese 1)
- [ ] Performance optimization
- [ ] Additional indexing based on usage patterns
- [ ] Storage optimization
- [ ] Documentation updates

### 9.3 Attività Lungo Termine (Trimestre 1)
- [ ] Capacity planning
- [ ] Archive strategy implementation
- [ ] Advanced analytics setup
- [ ] Disaster recovery testing

---

## 10. Conclusioni

Questo piano di unificazione e migrazione database fornisce una roadmap dettagliata per consolidare l'architettura dati di DevFlow in un sistema unificato, performante e manutenibile. L'implementazione graduale e i controlli di qualità garantiscono una transizione sicura mantenendo la continuità operativa.

### Benefici Attesi
1. **Architettura Semplificata**: Un singolo database invece di tre separati
2. **Performance Migliorate**: Indici ottimizzati e query più efficienti
3. **Manutenzione Ridotta**: Procedure unificate e monitoring centralizzato
4. **Scalabilità Futura**: Schema progettato per crescita
5. **Context7 Compliance**: Organizzazione dati secondo best practice

### Next Steps
1. **Review del piano** con stakeholder
2. **Setup ambiente di test** per validazione
3. **Esecuzione pilota** su dataset ridotto
4. **Go/No-Go decision** basata su risultati pilota
5. **Implementazione produzione** seguendo timeline

---

**Documento creato**: 2025-09-22
**Versione**: 1.0
**Status**: Pronto per implementazione
**Review Required**: Team tecnico + Project Manager
**Approvazione Required**: Technical Lead + DevFlow Owner