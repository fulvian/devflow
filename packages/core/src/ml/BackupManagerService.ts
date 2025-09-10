import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface BackupEntry {
  id: string;
  timestamp: number;
  service: string;
  filePath: string;
  backupPath: string;
}

class BackupManagerService {
  private backupDir: string;
  private maxBackups: number;
  private backupRegistry: Map<string, BackupEntry[]>;

  constructor() {
    this.backupDir = join(__dirname, '../../../../../../backups');
    this.maxBackups = 10;
    this.backupRegistry = new Map();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      await this.cleanup();
    } catch (error) {
      console.error('BackupManager initialization failed:', error);
    }
  }

  async createBackup(service: string, filePath: string, content: string): Promise<string> {
    try {
      const timestamp = Date.now();
      const fileName = `${service}_${timestamp}.bak`;
      const backupPath = join(this.backupDir, fileName);
      
      await fs.writeFile(backupPath, content, 'utf8');
      
      const backupId = `${service}_${timestamp}`;
      const entry: BackupEntry = {
        id: backupId,
        timestamp,
        service,
        filePath,
        backupPath
      };
      
      if (!this.backupRegistry.has(service)) {
        this.backupRegistry.set(service, []);
      }
      
      const serviceBackups = this.backupRegistry.get(service)!;
      serviceBackups.push(entry);
      
      // Keep only the most recent backups
      if (serviceBackups.length > this.maxBackups) {
        const oldest = serviceBackups.shift();
        if (oldest) {
          await this.removeBackup(oldest.id);
        }
      }
      
      return backupId;
    } catch (error) {
      console.error('Backup creation failed:', error);
      throw error;
    }
  }

  async restoreBackup(backupId: string): Promise<string | null> {
    try {
      for (const [service, backups] of this.backupRegistry.entries()) {
        const backup = backups.find(b => b.id === backupId);
        if (backup) {
          const content = await fs.readFile(backup.backupPath, 'utf8');
          return content;
        }
      }
      return null;
    } catch (error) {
      console.error('Backup restoration failed:', error);
      return null;
    }
  }

  async removeBackup(backupId: string): Promise<boolean> {
    try {
      for (const [service, backups] of this.backupRegistry.entries()) {
        const index = backups.findIndex(b => b.id === backupId);
        if (index !== -1) {
          const backup = backups[index];
          await fs.unlink(backup.backupPath);
          backups.splice(index, 1);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Backup removal failed:', error);
      return false;
    }
  }

  async listBackups(service?: string): Promise<BackupEntry[]> {
    if (service && this.backupRegistry.has(service)) {
      return [...this.backupRegistry.get(service)!];
    }
    
    const allBackups: BackupEntry[] = [];
    for (const backups of this.backupRegistry.values()) {
      allBackups.push(...backups);
    }
    
    return allBackups.sort((a, b) => b.timestamp - a.timestamp);
  }

  async cleanup(): Promise<void> {
    try {
      const files = await fs.readdir(this.backupDir);
      
      // Clean up registry entries for missing files
      for (const [service, backups] of this.backupRegistry.entries()) {
        for (let i = backups.length - 1; i >= 0; i--) {
          const backup = backups[i];
          if (!files.includes(backup.backupPath.split('/').pop()!)) {
            backups.splice(i, 1);
          }
        }
      }
      
      // Clean up orphaned files
      for (const file of files) {
        if (file.endsWith('.bak')) {
          const filePath = join(this.backupDir, file);
          let found = false;
          
          for (const backups of this.backupRegistry.values()) {
            if (backups.some(b => b.backupPath === filePath)) {
              found = true;
              break;
            }
          }
          
          if (!found) {
            await fs.unlink(filePath);
          }
        }
      }
    } catch (error) {
      console.error('Backup cleanup failed:', error);
    }
  }
}

export default new BackupManagerService();
