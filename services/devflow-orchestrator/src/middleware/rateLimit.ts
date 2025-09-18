import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

// Simple in-memory rate limiting for DevFlow integration
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const createRateLimiter = (windowMs: number, max: number, message: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();

    const clientData = requestCounts.get(clientId);

    if (!clientData || now > clientData.resetTime) {
      requestCounts.set(clientId, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    if (clientData.count >= max) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message
        },
        timestamp: new Date().toISOString()
      };
      return res.status(429).json(response);
    }

    clientData.count++;
    next();
  };
};

export const generalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per window
  'Too many requests from this IP, please try again later.'
);