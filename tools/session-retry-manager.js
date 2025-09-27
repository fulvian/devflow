const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const winston = require('winston');

class SessionRetryManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000; // 1 second
    this.sessionDir = options.sessionDir || '.claude/state';
    this.retryCount = 0;
    this.isMonitoring = false;
    this.monitorInterval = null;
    
    // Setup logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'session-retry-manager.log' })
      ]
    });
    
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.simple()
      }));
    }
    
    // Graceful shutdown handlers
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }
  
  async startMonitoring() {
    if (this.isMonitoring) {
      this.logger.warn('Session retry manager is already monitoring');
      return;
    }
    
    this.isMonitoring = true;
    this.logger.info('Starting session retry manager monitoring');
    
    // Check for failed sessions immediately
    await this.checkFailedSessions();
    
    // Set up periodic monitoring
    this.monitorInterval = setInterval(async () => {
      await this.checkFailedSessions();
    }, 30000); // Check every 30 seconds
    
    this.emit('monitoringStarted');
  }
  
  async stopMonitoring() {
    if (!this.isMonitoring) {
      this.logger.warn('Session retry manager is not currently monitoring');
      return;
    }
    
    this.isMonitoring = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    
    this.logger.info('Stopped session retry manager monitoring');
    this.emit('monitoringStopped');
  }
  
  async checkFailedSessions() {
    try {
      const sessionFiles = await this.getSessionFiles();
      
      for (const file of sessionFiles) {
        const sessionPath = path.join(this.sessionDir, file);
        const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
        
        if (sessionData.status === 'failed' && sessionData.retryCount < this.maxRetries) {
          this.logger.info(`Found failed session: ${file}, attempting retry`);
          await this.retrySession(sessionData, sessionPath);
        }
      }
    } catch (error) {
      this.logger.error('Error checking failed sessions:', error);
      this.emit('error', error);
    }
  }
  
  async retrySession(sessionData, sessionPath) {
    try {
      const delay = this.calculateExponentialBackoff(sessionData.retryCount);
      this.logger.info(`Retrying session ${sessionData.id} with delay ${delay}ms`);
      
      // Emit retry attempt event
      this.emit('retryAttempt', {
        sessionId: sessionData.id,
        retryCount: sessionData.retryCount + 1,
        delay
      });
      
      // Wait for backoff delay
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Simulate session retry logic
      // In a real implementation, this would attempt to re-establish the session
      const success = await this.attemptSessionRecovery(sessionData);
      
      if (success) {
        sessionData.status = 'recovered';
        sessionData.recoveredAt = new Date().toISOString();
        this.logger.info(`Successfully recovered session ${sessionData.id}`);
        this.emit('sessionRecovered', sessionData);
      } else {
        sessionData.retryCount += 1;
        sessionData.lastRetryAttempt = new Date().toISOString();
        
        if (sessionData.retryCount >= this.maxRetries) {
          sessionData.status = 'permanentlyFailed';
          this.logger.warn(`Session ${sessionData.id} permanently failed after ${this.maxRetries} retries`);
          this.emit('sessionPermanentlyFailed', sessionData);
        }
      }
      
      // Update session file
      fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));
      
    } catch (error) {
      this.logger.error(`Error retrying session ${sessionData.id}:`, error);
      this.emit('error', error);
    }
  }
  
  calculateExponentialBackoff(retryCount) {
    return this.baseDelay * Math.pow(2, retryCount);
  }
  
  async attemptSessionRecovery(sessionData) {
    // Simulate session recovery attempt
    // In a real implementation, this would contain actual recovery logic
    this.logger.info(`Attempting to recover session ${sessionData.id}`);
    
    // Simulate network request or other async operation
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Randomly determine success for demonstration
    return Math.random() > 0.3; // 70% success rate
  }
  
  async getSessionFiles() {
    if (!fs.existsSync(this.sessionDir)) {
      this.logger.warn(`Session directory does not exist: ${this.sessionDir}`);
      return [];
    }
    
    const files = fs.readdirSync(this.sessionDir);
    return files.filter(file => file.endsWith('.json'));
  }
  
  async healthCheck() {
    return {
      status: 'healthy',
      isMonitoring: this.isMonitoring,
      retryCount: this.retryCount,
      timestamp: new Date().toISOString()
    };
  }
  
  async shutdown() {
    this.logger.info('Shutting down session retry manager...');
    await this.stopMonitoring();
    this.emit('shutdown');
    process.exit(0);
  }
}

module.exports = SessionRetryManager;

// Entry point for direct execution
if (require.main === module) {
  const manager = new SessionRetryManager({
    sessionDir: '.claude/state',
    maxRetries: 3,
    baseDelay: 2000
  });

  manager.startMonitoring().catch(err => {
    console.error('Failed to start session retry manager:', err);
    process.exit(1);
  });

  console.log('📂 Session Retry Manager started - monitoring Claude Code sessions...');
}
