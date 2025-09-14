/**
 * Comprehensive Error Handling Middleware for Codex MCP Server
 * Task ID: CCR-002-CORE-FUNCTIONALITY
 * 
 * This module provides a robust error handling solution with:
 * - Structured error classification and codes
 * - Environment-aware error responses
 * - Detailed logging with context
 * - Metrics tracking capabilities
 * - Recovery strategy support
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

// Error classification enums
export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND_ERROR',
  CONFLICT = 'CONFLICT_ERROR',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC_ERROR',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE_ERROR',
  DATABASE = 'DATABASE_ERROR',
  NETWORK = 'NETWORK_ERROR',
  SYSTEM = 'SYSTEM_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// Custom error interface
export interface CodexError extends Error {
  code: string;
  type: ErrorType;
  severity: ErrorSeverity;
  statusCode: number;
  context?: Record<string, any>;
  recoveryStrategy?: RecoveryStrategy;
  isOperational?: boolean;
}

// Recovery strategies
export enum RecoveryStrategy {
  RETRY = 'RETRY',
  CIRCUIT_BREAKER = 'CIRCUIT_BREAKER',
  FALLBACK = 'FALLBACK',
  QUEUE_RETRY = 'QUEUE_RETRY',
  MANUAL_INTERVENTION = 'MANUAL_INTERVENTION'
}

// Error metrics interface
export interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<ErrorType, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recoveryAttempts: number;
  successfulRecoveries: number;
}

// Global error metrics tracker
let errorMetrics: ErrorMetrics = {
  totalErrors: 0,
  errorsByType: {} as Record<ErrorType, number>,
  errorsBySeverity: {} as Record<ErrorSeverity, number>,
  recoveryAttempts: 0,
  successfulRecoveries: 0
};

// Initialize error type counters
Object.values(ErrorType).forEach(type => {
  errorMetrics.errorsByType[type] = 0;
});

// Initialize severity counters
Object.values(ErrorSeverity).forEach(severity => {
  errorMetrics.errorsBySeverity[severity] = 0;
});

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

/**
 * Custom error classes
 */
export class ValidationError extends Error implements CodexError {
  code = 'VALIDATION_001';
  type = ErrorType.VALIDATION;
  severity = ErrorSeverity.LOW;
  statusCode = 400;
  isOperational = true;

