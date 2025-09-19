/**
 * Project Lifecycle Manager - Gestione gerarchica di progetti
 * 
 * Questo modulo fornisce funzionalità complete per la gestione del ciclo di vita
 * dei progetti, inclusa la creazione automatica della gerarchia, avanzamento degli stati,
 * gestione delle dipendenze e calcolo del progresso aggregato.
 */

import { Database } from 'sqlite3';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// Tipi e interfacce principali

/**
 * Enumerazione degli stati possibili per un elemento del progetto
 */
export enum ProjectStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

/**
 * Tipi di elementi gerarchici
 */
export enum ElementType {
  PROJECT = 'project',
  ROADMAP = 'roadmap',
  PLAN = 'plan',
  MACRO_TASK = 'macro_task',
  TASK = 'task'
}

/**
 * Interfaccia per un elemento del progetto
 */
export interface ProjectElement {
  id: string;
  parentId?: string;
  type: ElementType;
  name: string;
  description?: string;
  status: ProjectStatus;
  progress: number; // 0-100
  startDate?: Date;
  endDate?: Date;
  dependencies: string[]; // IDs degli elementi da cui dipende
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interfaccia per le notifiche di cambiamento stato
 */
export interface StatusChangeNotification {
  elementId: string;
  elementType: ElementType;
  oldStatus: ProjectStatus;
  newStatus: ProjectStatus;
  timestamp: Date;
  triggeredBy?: string; // ID dell'elemento che ha causato il cambiamento
}

/**
 * Configurazione del Project Lifecycle Manager
 */
export interface PLMConfig {
  databasePath: string;
  enableNotifications: boolean;
  autoDependencyResolution: boolean;
  claudeCodeHooks: boolean;
}

/**
 * Risultato del calcolo del progresso aggregato
 */
export interface AggregatedProgress {
  totalElements: number;
  completedElements: number;
  overallProgress: number;
  byType: Record<ElementType, { count: number; progress: number }>;
}

/**
 * Project Lifecycle Manager
 * 
 * Classe principale per la gestione del ciclo di vita dei progetti
 */
export class ProjectLifecycleManager extends EventEmitter {
  private db: Database;
  private config: PLMConfig;
  private initialized: boolean = false;

  constructor(config: PLMConfig) {
    super();
    this.config = config;
    this.db = new Database(config.databasePath);
  }

