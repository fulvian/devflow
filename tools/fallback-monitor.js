const EventEmitter = require('events');
const axios = require('axios');
const winston = require('winston');

class FallbackMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.orchestratorUrl = options.orchestratorUrl || 'http://localhost:3000';
    this.checkInterval = options.checkInterval || 5000; // 5 seconds
    this.failureThreshold = options.failureThreshold || 3;
    this.timeout = options.timeout || 5000; // 5 seconds
    
    this.failureCount = 0;
    this.isMonitoring = false;
    this.monitorInterval = null;
    this.circuitBreakerOpen = false;
    this.lastFailureTime = null;
    
    // Setup logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'fallback-monitor.log' })
      ]
    });
    
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.simple()
      }));
    }
    
    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }
  
  async startMonitoring() {
    if (this.isMonitoring) {
      this.logger.warn('Fallback monitor is already monitoring');
      return;
    }
    
    this.isMonitoring = true;
    this.logger.info('Starting fallback monitor');
    
    // Initial health check
    await this.checkOrchestratorHealth();
    
    // Set up periodic monitoring
    this.monitorInterval = setInterval(async () => {
      await this.checkOrchestratorHealth();
    }, this.checkInterval);
    
    this.emit('monitoringStarted');
  }
  
  async stopMonitoring() {
    if (!this.isMonitoring) {
      this.logger.warn('Fallback monitor is not currently monitoring');
      return;
    }
    
    this.isMonitoring = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    
    this.logger.info('Stopped fallback monitor');
    this.emit('monitoringStopped');
  }
  
  async checkOrchestratorHealth() {
    // If circuit breaker is open, don't make requests
    if (this.circuitBreakerOpen) {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      // Reset circuit breaker after 30 seconds
      if (timeSinceFailure > 30000) {
        this.logger.info('Resetting circuit breaker');
        this.circuitBreakerOpen = false;
        this.failureCount = 0;
      } else {
        this.logger.warn('Circuit breaker is open, skipping health check');
        return;
      }
    }
    
    try {
      const response = await axios.get(`${this.orchestratorUrl}/health`, {
        timeout: this.timeout
      });
      
      if (response.status === 200 && response.data.status === 'healthy') {
        // Reset failure count on successful health check
        if (this.failureCount > 0) {
          this.logger.info('Orchestrator health restored');
          this.failureCount = 0;
          this.emit('healthRestored');
        }
        
        this.emit('healthCheckSuccess', response.data);
        return true;
      } else {
        throw new Error(`Unexpected health check response: ${response.status}`);
      }
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      this.logger.warn(`Orchestrator health check failed (${this.failureCount}/${this.failureThreshold}): ${error.message}`);
      this.emit('healthCheckFailure', { error, failureCount: this.failureCount });
      
      // Check if we should trigger fallback
      if (this.failureCount >= this.failureThreshold) {
        this.circuitBreakerOpen = true;
        this.logger.error('Failure threshold reached, opening circuit breaker');
        await this.executeFallback();
      }
      
      return false;
    }
  }
  
  async executeFallback() {
    this.logger.info('Executing fallback strategy');
    this.emit('fallbackTriggered');
    
    try {
      // Preserve context for fallback
      const fallbackContext = {
        failureCount: this.failureCount,
        lastFailureTime: this.lastFailureTime,
        orchestratorUrl: this.orchestratorUrl
      };
      
      // Notify Auto CCR Runner
      this.emit('fallbackExecution', fallbackContext);
      
      // In a real implementation, this would coordinate with the Auto CCR Runner
      // For now, we'll simulate a successful fallback
      this.logger.info('Fallback coordination completed');
      this.emit('fallbackSuccess', fallbackContext);
      
      // Reset failure count after successful fallback
      this.failureCount = 0;
      
      return true;
    } catch (error) {
      this.logger.error('Fallback execution failed:', error);
      this.emit('fallbackFailure', error);
      return false;
    }
  }
  
  async getMetrics() {
    return {
      isMonitoring: this.isMonitoring,
      failureCount: this.failureCount,
      circuitBreakerOpen: this.circuitBreakerOpen,
      lastFailureTime: this.lastFailureTime,
      orchestratorUrl: this.orchestratorUrl
    };
  }
  
  async shutdown() {
    this.logger.info('Shutting down fallback monitor...');
    await this.stopMonitoring();
    this.emit('shutdown');
    process.exit(0);
  }
}

module.exports = FallbackMonitor;

// Entry point for direct execution
if (require.main === module) {
  const monitor = new FallbackMonitor({
    orchestratorUrl: 'http://localhost:3200',
    checkInterval: 5000,
    failureThreshold: 3,
    timeout: 5000
  });

  monitor.startMonitoring().catch(err => {
    console.error('Failed to start fallback monitor:', err);
    process.exit(1);
  });

  console.log('🔧 Dream Team Fallback Monitor started - monitoring orchestrator health...');
}
