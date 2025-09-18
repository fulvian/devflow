import express, { Application, Request, Response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { syntheticRoutes } from './routes/synthetic';
import { memoryRoutes } from './routes/memory';
import { taskRoutes } from './routes/tasks';
import { sessionRoutes } from './routes/sessions';
import { setIo } from './ws/events';
import { authenticate } from './middleware/auth';
import { generalLimiter } from './middleware/rateLimit';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app: Application = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
setIo(io);

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(generalLimiter);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    service: 'devflow-orchestrator',
    timestamp: new Date().toISOString()
  });
});

// Routes with authentication
app.use('/api/synthetic', authenticate, syntheticRoutes);
app.use('/api/memory', authenticate, memoryRoutes);
app.use('/api/tasks', authenticate, taskRoutes);
app.use('/api/sessions', authenticate, sessionRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  socket.on('taskUpdate', (data) => {
    socket.broadcast.emit('taskUpdated', data);
  });

  socket.on('sessionUpdate', (data) => {
    socket.broadcast.emit('sessionUpdated', data);
  });
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found'
  });
});

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.ORCHESTRATOR_PORT || 3005;

server.listen(PORT, () => {
  console.log(`DevFlow Orchestrator running on port ${PORT}`);
});

export { app, io };