  /**
   * Inizializza il manager e il database
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.setupDatabase();
      this.initialized = true;
      console.log('Project Lifecycle Manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Project Lifecycle Manager:', error);
      throw error;
    }
  }

  /**
   * Configura lo schema del database
   */
  private async setupDatabase(): Promise<void> {
    const schema = `
      CREATE TABLE IF NOT EXISTS project_elements (
        id TEXT PRIMARY KEY,
        parent_id TEXT,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        progress REAL NOT NULL DEFAULT 0,
        start_date DATETIME,
        end_date DATETIME,
        dependencies TEXT, -- JSON array
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        FOREIGN KEY(parent_id) REFERENCES project_elements(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_parent_id ON project_elements(parent_id);
      CREATE INDEX IF NOT EXISTS idx_type ON project_elements(type);
      CREATE INDEX IF NOT EXISTS idx_status ON project_elements(status);
    `;

    return new Promise((resolve, reject) => {
      this.db.exec(schema, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Crea un nuovo elemento del progetto
   */
  async createElement(element: Omit<ProjectElement, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProjectElement> {
    this.validateElement(element);
    
    const newElement: ProjectElement = {
      id: uuidv4(),
      ...element,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const query = `
      INSERT INTO project_elements 
      (id, parent_id, type, name, description, status, progress, start_date, end_date, dependencies, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      newElement.id,
      newElement.parentId || null,
      newElement.type,
      newElement.name,
      newElement.description || null,
      newElement.status,
      newElement.progress,
      newElement.startDate?.toISOString() || null,
      newElement.endDate?.toISOString() || null,
      JSON.stringify(newElement.dependencies),
      newElement.createdAt.toISOString(),
      newElement.updatedAt.toISOString()
    ];

    return new Promise((resolve, reject) => {
      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(newElement);
        }
      });
    });
  }

  /**
   * Crea una gerarchia completa di progetto automaticamente
   */
  async createProjectHierarchy(projectName: string, description?: string): Promise<ProjectElement> {
    // Creazione del progetto principale
    const project = await this.createElement({
      type: ElementType.PROJECT,
      name: projectName,
      description,
      status: ProjectStatus.PLANNED,
      progress: 0,
      dependencies: []
    });

    // Creazione della roadmap
    const roadmap = await this.createElement({
      parentId: project.id,
      type: ElementType.ROADMAP,
      name: `${projectName} - Roadmap`,
      status: ProjectStatus.PLANNED,
      progress: 0,
      dependencies: []
    });

    // Creazione del piano principale
    const plan = await this.createElement({
      parentId: project.id,
      type: ElementType.PLAN,
      name: `${projectName} - Execution Plan`,
      status: ProjectStatus.PLANNED,
      progress: 0,
      dependencies: [roadmap.id]
    });

    console.log(`Created project hierarchy for ${projectName} with ID ${project.id}`);
    return project;
  }

  /**
   * Aggiunge una macro task a un piano esistente
   */
  async addMacroTask(planId: string, taskName: string, description?: string): Promise<ProjectElement> {
    // Verifica che il piano esista
    const plan = await this.getElementById(planId);
    if (!plan || plan.type !== ElementType.PLAN) {
      throw new Error(`Plan with ID ${planId} not found or invalid type`);
    }

    return this.createElement({
      parentId: planId,
      type: ElementType.MACRO_TASK,
      name: taskName,
      description,
      status: ProjectStatus.PLANNED,
      progress: 0,
      dependencies: []
    });
  }

  /**
   * Recupera un elemento per ID
   */
  async getElementById(id: string): Promise<ProjectElement | null> {
    const query = `SELECT * FROM project_elements WHERE id = ?`;
    
    return new Promise((resolve, reject) => {
      this.db.get(query, [id], (err, row: any) => {
        if (err) {
          reject(err);
        } else if (!row) {
          resolve(null);
        } else {
          resolve(this.rowToProjectElement(row));
        }
      });
    });
  }

  /**
   * Recupera tutti gli elementi figlio di un elemento
   */
  async getChildElements(parentId: string): Promise<ProjectElement[]> {
    const query = `SELECT * FROM project_elements WHERE parent_id = ? ORDER BY type, name`;
    
    return new Promise((resolve, reject) => {
      this.db.all(query, [parentId], (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => this.rowToProjectElement(row)));
        }
      });
    });
  }

  /**
   * Aggiorna lo stato di un elemento
   */
  async updateElementStatus(
    elementId: string, 
    newStatus: ProjectStatus, 
    triggeredBy?: string
  ): Promise<ProjectElement> {
    const element = await this.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with ID ${elementId} not found`);
    }

    const oldStatus = element.status;
    
    // Aggiorna l'elemento nel database
    const query = `
      UPDATE project_elements 
      SET status = ?, updated_at = ?
      WHERE id = ?
    `;
    
    const params = [
      newStatus,
      new Date().toISOString(),
      elementId
    ];

    return new Promise((resolve, reject) => {
      this.db.run(query, params, async (err) => {
        if (err) {
          reject(err);
        } else {
          const updatedElement = { ...element, status: newStatus, updatedAt: new Date() };
          
          // Emetti notifica di cambiamento stato
          if (this.config.enableNotifications) {
            const notification: StatusChangeNotification = {
              elementId,
              elementType: element.type,
              oldStatus,
              newStatus,
              timestamp: new Date(),
              triggeredBy
            };
            
            this.emit('statusChange', notification);
            
            // Esegui hook Claude Code se abilitato
            if (this.config.claudeCodeHooks) {
              await this.executeClaudeCodeHook(elementId, oldStatus, newStatus);
            }
          }
          
          // Gestisci le dipendenze automatiche se abilitato
          if (this.config.autoDependencyResolution) {
            await this.resolveDependencies(elementId, newStatus);
          }
          
          resolve(updatedElement);
        }
      });
    });
  }

  /**
   * Calcola il progresso aggregato per un elemento e tutta la sua gerarchia
   */
  async calculateAggregatedProgress(elementId: string): Promise<AggregatedProgress> {
    const element = await this.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with ID ${elementId} not found`);
    }

    const allElements = await this.getAllDescendants(elementId);
    allElements.unshift(element); // Include l'elemento radice

    const progressByType: Record<ElementType, { count: number; progress: number }> = {
      [ElementType.PROJECT]: { count: 0, progress: 0 },
      [ElementType.ROADMAP]: { count: 0, progress: 0 },
      [ElementType.PLAN]: { count: 0, progress: 0 },
      [ElementType.MACRO_TASK]: { count: 0, progress: 0 },
      [ElementType.TASK]: { count: 0, progress: 0 }
    };

    let totalProgress = 0;
    let completedElements = 0;

    for (const elem of allElements) {
      progressByType[elem.type].count++;
      progressByType[elem.type].progress += elem.progress;
      
      totalProgress += elem.progress;
      
      if (elem.status === ProjectStatus.COMPLETED) {
        completedElements++;
      }
    }

    // Calcola le medie per tipo
    Object.values(ElementType).forEach(type => {
      if (progressByType[type].count > 0) {
        progressByType[type].progress = progressByType[type].progress / progressByType[type].count;
      }
    });

    return {
      totalElements: allElements.length,
      completedElements,
      overallProgress: totalProgress / allElements.length,
      byType: progressByType
    };
  }

  /**
   * Recupera tutti i discendenti di un elemento
   */
  private async getAllDescendants(parentId: string): Promise<ProjectElement[]> {
    const children = await this.getChildElements(parentId);
    let allDescendants: ProjectElement[] = [...children];
    
    for (const child of children) {
      const descendants = await this.getAllDescendants(child.id);
      allDescendants = allDescendants.concat(descendants);
    }
    
    return allDescendants;
  }

  /**
   * Converte una riga del database in un ProjectElement
   */
  private rowToProjectElement(row: any): ProjectElement {
    return {
      id: row.id,
      parentId: row.parent_id || undefined,
      type: row.type as ElementType,
      name: row.name,
      description: row.description || undefined,
      status: row.status as ProjectStatus,
      progress: row.progress,
      startDate: row.start_date ? new Date(row.start_date) : undefined,
      endDate: row.end_date ? new Date(row.end_date) : undefined,
      dependencies: row.dependencies ? JSON.parse(row.dependencies) : [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Valida l'integrità di un elemento del progetto
   */
  private validateElement(element: Partial<ProjectElement>): void {
    if (!element.type) {
      throw new Error('Element type is required');
    }
    
    if (!element.name) {
      throw new Error('Element name is required');
    }
    
    if (element.parentId) {
      // Validazione della gerarchia
      this.validateHierarchy(element.parentId, element.type);
    }
    
    if (element.progress !== undefined && (element.progress < 0 || element.progress > 100)) {
      throw new Error('Progress must be between 0 and 100');
    }
  }

  /**
   * Valida la struttura gerarchica
   */
  private validateHierarchy(parentId: string, childType: ElementType): void {
    // Regole di gerarchia:
    // PROJECT -> ROADMAP, PLAN
    // ROADMAP -> (nessun figlio diretto)
    // PLAN -> MACRO_TASK
    // MACRO_TASK -> TASK
    // TASK -> (nessun figlio)
    
    const validChildren: Record<ElementType, ElementType[]> = {
      [ElementType.PROJECT]: [ElementType.ROADMAP, ElementType.PLAN],
      [ElementType.ROADMAP]: [],
      [ElementType.PLAN]: [ElementType.MACRO_TASK],
      [ElementType.MACRO_TASK]: [ElementType.TASK],
      [ElementType.TASK]: []
    };
    
    // Questa validazione richiederebbe un check nel database
    // per ottenere il tipo del parent, semplificata qui per esempio
  }

  /**
   * Risolve automaticamente le dipendenze quando un elemento cambia stato
   */
  private async resolveDependencies(elementId: string, newStatus: ProjectStatus): Promise<void> {
    if (newStatus !== ProjectStatus.COMPLETED) {
      return;
    }

    // Trova tutti gli elementi che dipendono da questo
    const query = `SELECT * FROM project_elements WHERE dependencies LIKE ?`;
    const dependencyPattern = `%${elementId}%`;
    
    return new Promise((resolve, reject) => {
      this.db.all(query, [dependencyPattern], async (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        
        try {
          for (const row of rows) {
            const element = this.rowToProjectElement(row);
            const allDependenciesSatisfied = await this.checkDependenciesSatisfied(element);
            
            if (allDependenciesSatisfied && element.status === ProjectStatus.PLANNED) {
              // Aggiorna automaticamente lo stato a IN_PROGRESS
              await this.updateElementStatus(
                element.id, 
                ProjectStatus.IN_PROGRESS, 
                elementId
              );
            }
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Verifica se tutte le dipendenze di un elemento sono soddisfatte
   */
  private async checkDependenciesSatisfied(element: ProjectElement): Promise<boolean> {
    for (const dependencyId of element.dependencies) {
      const dependency = await this.getElementById(dependencyId);
      if (!dependency || dependency.status !== ProjectStatus.COMPLETED) {
        return false;
      }
    }
    return true;
  }

  /**
   * Esegue un hook Claude Code (simulazione)
   */
  private async executeClaudeCodeHook(
    elementId: string, 
    oldStatus: ProjectStatus, 
    newStatus: ProjectStatus
  ): Promise<void> {
    // Simulazione di integrazione con Claude Code hooks
    console.log(`Claude Code hook executed for element ${elementId}: ${oldStatus} -> ${newStatus}`);
    
    // In un'implementazione reale, qui si chiamerebbe l'API di Claude Code
    // o si eseguirebbe uno script personalizzato
  }

  /**
   * Chiude la connessione al database
   */
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.initialized = false;
          resolve();
        }
      });
    });
  }
}

// Export per l'utilizzo esterno
export default ProjectLifecycleManager;