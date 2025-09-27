#!/usr/bin/env node

import { Command } from 'commander';
import { Database } from 'sqlite3';
import { open } from 'sqlite';
import * as path from 'path';
import * as fs from 'fs';

// Interfaces for type safety
interface Project {
  id: number;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
}

interface Plan {
  id: number;
  project_id: number;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
}

interface Roadmap {
  id: number;
  plan_id: number;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
}

interface Task {
  id: number;
  roadmap_id: number;
  name: string;
  description: string;
  status: 'todo' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
}

interface Session {
  id: number;
  task_id: number;
  start_time: string;
  end_time: string | null;
  duration: number | null;
}

// Database setup
const DB_PATH = path.resolve(process.cwd(), 'data/devflow_unified.sqlite');

async function getDatabase() {
  try {
    const db = await open({
      filename: DB_PATH,
      driver: require('sqlite3').Database
    });
    return db;
  } catch (error) {
    console.error('Errore nella connessione al database:', error);
    process.exit(1);
  }
}

// Utility functions
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function calculateProgress(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

// Project management functions
async function createProject(name: string, description: string) {
  const db = await getDatabase();
  try {
    const result = await db.run(
      'INSERT INTO projects (name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [name, description, 'active', formatDate(new Date()), formatDate(new Date())]
    );
    console.log(`✅ Progetto "${name}" creato con ID: ${result.lastID}`);
    
    // Create default plan
    const planResult = await db.run(
      'INSERT INTO plans (project_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [result.lastID, 'Piano Principale', 'Piano principale del progetto', formatDate(new Date()), formatDate(new Date())]
    );
    
    console.log(`✅ Piano principale creato con ID: ${planResult.lastID}`);
  } catch (error) {
    console.error('❌ Errore nella creazione del progetto:', error);
  } finally {
    await db.close();
  }
}

async function getProjectStatus(projectId?: number) {
  const db = await getDatabase();
  try {
    let project: Project | undefined;
    
    if (projectId) {
      project = await db.get<Project>(
        'SELECT * FROM projects WHERE id = ?',
        [projectId]
      );
    } else {
      // Get the most recent active project
      project = await db.get<Project>(
        'SELECT * FROM projects WHERE status = "active" ORDER BY updated_at DESC LIMIT 1'
      );
    }

    if (!project) {
      console.log('❌ Nessun progetto attivo. Crea prima un progetto.');
      return;
    }

    // Get plans for this project
    const plans = await db.all<Plan[]>(
      'SELECT * FROM plans WHERE project_id = ?',
      [project.id]
    );

    console.log(`\n📊 === STATO PROGETTO: ${project.name} ===`);
    console.log(`📝 Descrizione: ${project.description}`);
    console.log(`🔄 Stato: ${project.status}`);
    console.log(`📅 Creato il: ${project.created_at}`);
    console.log(`🔄 Aggiornato il: ${project.updated_at}`);
    console.log(`📋 Piani associati: ${plans.length}`);

    // For each plan, show roadmaps and tasks
    for (const plan of plans) {
      console.log(`\n  📋 Piano: ${plan.name}`);
      const roadmaps = await db.all<Roadmap[]>(
        'SELECT * FROM roadmaps WHERE plan_id = ?',
        [plan.id]
      );

      for (const roadmap of roadmaps) {
        console.log(`    🗺️ Roadmap: ${roadmap.name}`);
        const tasks = await db.all<Task[]>(
          'SELECT * FROM tasks WHERE roadmap_id = ?',
          [roadmap.id]
        );

        const completedTasks = tasks.filter(t => t.status === 'completed').length;
        const progress = calculateProgress(completedTasks, tasks.length);

        console.log(`      ✅ Task totali: ${tasks.length}`);
        console.log(`      ✅ Task completati: ${completedTasks}`);
        console.log(`      📊 Progresso: ${progress}%`);
      }
    }
  } catch (error) {
    console.error('❌ Errore nel recupero dello stato del progetto:', error);
  } finally {
    await db.close();
  }
}

// CLI setup
const program = new Command();

program
  .name('devflow-project')
  .description('CLI per la gestione di progetti DevFlow')
  .version('1.0.0');

// Project commands
program
  .command('crea')
  .description('Crea un nuovo progetto')
  .argument('<nome>', 'Nome del progetto')
  .argument('[descrizione]', 'Descrizione del progetto', '')
  .action(async (nome, descrizione) => {
    await createProject(nome, descrizione);
  });

program
  .command('stato')
  .description('Mostra lo stato del progetto attivo')
  .argument('[id]', 'ID del progetto (opzionale)')
  .action(async (id) => {
    let projectId: number | undefined;
    if (id) {
      projectId = parseInt(id, 10);
      if (isNaN(projectId)) {
        console.log('❌ ID progetto non valido');
        return;
      }
    }
    await getProjectStatus(projectId);
  });

// Error handling
program.on('command:*', () => {
  console.error('❌ Comando non riconosciuto: %s', program.args.join(' '));
  console.log('📖 Usa --help per la lista dei comandi disponibili.');
  process.exit(1);
});

// Main execution
async function main() {
  program.parse();
}

if (require.main === module) {
  main().catch(console.error);
}

export { createProject, getProjectStatus };