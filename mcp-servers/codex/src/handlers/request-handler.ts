/**
 * Core Request Handling Middleware for Codex MCP Server
 * Task ID: CCR-002-CORE-FUNCTIONALITY
 * 
 * This module implements the core middleware for handling MCP requests with:
 * - OpenAI API integration
 * - Request validation and sanitization
 * - Response formatting
 * - Error handling with proper HTTP codes
 * - Request/response logging
 * - Rate limiting support
 */

import express, { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import OpenAI from 'openai';
import { z } from 'zod';
import winston from 'winston';

// ==================== Configuration ====================

// OpenAI Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Rate Limiting Configuration
const rateLimiter = new RateLimiterMemory({
  points: 10, // 10 requests
  duration: 60, // per 60 seconds
});

// Logger Configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'mcp-server.log' })
  ]
});

// ==================== Validation Schemas ====================

const MCPRequestSchema = z.object({
  prompt: z.string().min(1).max(4096),
  model: z.string().optional().default('gpt-3.5-turbo'),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().min(1).max(4096).optional().default(1000),
  userId: z.string().optional()
});

type MCPRequest = z.infer<typeof MCPRequestSchema>;

const MCPResponseSchema = z.object({
  id: z.string(),
  content: z.string(),
  model: z.string(),
  usage: z.object({
    promptTokens: z.number(),
    completionTokens: z.number(),
    totalTokens: z.number()
  }),
  timestamp: z.string()
});

type MCPResponse = z.infer<typeof MCPResponseSchema>;

// ==================== Middleware Implementation ====================

/**
 * Rate limiting middleware
 */
export const rateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.body.userId || req.ip;
    await rateLimiter.consume(userId);
    next();
  } catch (rateLimiterRes) {
    logger.warn(`Rate limit exceeded for user/IP: ${req.body.userId || req.ip}`);
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests, please try again later'
    });
  }
};

/**
 * Request validation and sanitization middleware
 */
export const validateRequestMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Parse and validate request body
    const parsedRequest = MCPRequestSchema.parse(req.body);
    
    // Sanitize prompt (basic sanitization)
    parsedRequest.prompt = parsedRequest.prompt.trim();
    
    // Attach validated data to request
    req.body = parsedRequest;
    
    logger.info('Request validated successfully', { 
      userId: parsedRequest.userId,
      model: parsedRequest.model 
    });
    
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Request validation failed', { 
        errors: error.errors,
        body: req.body 
      });
      
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    
    logger.error('Unexpected error during validation', { error });
    return res.status(500).json({
      error: 'Internal server error during validation'
    });
  }
};

/**
 * OpenAI API integration middleware
 */
export const openAIIntegrationMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prompt, model, temperature, maxTokens, userId } = req.body as MCPRequest;
    
    logger.info('Calling OpenAI API', { 
      userId,
      model,
      promptLength: prompt.length 
    });
    
    const startTime = Date.now();
    
    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens
    });
    
    const endTime = Date.now();
    
    // Format response
    const formattedResponse: MCPResponse = {
      id: completion.id,
      content: completion.choices[0]?.message?.content || '',
      model: completion.model,
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0
      },
      timestamp: new Date().toISOString()
    };
    
    // Attach response to locals for downstream middleware
    res.locals.mcpResponse = formattedResponse;
    res.locals.processingTime = endTime - startTime;
    
    logger.info('OpenAI API call successful', {
      userId,
      responseId: completion.id,
      processingTime: endTime - startTime,
      totalTokens: completion.usage?.total_tokens
    });
    
    next();
  } catch (error) {
    logger.error('OpenAI API call failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.body.userId
    });
    
    if (error instanceof OpenAI.APIError) {
      return res.status(error.status || 500).json({
        error: 'OpenAI API error',
        message: error.message,
        type: error.type
      });
    }
    
    return res.status(500).json({
      error: 'Failed to process request with OpenAI',
      message: 'An unexpected error occurred while processing your request'
    });
  }
};

/**
 * Response formatting middleware
 */
export const formatResponseMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const mcpResponse: MCPResponse = res.locals.mcpResponse;
    const processingTime: number = res.locals.processingTime;
    
    if (!mcpResponse) {
      logger.error('No response data found for formatting');
      return res.status(500).json({
        error: 'Response formatting error',
        message: 'No response data available'
      });
    }
    
    // Validate response format
    const validatedResponse = MCPResponseSchema.parse(mcpResponse);
    
    // Add processing metadata
    const responseWithMetadata = {
      ...validatedResponse,
      processingTimeMs: processingTime,
      requestId: req.id || require('crypto').randomUUID()
    };
    
    logger.info('Response formatted successfully', {
      requestId: responseWithMetadata.requestId,
      userId: req.body.userId
    });
    
    res.status(200).json(responseWithMetadata);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Response validation failed', { errors: error.errors });
      return res.status(500).json({
        error: 'Response validation failed',
        details: error.errors
      });
    }
    
    logger.error('Unexpected error during response formatting', { error });
    return res.status(500).json({
      error: 'Internal server error during response formatting'
    });
  }
};

/**
 * Error handling middleware
 */
export const errorHandlerMiddleware = (error: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error in middleware chain', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body
  });
  
  if (res.headersSent) {
    return next(error);
  }
  
  return res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
};

/**
 * Request/response logging middleware
 */
export const loggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Log incoming request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    body: req.body,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Log response when it's finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.info('Response sent', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      durationMs: duration,
      contentLength: res.get('Content-Length')
    });
  });
  
  next();
};

// ==================== Main Middleware Chain ====================

/**
 * Main MCP request handler middleware
 */
export const mcpRequestHandler = [
  loggingMiddleware,
  rateLimitMiddleware,
  validateRequestMiddleware,
  openAIIntegrationMiddleware,
  formatResponseMiddleware,
  errorHandlerMiddleware
];

export default mcpRequestHandler;