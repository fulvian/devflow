import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

export class BackupManagerService {
  private static instance: BackupManagerService;
  private backupBaseDir: string;
  private metadataFile: string;

  private constructor() {
    this.backupBaseDir = '/tmp/devflow-backups';
    this.metadataFile = path.join(this.backupBaseDir, 'metadata.json');
  }

  public static getInstance(): BackupManagerService {
    if (!BackupManagerService.instance) {
      BackupManagerService.instance = new BackupManagerService();
    }
    return BackupManagerService.instance;
  }

  private async ensureDirExists(dirPath: string): Promise<void> {
    try {
      await mkdir(dirPath, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private getTimestamp(): { date: string; time: string } {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
    return { date, time };
  }

  private getBackupPath(filePath: string): { backupDir: string; backupFilePath: string; backupName: string } {
    const { date, time } = this.getTimestamp();
    const backupDir = path.join(this.backupBaseDir, date, time);
    const fileName = path.basename(filePath);
    const backupName = `${fileName}.backup`;
    const backupFilePath = path.join(backupDir, backupName);
    return { backupDir, backupFilePath, backupName };
  }

  public async createBackup(filePath: string): Promise<string> {
    try {
      // Read the original file
      const fileContent = await readFile(filePath, 'utf8');
      
      // Get backup path components
      const { backupDir, backupFilePath, backupName } = this.getBackupPath(filePath);
      
      // Ensure backup directory exists
      await this.ensureDirExists(backupDir);
      
      // Write backup file
      await writeFile(backupFilePath, fileContent, 'utf8');
      
      // Update metadata
      await this.updateMetadata(filePath, backupFilePath, backupName);
      
      // Cleanup old backups
      await this.cleanupOldBackups();
      
      return backupFilePath;
    } catch (error) {
      throw new Error(`Failed to create backup for ${filePath}: ${(error as Error).message}`);
    }
  }

  private async updateMetadata(originalPath: string, backupPath: string, backupName: string): Promise<void> {
    try {
      let metadata: any = {};
      
      // Read existing metadata if it exists
      if (fs.existsSync(this.metadataFile)) {
        const metadataContent = await readFile(this.metadataFile, 'utf8');
        metadata = JSON.parse(metadataContent);
      }
      
      // Add new backup entry
      const timestamp = new Date().toISOString();
      const entry = {
        originalPath,
        backupPath,
        backupName,
        timestamp
      };
      
      if (!metadata.backups) {
        metadata.backups = [];
      }
      metadata.backups.push(entry);
      
      // Write updated metadata
      await writeFile(this.metadataFile, JSON.stringify(metadata, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to update backup metadata:', (error as Error).message);
    }
  }

  public async restoreBackup(backupPath: string, targetPath: string): Promise<void> {
    try {
      // Read backup file
      const backupContent = await readFile(backupPath, 'utf8');
      
      // Ensure target directory exists
      const targetDir = path.dirname(targetPath);
      await this.ensureDirExists(targetDir);
      
      // Write restored file
      await writeFile(targetPath, backupContent, 'utf8');
    } catch (error) {
      throw new Error(`Failed to restore backup ${backupPath} to ${targetPath}: ${(error as Error).message}`);
    }
  }

  public async getBackupHistory(): Promise<any[]> {
    try {
      if (!fs.existsSync(this.metadataFile)) {
        return [];
      }
      
      const metadataContent = await readFile(this.metadataFile, 'utf8');
      const metadata = JSON.parse(metadataContent);
      return metadata.backups || [];
    } catch (error) {
      console.error('Failed to read backup history:', (error as Error).message);
      return [];
    }
  }

  public async cleanupOldBackups(): Promise<void> {
    try {
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
      
      // Read metadata
      if (!fs.existsSync(this.metadataFile)) {
        return;
      }
      
      const metadataContent = await readFile(this.metadataFile, 'utf8');
      const metadata = JSON.parse(metadataContent);
      
      if (!metadata.backups || metadata.backups.length === 0) {
        return;
      }
      
      // Filter out old backups
      const validBackups = [];
      const backupsToRemove = [];
      
      for (const backup of metadata.backups) {
        const backupTime = new Date(backup.timestamp).getTime();
        if (backupTime < cutoffTime) {
          backupsToRemove.push(backup);
        } else {
          validBackups.push(backup);
        }
      }
      
      // Remove old backup files
      for (const backup of backupsToRemove) {
        try {
          if (fs.existsSync(backup.backupPath)) {
            await unlink(backup.backupPath);
          }
        } catch (error) {
          console.warn(`Failed to remove old backup file ${backup.backupPath}:`, (error as Error).message);
        }
      }
      
      // Update metadata
      metadata.backups = validBackups;
      await writeFile(this.metadataFile, JSON.stringify(metadata, null, 2), 'utf8');
      
      // Remove empty directories
      await this.removeEmptyBackupDirs();
    } catch (error) {
      console.error('Failed to cleanup old backups:', (error as Error).message);
    }
  }

  private async removeEmptyBackupDirs(): Promise<void> {
    try {
      if (!fs.existsSync(this.backupBaseDir)) {
        return;
      }
      
      const dateDirs = await readdir(this.backupBaseDir);
      
      for (const dateDir of dateDirs) {
        if (dateDir === 'metadata.json') continue;
        
        const dateDirPath = path.join(this.backupBaseDir, dateDir);
        const dirStat = await stat(dateDirPath);
        
        if (dirStat.isDirectory()) {
          const timeDirs = await readdir(dateDirPath);
          
          for (const timeDir of timeDirs) {
            const timeDirPath = path.join(dateDirPath, timeDir);
            const timeDirStat = await stat(timeDirPath);
            
            if (timeDirStat.isDirectory()) {
              const files = await readdir(timeDirPath);
              if (files.length === 0) {
                await fs.promises.rmdir(timeDirPath);
              }
            }
          }
          
          // Check if date directory is now empty
          const remainingTimeDirs = await readdir(dateDirPath);
          if (remainingTimeDirs.length === 0) {
            await fs.promises.rmdir(dateDirPath);
          }
        }
      }
    } catch (error) {
      console.error('Failed to remove empty backup directories:', (error as Error).message);
    }
  }

  public async migrateIncorrectBackups(sourceDir: string): Promise<void> {
    try {
      if (!fs.existsSync(sourceDir)) {
        return;
      }
      
      const files = await readdir(sourceDir);
      const backupFiles = files.filter(file => file.endsWith('.backup'));
      
      for (const backupFile of backupFiles) {
        try {
          const sourcePath = path.join(sourceDir, backupFile);
          
          // Extract original filename from backup name
          const originalFileName = backupFile.replace(/\.backup-.*$/, '');
          
          // Create proper backup using our system
          await this.createBackup(sourcePath);
          
          // Remove the incorrectly placed backup
          await unlink(sourcePath);
        } catch (error) {
          console.warn(`Failed to migrate backup ${backupFile}:`, (error as Error).message);
        }
      }
    } catch (error) {
      console.error('Failed to migrate incorrect backups:', (error as Error).message);
    }
  }
}
