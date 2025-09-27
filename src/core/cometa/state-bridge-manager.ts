// src/state-bridge/StateBridgeManager.ts

import { promises as fs } from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import chokidar from 'chokidar';
import { CometaSQLite } from '../database/CometaSQLite';
import { Logger } from '../utils/Logger';
import { TaskState, CCSessionsState, TodoWriteState } from '../types/StateTypes';

/**
 * State Bridge Manager - Sincronizza stati tra sistemi legacy e Cometa SQLite
 * 
 * Responsabilità:
 * - Sync bidirezionale current_task.json <-> CometaSQLite
 * - Gestione protocollo cc-sessions
 * - Bridge per lo stato TodoWrite
 * - Monitoraggio cambiamenti file system
 * - Auto-recovery in caso di conflitti
 */
export class StateBridgeManager extends EventEmitter {
  private currentTaskPath: string;
  private ccSessionsPath: string;
  private todoWritePath: string;
  private db: CometaSQLite;
  private logger: Logger;
  private fileWatcher: chokidar.FSWatcher | null = null;
  private isSyncing: boolean = false;
  private lastSyncTimestamp: number = 0;

  constructor(
    private config: {
      currentTaskPath: string;
      ccSessionsPath: string;
      todoWritePath: string;
      db: CometaSQLite;
      logger: Logger;
    }
  ) {
    super();
    this.currentTaskPath = config.currentTaskPath;
    this.ccSessionsPath = config.ccSessionsPath;
    this.todoWritePath = config.todoWritePath;
    this.db = config.db;
    this.logger = config.logger;
  }

