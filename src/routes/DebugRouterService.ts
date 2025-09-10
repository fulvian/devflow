import express from 'express';
import { BackupManagerService } from '../services/BackupManagerService';

export class DebugRouterService {
  private backupManager: BackupManagerService;
  
  constructor() {
    this.backupManager = BackupManagerService.getInstance();
  }

  public setupRoutes(app: express.Application): void {
    // Create backup endpoint
    app.post('/debug/backup/:filePath', async (req, res) => {
      try {
        const filePath = req.params.filePath;
        const absolutePath = process.cwd() + '/' + filePath;
        
        const backupPath = await this.backupManager.createBackup(absolutePath);
        
        res.json({
          success: true,
          message: 'Backup created successfully',
          backupPath
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: (error as Error).message
        });
      }
    });

    // Restore backup endpoint
    app.post('/debug/restore/:backupPath/:targetPath', async (req, res) => {
      try {
        const backupPath = req.params.backupPath;
        const targetPath = req.params.targetPath;
        const absoluteTargetPath = process.cwd() + '/' + targetPath;
        
        await this.backupManager.restoreBackup(backupPath, absoluteTargetPath);
        
        res.json({
          success: true,
          message: 'Backup restored successfully'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: (error as Error).message
        });
      }
    });

    // Get backup history
    app.get('/debug/backups', async (req, res) => {
      try {
        const history = await this.backupManager.getBackupHistory();
        
        res.json({
          success: true,
          backups: history
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: (error as Error).message
        });
      }
    });

    // Migrate incorrect backups
    app.post('/debug/migrate-backups/:sourceDir', async (req, res) => {
      try {
        const sourceDir = req.params.sourceDir;
        const absoluteSourceDir = process.cwd() + '/' + sourceDir;
        
        await this.backupManager.migrateIncorrectBackups(absoluteSourceDir);
        
        res.json({
          success: true,
          message: 'Incorrect backups migrated successfully'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: (error as Error).message
        });
      }
    });
  }
}
