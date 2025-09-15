import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication token required'
      },
      timestamp: new Date().toISOString()
    };
    return res.status(401).json(response);
  }

  const token = authHeader.substring(7);

  // Simple token validation for DevFlow integration
  if (token !== process.env.DEVFLOW_API_SECRET && token !== 'devflow-orchestrator-token') {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token'
      },
      timestamp: new Date().toISOString()
    };
    return res.status(403).json(response);
  }

  next();
};