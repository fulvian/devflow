// src/index.ts
import express, { Application, Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { errorHandler } from './middleware/errorHandler';
import { authenticateToken, authorizeRole } from './middleware/auth';
import projectRoutes from './routes/projects';
import planRoutes from './routes/plans';
import roadmapRoutes from './routes/roadmaps';
import macroTaskRoutes from './routes/macroTasks';
import progressRoutes from './routes/progress';
import { ProjectLifecycleManager } from './services/projectLifecycleManager';
import { DatabaseManager } from './services/databaseManager';
import { NotificationService } from './services/notificationService';
import { logger } from './utils/logger';

class ProjectLifecycleAPI {
  public app: Application;
  public server: http.Server;
  public io: SocketIOServer;
  public dbManager: DatabaseManager;
  public lifecycleManager: ProjectLifecycleManager;
  public notificationService: NotificationService;

  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    // Initialize services
    this.dbManager = new DatabaseManager();
    this.lifecycleManager = new ProjectLifecycleManager(this.dbManager);
    this.notificationService = new NotificationService(this.io);

    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeWebSocket();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    });
    this.app.use(limiter);

    // Swagger documentation
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  }

  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
    });

    // API routes with authentication
    this.app.use('/api/v1/projects', authenticateToken, projectRoutes);
    this.app.use('/api/v1/plans', authenticateToken, planRoutes);
    this.app.use('/api/v1/roadmaps', authenticateToken, roadmapRoutes);
    this.app.use('/api/v1/macro-tasks', authenticateToken, macroTaskRoutes);
    this.app.use('/api/v1/progress', authenticateToken, progressRoutes);

    // Admin routes with additional authorization
    this.app.use('/api/v1/admin', authenticateToken, authorizeRole('admin'), (req, res) => {
      res.status(200).json({ message: 'Admin access granted' });
    });
  }

  private initializeWebSocket(): void {
    this.io.on('connection', (socket) => {
      logger.info(`User connected: ${socket.id}`);
      
      socket.on('disconnect', () => {
        logger.info(`User disconnected: ${socket.id}`);
      });
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public async start(port: number): Promise<void> {
    try {
      await this.dbManager.initialize();
      this.server.listen(port, () => {
        logger.info(`Project Lifecycle Management API server running on port ${port}`);
        logger.info(`Swagger documentation available at http://localhost:${port}/api-docs`);
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Create and start the server
const server = new ProjectLifecycleAPI();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

server.start(PORT);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await server.dbManager.close();
  server.server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await server.dbManager.close();
  server.server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

export default ProjectLifecycleAPI;