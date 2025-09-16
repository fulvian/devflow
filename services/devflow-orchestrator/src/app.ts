/**
 * Main Express Application Entry Point
 * Task ID: DEVFLOW-APP-FIX-004
 * 
 * This module sets up the Express application with all necessary middleware,
 * routes, and integrations including Socket.IO, CORS, and security measures.
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import http from 'http';
import socketIO from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import custom modules with default imports
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

// Create Express app
const app: Application = express();

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io: socketIO.Server = new socketIO.Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Mount routes
app.use('/api', routes);

// Basic health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Socket.IO connection handling
io.on('connection', (socket: socketIO.Socket) => {
  logger.info(`User connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${socket.id}`);
  });
});

// Global error handler
app.use(errorHandler);

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

export { app, server, io };