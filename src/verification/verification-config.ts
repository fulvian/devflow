import fs from 'fs';
import path from 'path';

export interface VerificationSettings {
  enabled: boolean;
  autoVerify: boolean;
  failOnError: boolean;
  excludedPaths: string[];
  severityThreshold: 'low' | 'medium' | 'high' | 'critical';
  rules: {
    lineLimit: number;
    allowSQLite: boolean;
    checkCodeQuality: boolean;
    bugDetection: boolean;
  };
}

export class VerificationConfig {
  private settings: VerificationSettings;
  private settingsPath: string;

  constructor() {
    this.settingsPath = path.join(
      process.env.PROJECT_ROOT || '.', 
      '.claude', 
      'config', 
      'verification-settings.json'
    );
    this.settings = this.loadSettings();
  }

  private loadSettings(): VerificationSettings {
    const defaultSettings: VerificationSettings = {
      enabled: true,
      autoVerify: true,
      failOnError: false,
      excludedPaths: ['node_modules', '.git', 'dist', 'build'],
      severityThreshold: 'medium',
      rules: {
        lineLimit: 100,
        allowSQLite: false,
        checkCodeQuality: true,
        bugDetection: true
      }
    };

    if (fs.existsSync(this.settingsPath)) {
      try {
        const fileSettings = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
        return { ...defaultSettings, ...fileSettings };
      } catch (error) {
        console.warn('Failed to parse verification settings, using defaults:', error.message);
        return defaultSettings;
      }
    }

    // Create default settings file
    this.saveSettings(defaultSettings);
    return defaultSettings;
  }

  private saveSettings(settings: VerificationSettings): void {
    try {
      // Ensure config directory exists
      const configDir = path.dirname(this.settingsPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      fs.writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2));
    } catch (error) {
      console.warn('Failed to save verification settings:', error.message);
    }
  }

  public getSettings(): VerificationSettings {
    return { ...this.settings }; // Return a copy
  }

  public updateSettings(newSettings: Partial<VerificationSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings(this.settings);
  }

  public isPathExcluded(filePath: string): boolean {
    return this.settings.excludedPaths.some(excludedPath => 
      filePath.includes(excludedPath)
    );
  }

  public shouldReportViolation(severity: 'low' | 'medium' | 'high' | 'critical'): boolean {
    const severityLevels = ['low', 'medium', 'high', 'critical'];
    const thresholdIndex = severityLevels.indexOf(this.settings.severityThreshold);
    const violationIndex = severityLevels.indexOf(severity);
    
    return violationIndex >= thresholdIndex;
  }
}
