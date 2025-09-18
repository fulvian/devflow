import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: any
  ) {
    super(message);
  }
}

export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('API Error:', err);

  const response: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    },
    timestamp: new Date().toISOString()
  };

  if (err instanceof ApiError) {
    response.error = {
      code: err.code,
      message: err.message,
      details: err.details
    };
    return res.status(err.statusCode).json(response);
  }

  return res.status(500).json(response);
};