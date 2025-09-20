#!/usr/bin/env node

const { Command } = require('commander');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

/**
 * cometa-gemini-cli.js
 * 
 * Interfaccia a riga di comando per interagire con il database Cometa (devflow.sqlite).
 * Progettato per essere chiamato dall'agente Gemini CLI via `run_shell_command`.
 * 
 * Prerequisiti:
 * 1. Node.js installato.
 * 2. Le librerie `better-sqlite3` and `commander` devono essere installate nel progetto:
 *    npm install better-sqlite3 commander
 * 3. La variabile d'ambiente `DEVFLOW_DB_PATH` deve puntare al file devflow.sqlite.
 */

// --- UTILITY FUNCTIONS ---

function printJSON(data) {
  process.stdout.write(JSON.stringify(data, null, 2));
}

function printError(message) {
  process.stderr.write(JSON.stringify({ error: message }));
  process.exit(1);
}

// --- DATABASE SETUP ---

const dbPath = process.env.DEVFLOW_DB_PATH;
if (!dbPath) {
  printError("La variabile d'ambiente DEVFLOW_DB_PATH non è impostata.");
}

let db;
try {
  db = new Database(path.resolve(process.cwd(), dbPath), { fileMustExist: true });
} catch (err) {
  printError(`Errore di connessione al database: ${err.message}`);
}

// --- CLI PROGRAM DEFINITION ---

const program = new Command();
program
  .name('cometa-gemini-cli')
  .description('CLI per interagire con il database Cometa.');

// --- SESSION COMMANDS ---

program.command('session:create')
  .description('Crea una nuova sessione di coordinamento.')
  .option('-p, --platform <platform>', 'Piattaforma che ha avviato la sessione', 'gemini-cli')
  .option('-t, --task-id <taskId>', 'ID del task associato')
  .action((options) => {
    try {
      const id = crypto.randomUUID();
      const stmt = db.prepare(
        'INSERT INTO coordination_sessions (id, platform, task_id) VALUES (?, ?, ?)'
      );
      stmt.run(id, options.platform, options.taskId);
      printJSON({ sessionId: id });
    } catch (err) {
      printError(`Errore durante la creazione della sessione: ${err.message}`);
    }
  });

// --- TASK COMMANDS ---

program.command('task:add')
  .description('Aggiunge un nuovo task a task_contexts.')
  .requiredOption('-t, --title <title>', 'Titolo del task')
  .option('-d, --description <description>', 'Descrizione del task')
  .option('-s, --status <status>', 'Stato iniziale del task', 'pending')
  .option('-p, --priority <priority>', 'Priorità del task', 'medium')
  .option('--parent-id <parentId>', 'ID del macro_task o task_context genitore')
  .action((options) => {
    try {
      const id = crypto.randomUUID();
      const stmt = db.prepare(
        `INSERT INTO task_contexts (id, title, description, status, priority, parent_task_id)
         VALUES (@id, @title, @description, @status, @priority, @parentId)`
      );
      stmt.run({
        id,
        title: options.title,
        description: options.description,
        status: options.status,
        priority: options.priority,
        parentId: options.parentId,
      });
      printJSON({ taskId: id });
    } catch (err) {
      printError(`Errore durante l'aggiunta del task: ${err.message}`);
    }
  });

program.command('task:update')
  .description('Aggiorna un task esistente.')
  .requiredOption('--id <taskId>', 'ID del task da aggiornare')
  .option('-s, --status <status>', 'Nuovo stato del task (es. in_progress, completed)')
  .option('-d, --description <description>', 'Nuova descrizione')
  .action((options) => {
    try {
      if (options.status) {
        const stmt = db.prepare('UPDATE task_contexts SET status = ? WHERE id = ?');
        stmt.run(options.status, options.id);
      }
      if (options.description) {
        const stmt = db.prepare('UPDATE task_contexts SET description = ? WHERE id = ?');
        stmt.run(options.description, options.id);
      }
      printJSON({ success: true, taskId: options.id });
    } catch (err) {
      printError(`Errore durante l'aggiornamento del task: ${err.message}`);
    }
  });

// --- MEMORY COMMANDS ---

program.command('memory:save')
  .description('Salva un nuovo blocco di memoria.')
  .requiredOption('-c, --content <content>', 'Contenuto del blocco di memoria')
  .requiredOption('--type <type>', 'Tipo di memoria (es. snippet, decision, observation)')
  .option('--session-id <sessionId>', 'ID della sessione corrente')
  .option('--task-id <taskId>', 'ID del task associato')
  .option('--metadata <json>', 'Metadati in formato JSON', '{}')
  .action((options) => {
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const stmt = db.prepare(
        `INSERT INTO memory_blocks (id, content, type, timestamp, session_id, task_id, metadata, created_at, updated_at)
         VALUES (@id, @content, @type, @now, @sessionId, @taskId, @metadata, @now, @now)`
      );
      stmt.run({
        id,
        content: options.content,
        type: options.type,
        now,
        sessionId: options.sessionId,
        taskId: options.taskId,
        metadata: options.metadata,
      });
      printJSON({ memoryId: id });
    } catch (err) {
      printError(`Errore durante il salvataggio della memoria: ${err.message}`);
    }
  });

// --- SEARCH COMMAND ---

program.command('search')
  .description('Cerca nei task e nella memoria.')
  .requiredOption('-q, --query <query>', 'Termini di ricerca (usa la sintassi FTS5)')
  .action((options) => {
    try {
      const searchTasksStmt = db.prepare(`
        SELECT tc.id, tc.title, tc.description, tc.created_at
        FROM tasks_fts fts
        JOIN task_contexts tc ON fts.rowid = tc.rowid
        WHERE fts.tasks_fts MATCH ?
        ORDER BY fts.rank
      `);
      const taskResults = searchTasksStmt.all(options.query);

      const searchMemoryStmt = db.prepare(`
        SELECT mb.id, mb.content, mb.type, mb.created_at
        FROM memory_fts fts
        JOIN memory_blocks mb ON fts.rowid = mb.rowid
        WHERE fts.memory_fts MATCH ?
        ORDER BY fts.rank
      `);
      const memoryResults = searchMemoryStmt.all(options.query);

      printJSON({
        tasks: taskResults,
        memories: memoryResults,
      });

    } catch (err) {
      printError(`Errore durante la ricerca: ${err.message}`);
    }
  });


// --- PARSE AND EXECUTE ---

try {
  program.parse(process.argv);
} catch (err) {
  // L'errore di Commander viene già stampato, quindi usciamo
  process.exit(1);
} finally {
  if (db && db.open) {
    db.close();
  }
}