  /**
   * Inizializza il bridge manager
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing State Bridge Manager');
      
      // Verifica esistenza directory
      await this.ensureDirectoriesExist();
      
      // Inizializza watcher per i file
      this.initializeFileWatcher();
      
      // Esegue sync iniziale
      await this.performInitialSync();
      
      this.logger.info('State Bridge Manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize State Bridge Manager', error);
      throw error;
    }
  }

  /**
   * Verifica che le directory necessarie esistano
   */
  private async ensureDirectoriesExist(): Promise<void> {
    const directories = [
      path.dirname(this.currentTaskPath),
      path.dirname(this.ccSessionsPath),
      path.dirname(this.todoWritePath)
    ];

    for (const dir of directories) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
        this.logger.info(`Created directory: ${dir}`);
      }
    }
  }

  /**
   * Inizializza il watcher per i cambiamenti dei file
   */
  private initializeFileWatcher(): void {
    this.fileWatcher = chokidar.watch([
      this.currentTaskPath,
      this.ccSessionsPath,
      this.todoWritePath
    ], {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });

    this.fileWatcher
      .on('change', (filePath) => this.handleFileChange(filePath))
      .on('error', (error) => {
        this.logger.error('File watcher error', error);
        this.emit('error', error);
      });

    this.logger.info('File watcher initialized');
  }

  /**
   * Esegue la sincronizzazione iniziale
   */
  private async performInitialSync(): Promise<void> {
    this.logger.info('Performing initial state synchronization');
    
    try {
      // Sync current_task.json
      await this.syncCurrentTask();
      
      // Sync cc-sessions
      await this.syncCCSessions();
      
      // Sync todo-write
      await this.syncTodoWrite();
      
      this.lastSyncTimestamp = Date.now();
      this.logger.info('Initial synchronization completed');
    } catch (error) {
      this.logger.error('Initial synchronization failed', error);
      throw error;
    }
  }

  /**
   * Gestisce i cambiamenti ai file monitorati
   */
  private async handleFileChange(filePath: string): Promise<void> {
    if (this.isSyncing) {
      this.logger.debug('Sync already in progress, skipping file change event');
      return;
    }

    this.logger.info(`File change detected: ${filePath}`);
    
    try {
      this.isSyncing = true;
      
      switch (filePath) {
        case this.currentTaskPath:
          await this.syncCurrentTask();
          break;
        case this.ccSessionsPath:
          await this.syncCCSessions();
          break;
        case this.todoWritePath:
          await this.syncTodoWrite();
          break;
        default:
          this.logger.warn(`Unknown file change: ${filePath}`);
      }
      
      this.lastSyncTimestamp = Date.now();
      this.emit('syncComplete', filePath);
    } catch (error) {
      this.logger.error(`Failed to sync file: ${filePath}`, error);
      this.emit('syncError', error, filePath);
      
      // Tentativo di auto-recovery
      await this.attemptRecovery(filePath, error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sincronizza lo stato current_task.json
   */
  private async syncCurrentTask(): Promise<void> {
    this.logger.debug('Syncing current_task.json');
    
    try {
      // Legge lo stato dal file
      const fileState = await this.readCurrentTaskFromFile();
      
      // Legge lo stato dal database
      const dbState = await this.db.getCurrentTaskState();
      
      // Determina la direzione della sincronizzazione
      const syncDirection = this.determineSyncDirection(fileState, dbState);
      
      if (syncDirection === 'file-to-db') {
        this.logger.info('Syncing current_task: file -> database');
        await this.db.updateCurrentTaskState(fileState);
        this.emit('currentTaskSynced', { direction: 'file-to-db', state: fileState });
      } else if (syncDirection === 'db-to-file') {
        this.logger.info('Syncing current_task: database -> file');
        await this.writeCurrentTaskToFile(dbState);
        this.emit('currentTaskSynced', { direction: 'db-to-file', state: dbState });
      } else {
        this.logger.debug('No sync needed for current_task');
      }
    } catch (error) {
      this.logger.error('Failed to sync current_task', error);
      throw error;
    }
  }

  /**
   * Legge lo stato current_task dal file
   */
  private async readCurrentTaskFromFile(): Promise<TaskState> {
    try {
      const data = await fs.readFile(this.currentTaskPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File non esiste, ritorna stato vuoto
        return { taskId: null, status: 'idle', timestamp: Date.now() };
      }
      throw error;
    }
  }

  /**
   * Scrive lo stato current_task sul file
   */
  private async writeCurrentTaskToFile(state: TaskState): Promise<void> {
    const data = JSON.stringify(state, null, 2);
    await fs.writeFile(this.currentTaskPath, data, 'utf8');
  }

  /**
   * Sincronizza lo stato cc-sessions
   */
  private async syncCCSessions(): Promise<void> {
    this.logger.debug('Syncing cc-sessions');
    
    try {
      // Legge lo stato dal file
      const fileState = await this.readCCSessionsFromFile();
      
      // Legge lo stato dal database
      const dbState = await this.db.getCCSessionsState();
      
      // Determina la direzione della sincronizzazione
      const syncDirection = this.determineSyncDirection(fileState, dbState);
      
      if (syncDirection === 'file-to-db') {
        this.logger.info('Syncing cc-sessions: file -> database');
        await this.db.updateCCSessionsState(fileState);
        this.emit('ccSessionsSynced', { direction: 'file-to-db', state: fileState });
      } else if (syncDirection === 'db-to-file') {
        this.logger.info('Syncing cc-sessions: database -> file');
        await this.writeCCSessionsToFile(dbState);
        this.emit('ccSessionsSynced', { direction: 'db-to-file', state: dbState });
      } else {
        this.logger.debug('No sync needed for cc-sessions');
      }
    } catch (error) {
      this.logger.error('Failed to sync cc-sessions', error);
      throw error;
    }
  }

  /**
   * Legge lo stato cc-sessions dal file
   */
  private async readCCSessionsFromFile(): Promise<CCSessionsState> {
    try {
      const data = await fs.readFile(this.ccSessionsPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File non esiste, ritorna stato vuoto
        return { sessions: [], activeSession: null, timestamp: Date.now() };
      }
      throw error;
    }
  }

  /**
   * Scrive lo stato cc-sessions sul file
   */
  private async writeCCSessionsToFile(state: CCSessionsState): Promise<void> {
    const data = JSON.stringify(state, null, 2);
    await fs.writeFile(this.ccSessionsPath, data, 'utf8');
  }

  /**
   * Sincronizza lo stato todo-write
   */
  private async syncTodoWrite(): Promise<void> {
    this.logger.debug('Syncing todo-write state');
    
    try {
      // Legge lo stato dal file
      const fileState = await this.readTodoWriteFromFile();
      
      // Legge lo stato dal database
      const dbState = await this.db.getTodoWriteState();
      
      // Determina la direzione della sincronizzazione
      const syncDirection = this.determineSyncDirection(fileState, dbState);
      
      if (syncDirection === 'file-to-db') {
        this.logger.info('Syncing todo-write: file -> database');
        await this.db.updateTodoWriteState(fileState);
        this.emit('todoWriteSynced', { direction: 'file-to-db', state: fileState });
      } else if (syncDirection === 'db-to-file') {
        this.logger.info('Syncing todo-write: database -> file');
        await this.writeTodoWriteToFile(dbState);
        this.emit('todoWriteSynced', { direction: 'db-to-file', state: dbState });
      } else {
        this.logger.debug('No sync needed for todo-write');
      }
    } catch (error) {
      this.logger.error('Failed to sync todo-write', error);
      throw error;
    }
  }

  /**
   * Legge lo stato todo-write dal file
   */
  private async readTodoWriteFromFile(): Promise<TodoWriteState> {
    try {
      const data = await fs.readFile(this.todoWritePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File non esiste, ritorna stato vuoto
        return { items: [], lastWrite: null, timestamp: Date.now() };
      }
      throw error;
    }
  }

  /**
   * Scrive lo stato todo-write sul file
   */
  private async writeTodoWriteToFile(state: TodoWriteState): Promise<void> {
    const data = JSON.stringify(state, null, 2);
    await fs.writeFile(this.todoWritePath, data, 'utf8');
  }

  /**
   * Determina la direzione della sincronizzazione
   */
  private determineSyncDirection<T extends { timestamp: number }>(
    fileState: T,
    dbState: T
  ): 'file-to-db' | 'db-to-file' | 'none' {
    // Se uno degli stati è null/undefined, sincronizza dall'altro
    if (!fileState && dbState) return 'db-to-file';
    if (fileState && !dbState) return 'file-to-db';
    if (!fileState && !dbState) return 'none';
    
    // Confronta i timestamp
    if (fileState.timestamp > dbState.timestamp) {
      return 'file-to-db';
    } else if (dbState.timestamp > fileState.timestamp) {
      return 'db-to-file';
    }
    
    return 'none'; // Nessuna sincronizzazione necessaria
  }

  /**
   * Tentativo di auto-recovery in caso di errore
   */
  private async attemptRecovery(filePath: string, error: unknown): Promise<void> {
    this.logger.warn(`Attempting recovery for: ${filePath}`);
    
    try {
      // Backup del file corrotto
      await this.backupCorruptedFile(filePath);
      
      // Ricostruisce lo stato dal database
      await this.reconstructStateFromFileSystem(filePath);
      
      this.logger.info(`Recovery successful for: ${filePath}`);
      this.emit('recoveryComplete', filePath);
    } catch (recoveryError) {
      this.logger.error(`Recovery failed for: ${filePath}`, recoveryError);
      this.emit('recoveryFailed', recoveryError, filePath);
      throw recoveryError;
    }
  }

  /**
   * Crea un backup del file corrotto
   */
  private async backupCorruptedFile(filePath: string): Promise<void> {
    try {
      const backupPath = `${filePath}.backup.${Date.now()}`;
      await fs.copyFile(filePath, backupPath);
      this.logger.info(`Backup created: ${backupPath}`);
    } catch (error) {
      this.logger.warn(`Failed to create backup for: ${filePath}`, error);
    }
  }

  /**
   * Ricostruisce lo stato dal database
   */
  private async reconstructStateFromFileSystem(filePath: string): Promise<void> {
    switch (filePath) {
      case this.currentTaskPath: {
        const dbState = await this.db.getCurrentTaskState();
        await this.writeCurrentTaskToFile(dbState);
        break;
      }
      case this.ccSessionsPath: {
        const dbState = await this.db.getCCSessionsState();
        await this.writeCCSessionsToFile(dbState);
        break;
      }
      case this.todoWritePath: {
        const dbState = await this.db.getTodoWriteState();
        await this.writeTodoWriteToFile(dbState);
        break;
      }
      default:
        throw new Error(`Unknown file path for reconstruction: ${filePath}`);
    }
  }

  /**
   * Forza una sincronizzazione completa
   */
  async forceSync(): Promise<void> {
    this.logger.info('Forcing full synchronization');
    
    try {
      this.isSyncing = true;
      
      await this.syncCurrentTask();
      await this.syncCCSessions();
      await this.syncTodoWrite();
      
      this.lastSyncTimestamp = Date.now();
      this.emit('forceSyncComplete');
    } catch (error) {
      this.logger.error('Force sync failed', error);
      this.emit('forceSyncError', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Restituisce lo stato del bridge
   */
  getBridgeStatus(): {
    isSyncing: boolean;
    lastSync: number;
    isInitialized: boolean;
  } {
    return {
      isSyncing: this.isSyncing,
      lastSync: this.lastSyncTimestamp,
      isInitialized: this.fileWatcher !== null
    };
  }

  /**
   * Chiude il bridge manager
   */
  async close(): Promise<void> {
    this.logger.info('Closing State Bridge Manager');
    
    if (this.fileWatcher) {
      await this.fileWatcher.close();
      this.fileWatcher = null;
    }
    
    this.removeAllListeners();
    this.logger.info('State Bridge Manager closed');
  }
}