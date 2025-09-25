import { EventEmitter } from 'events';

// Core system components
interface SystemConfig {
  debug: boolean;
  memoryLimit: number;
  taskTimeout: number;
}

interface Task {
  id: string;
  name: string;
  payload: any;
  priority: number;
  createdAt: Date;
}

interface MemoryEntry {
  key: string;
  value: any;
  timestamp: Date;
  ttl?: number;
}

/**
 * Main DevFlow Cognitive Task+Memory System
 */
class DevFlowSystem extends EventEmitter {
  private config: SystemConfig;
  private tasks: Map<string, Task> = new Map();
  private memory: Map<string, MemoryEntry> = new Map();
  private isInitialized: boolean = false;

  constructor(config?: Partial<SystemConfig>) {
    super();
    this.config = {
      debug: config?.debug ?? false,
      memoryLimit: config?.memoryLimit ?? 1000,
      taskTimeout: config?.taskTimeout ?? 30000
    };
  }

  /**
   * Initialize the DevFlow system
   */
  async initialize(): Promise<void> {
    try {
      if (this.config.debug) {
        console.log('Initializing DevFlow Cognitive Task+Memory System...');
      }
      
      // Initialize system components
      await this.initializeMemory();
      await this.initializeTaskManager();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      if (this.config.debug) {
        console.log('DevFlow system initialized successfully');
      }
    } catch (error) {
      this.handleError(error, 'System initialization failed');
    }
  }

  /**
   * Initialize memory subsystem
   */
  private async initializeMemory(): Promise<void> {
    // Memory initialization logic
    if (this.config.debug) {
      console.log('Memory subsystem initialized');
    }
  }

  /**
   * Initialize task management subsystem
   */
  private async initializeTaskManager(): Promise<void> {
    // Task manager initialization logic
    if (this.config.debug) {
      console.log('Task management subsystem initialized');
    }
  }

  /**
   * Create a new cognitive task
   */
  createTask(name: string, payload: any, priority: number = 1): Task {
    if (!this.isInitialized) {
      throw new Error('System not initialized. Call initialize() first.');
    }

    const taskId = this.generateId();
    const task: Task = {
      id: taskId,
      name,
      payload,
      priority,
      createdAt: new Date()
    };

    this.tasks.set(taskId, task);
    this.emit('taskCreated', task);
    
    if (this.config.debug) {
      console.log(`Task created: ${name} (${taskId})`);
    }
    
    return task;
  }

  /**
   * Store data in cognitive memory
   */
  storeMemory(key: string, value: any, ttl?: number): void {
    if (!this.isInitialized) {
      throw new Error('System not initialized. Call initialize() first.');
    }

    const entry: MemoryEntry = {
      key,
      value,
      timestamp: new Date(),
      ttl
    };

    this.memory.set(key, entry);
    this.emit('memoryStored', entry);
    
    if (this.config.debug) {
      console.log(`Memory stored: ${key}`);
    }
  }

  /**
   * Retrieve data from cognitive memory
   */
  retrieveMemory(key: string): any {
    const entry = this.memory.get(key);
    
    if (!entry) {
      return null;
    }

    // Check TTL expiration
    if (entry.ttl && (Date.now() - entry.timestamp.getTime()) > entry.ttl) {
      this.memory.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Handle system errors
   */
  private handleError(error: any, context: string): void {
    const errorObj = {
      message: error.message || 'Unknown error',
      context,
      timestamp: new Date(),
      stack: error.stack
    };
    
    this.emit('error', errorObj);
    
    if (this.config.debug) {
      console.error(`DevFlow Error [${context}]:`, error);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Get system configuration
   */
  getConfig(): SystemConfig {
    return { ...this.config };
  }

  /**
   * Get system status
   */
  getStatus(): { initialized: boolean; taskCount: number; memoryCount: number } {
    return {
      initialized: this.isInitialized,
      taskCount: this.tasks.size,
      memoryCount: this.memory.size
    };
  }
}

// Export core components
export { DevFlowSystem };
export type { SystemConfig, Task, MemoryEntry };

// Default export
export default DevFlowSystem;