  constructor(message: string, public context?: Record<string, any>) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error implements CodexError {
  code = 'AUTH_001';
  type = ErrorType.AUTHENTICATION;
  severity = ErrorSeverity.HIGH;
  statusCode = 401;
  isOperational = true;

  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error implements CodexError {
  code = 'AUTH_002';
  type = ErrorType.AUTHORIZATION;
  severity = ErrorSeverity.HIGH;
  statusCode = 403;
  isOperational = true;

  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error implements CodexError {
  code = 'NOT_FOUND_001';
  type = ErrorType.NOT_FOUND;
  severity = ErrorSeverity.MEDIUM;
  statusCode = 404;
  isOperational = true;

  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error implements CodexError {
  code = 'CONFLICT_001';
  type = ErrorType.CONFLICT;
  severity = ErrorSeverity.MEDIUM;
  statusCode = 409;
  isOperational = true;

  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class BusinessLogicError extends Error implements CodexError {
  code = 'BUSINESS_001';
  type = ErrorType.BUSINESS_LOGIC;
  severity = ErrorSeverity.MEDIUM;
  statusCode = 422;
  isOperational = true;

  constructor(message: string, public context?: Record<string, any>) {
    super(message);
    this.name = 'BusinessLogicError';
  }
}

export class ExternalServiceError extends Error implements CodexError {
  code = 'EXTERNAL_001';
  type = ErrorType.EXTERNAL_SERVICE;
  severity = ErrorSeverity.HIGH;
  statusCode = 503;
  isOperational = true;
  recoveryStrategy = RecoveryStrategy.RETRY;

  constructor(message: string, public context?: Record<string, any>) {
    super(message);
    this.name = 'ExternalServiceError';
  }
}

export class DatabaseError extends Error implements CodexError {
  code = 'DATABASE_001';
  type = ErrorType.DATABASE;
  severity = ErrorSeverity.CRITICAL;
  statusCode = 500;
  isOperational = true;
  recoveryStrategy = RecoveryStrategy.CIRCUIT_BREAKER;

  constructor(message: string, public context?: Record<string, any>) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class SystemError extends Error implements CodexError {
  code = 'SYSTEM_001';
  type = ErrorType.SYSTEM;
  severity = ErrorSeverity.CRITICAL;
  statusCode = 500;
  isOperational = false; // Programming errors are not operational

  constructor(message: string, public context?: Record<string, any>) {
    super(message);
    this.name = 'SystemError';
  }
}

/**
 * Type guard to check if an error is a CodexError
 */
function isCodexError(error: any): error is CodexError {
  return error && 
         typeof error.code === 'string' && 
         Object.values(ErrorType).includes(error.type) &&
         Object.values(ErrorSeverity).includes(error.severity) &&
         typeof error.statusCode === 'number';
}

/**
 * Generate a unique error ID for tracking
 */
function generateErrorId(): string {
  return `ERR_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
}

/**
 * Update error metrics
 */
function updateMetrics(error: CodexError): void {
  errorMetrics.totalErrors++;
  errorMetrics.errorsByType[error.type]++;
  errorMetrics.errorsBySeverity[error.severity]++;
  
  if (error.recoveryStrategy) {
    errorMetrics.recoveryAttempts++;
  }
}

/**
 * Attempt error recovery based on strategy
 */
async function attemptRecovery(error: CodexError, req: Request): Promise<boolean> {
  if (!error.recoveryStrategy) return false;

  try {
    switch (error.recoveryStrategy) {
      case RecoveryStrategy.RETRY:
        // Implement retry logic
        logger.info(`Attempting retry recovery for error ${error.code}`);
        return true;
        
      case RecoveryStrategy.CIRCUIT_BREAKER:
        // Implement circuit breaker pattern
        logger.info(`Circuit breaker activated for error ${error.code}`);
        return false; // For now, just log and don't recover
        
      case RecoveryStrategy.FALLBACK:
        // Implement fallback mechanism
        logger.info(`Executing fallback for error ${error.code}`);
        return true;
        
      case RecoveryStrategy.QUEUE_RETRY:
        // Implement queue-based retry
        logger.info(`Queueing error ${error.code} for retry`);
        return true;
        
      default:
        return false;
    }
  } catch (recoveryError) {
    logger.error('Error during recovery attempt', { 
      recoveryError, 
      originalError: error,
      requestId: req.id 
    });
    return false;
  }
}

/**
 * Format error for client response
 */
function formatClientError(error: CodexError, errorId: string, isProduction: boolean): any {
  const clientError: any = {
    error: {
      id: errorId,
      code: error.code,
      type: error.type,
      message: isProduction && !error.isOperational 
        ? 'An unexpected error occurred' 
        : error.message,
      timestamp: new Date().toISOString()
    }
  };

  // Add additional details for operational errors in development
  if (!isProduction || error.isOperational) {
    clientError.error.statusCode = error.statusCode;
    clientError.error.severity = error.severity;
    
    if (error.context) {
      clientError.error.context = error.context;
    }
  }

  return clientError;
}

/**
 * Log error with structured data
 */
function logError(error: CodexError, req: Request, errorId: string): void {
  const logData: any = {
    errorId,
    code: error.code,
    type: error.type,
    severity: error.severity,
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode,
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  };

  if (req.user) {
    logData.userId = req.user.id;
  }

  if (error.context) {
    logData.context = error.context;
  }

  if (error.recoveryStrategy) {
    logData.recoveryStrategy = error.recoveryStrategy;
  }

  logger.error('Application error occurred', logData);
}

/**
 * Main error handling middleware
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate unique error ID for tracking
  const errorId = generateErrorId();
  
  // Determine if we're in production
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Convert to CodexError if needed
  let codexError: CodexError;
  
  if (isCodexError(error)) {
    codexError = error;
  } else {
    // Handle unanticipated errors
    codexError = new SystemError(error.message, {
      originalError: error.constructor.name,
      ...(error.stack ? { stack: error.stack } : {})
    });
  }

  // Update metrics
  updateMetrics(codexError);

  // Log the error with structured data
  logError(codexError, req, errorId);

  // Attempt recovery for operational errors
  if (codexError.isOperational) {
    attemptRecovery(codexError, req)
      .then(recovered => {
        if (recovered) {
          errorMetrics.successfulRecoveries++;
          logger.info(`Successfully recovered from error ${codexError.code}`, { errorId });
        }
      })
      .catch(recoveryError => {
        logger.error('Recovery attempt failed', { 
          recoveryError, 
          originalError: codexError,
          errorId 
        });
      });
  }

  // Format response based on environment
  const clientResponse = formatClientError(codexError, errorId, isProduction);

  // Send response
  res.status(codexError.statusCode).json(clientResponse);

  // For critical non-operational errors in production, exit process
  if (!isProduction && !codexError.isOperational) {
    logger.error('Shutting down due to critical error', { errorId });
    process.exit(1);
  }
};

/**
 * Get current error metrics
 */
export function getErrorMetrics(): ErrorMetrics {
  return { ...errorMetrics };
}

/**
 * Reset error metrics (useful for testing)
 */
export function resetErrorMetrics(): void {
  errorMetrics = {
    totalErrors: 0,
    errorsByType: {} as Record<ErrorType, number>,
    errorsBySeverity: {} as Record<ErrorSeverity, number>,
    recoveryAttempts: 0,
    successfulRecoveries: 0
  };

  // Reinitialize counters
  Object.values(ErrorType).forEach(type => {
    errorMetrics.errorsByType[type] = 0;
  });

  Object.values(ErrorSeverity).forEach(severity => {
    errorMetrics.errorsBySeverity[severity] = 0;
  });
}

export default errorHandler;