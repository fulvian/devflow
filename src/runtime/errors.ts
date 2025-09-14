/**
 * Runtime error classes for the application
 * 
 * This module defines the hierarchy of error classes used throughout the runtime
 * to handle various error conditions in a structured way.
 */

/**
 * Base error class for runtime errors
 */
export class RuntimeError extends Error {
  constructor(message: string) {
    super(message);
    // Ensure the correct prototype chain. This is needed because TypeScript transpiles to ES5
    // which doesn't properly support extending built-in classes like Error
    Object.setPrototypeOf(this, RuntimeError.prototype);
    
    // Maintaining proper stack trace (only available in V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    
    this.name = 'RuntimeError';
  }
}

/**
 * Error class for code execution errors originating from Claude
 */
export class ClaudeCodeError extends RuntimeError {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ClaudeCodeError.prototype);
    this.name = 'ClaudeCodeError';
  }
}

/**
 * Error class for application startup failures
 */
export class StartupError extends RuntimeError {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, StartupError.prototype);
    this.name = 'StartupError';
  }
}

/**
 * Error class for configuration-related issues
 */
export class ConfigurationError extends RuntimeError {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ConfigurationError.prototype);
    this.name = 'ConfigurationError';
  }
}

/**
 * Error class for module loading failures
 */
export class ModuleLoadError extends RuntimeError {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ModuleLoadError.prototype);
    this.name = 'ModuleLoadError';
  }
}

/**
 * Error class for invalid state conditions
 */
export class InvalidStateError extends RuntimeError {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, InvalidStateError.prototype);
    this.name = 'InvalidStateError';
  }
}