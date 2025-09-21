const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const winston = require('winston');
const path = require('path');

class CCToolsGRPCServer {
  constructor(options = {}) {
    this.port = options.port || 50052;
    this.host = options.host || '0.0.0.0';
    this.protoPath = options.protoPath || path.join(__dirname, '../protos/cc_tools.proto');
    
    this.server = null;
    this.isRunning = false;
    
    // Setup logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'cc-tools-grpc-server.log' })
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
  
  async start() {
    if (this.isRunning) {
      this.logger.warn('gRPC server is already running');
      return;
    }
    
    try {
      // Load proto file
      const packageDefinition = await protoLoader.load(this.protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      });
      
      const ccToolsProto = grpc.loadPackageDefinition(packageDefinition);
      
      // Create gRPC server
      this.server = new grpc.Server();
      
      // Add services
      this.server.addService(ccToolsProto.cc_tools.CCTools.service, {
        validateClaudeCodeHook: this.validateClaudeCodeHook.bind(this),
        getServerStatus: this.getServerStatus.bind(this),
        healthCheck: this.healthCheck.bind(this)
      });
      
      // Bind server
      const boundPort = await new Promise((resolve, reject) => {
        this.server.bindAsync(
          `${this.host}:${this.port}`,
          grpc.ServerCredentials.createInsecure(),
          (err, port) => {
            if (err) {
              reject(err);
            } else {
              resolve(port);
            }
          }
        );
      });
      
      // Start server
      this.server.start();
      this.isRunning = true;
      
      this.logger.info(`CC-Tools gRPC server started on ${this.host}:${boundPort}`);
      
      return boundPort;
    } catch (error) {
      this.logger.error('Failed to start gRPC server:', error);
      throw error;
    }
  }
  
  async stop() {
    if (!this.isRunning) {
      this.logger.warn('gRPC server is not running');
      return;
    }
    
    return new Promise((resolve) => {
      this.server.tryShutdown(() => {
        this.isRunning = false;
        this.logger.info('gRPC server stopped');
        resolve();
      });
    });
  }
  
  // gRPC service implementations
  validateClaudeCodeHook(call, callback) {
    try {
      const { hookData } = call.request;
      this.logger.info('Validating Claude Code hook', { hookId: hookData?.id });
      
      // In a real implementation, this would contain validation logic
      // For now, we'll simulate validation
      const isValid = this.performValidation(hookData);
      
      const response = {
        isValid: isValid,
        validationTime: new Date().toISOString(),
        message: isValid ? 'Hook validation successful' : 'Hook validation failed'
      };
      
      callback(null, response);
    } catch (error) {
      this.logger.error('Error validating Claude Code hook:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error during validation'
      });
    }
  }
  
  getServerStatus(call, callback) {
    try {
      const status = {
        isRunning: this.isRunning,
        port: this.port,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      };
      
      callback(null, status);
    } catch (error) {
      this.logger.error('Error getting server status:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error while getting status'
      });
    }
  }
  
  healthCheck(call, callback) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        isRunning: this.isRunning
      };
      
      callback(null, health);
    } catch (error) {
      this.logger.error('Error performing health check:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error during health check'
      });
    }
  }
  
  // Helper methods
  performValidation(hookData) {
    // Simulate validation logic
    // In a real implementation, this would contain actual validation
    if (!hookData) return false;
    
    // Check required fields
    const requiredFields = ['id', 'type', 'payload'];
    return requiredFields.every(field => hookData[field] !== undefined);
  }
  
  async shutdown() {
    this.logger.info('Shutting down CC-Tools gRPC server...');
    if (this.isRunning) {
      await this.stop();
    }
    process.exit(0);
  }
}

module.exports = CCToolsGRPCServer;

// Entry point for direct execution
if (require.main === module) {
  const server = new CCToolsGRPCServer({
    port: process.env.GRPC_PORT || process.env.CCTOOLS_GRPC_PORT || 50052,
    enableValidation: true,
    enableDebugging: process.env.NODE_ENV !== 'production'
  });

  server.start().catch(err => {
    console.error('Failed to start CC-Tools gRPC server:', err);
    process.exit(1);
  });

  console.log('⚡ CC-Tools gRPC Server started - providing validation hooks...');
}
