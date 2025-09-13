/**
 * Memory Integration API for Codex MCP Server
 * 
 * This module implements REST API endpoints for memory operations including:
 * - Context persistence and retrieval
 * - Session management
 * - Memory cleanup operations
 * 
 * Task ID: CCR-003-MEMORY-INTEGRATION
 */

import express, { Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';

// Types for memory operations
interface MemoryContext {
  id: string;
  sessionId: string;
  data: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

interface Session {
  id: string;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

// In-memory storage (in production, this would be replaced with a database)
const memoryStore: Map<string, MemoryContext> = new Map();
const sessionStore: Map<string, Session> = new Map();

// Validation middleware
const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }
  next();
};

// Security middleware
const authenticate = (req: Request, res: Response, next: NextFunction) => {
  // In production, implement proper authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  // Validate token here
  next();
};

// Memory router
const memoryRouter = express.Router();

/**
 * @openapi
 * /memory/context:
 *   post:
 *     summary: Store context data
 *     description: Persist context data associated with a session
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionId:
 *                 type: string
 *                 description: Session identifier
 *               data:
 *                 type: object
 *                 description: Context data to store
 *               ttl:
 *                 type: integer
 *                 description: Time to live in seconds
 *     responses:
 *       201:
 *         description: Context stored successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 sessionId:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 */
memoryRouter.post(
  '/context',
  authenticate,
  body('sessionId').isString().notEmpty(),
  body('data').isObject(),
  body('ttl').optional().isInt({ min: 1 }),
  validate,
  (req: Request, res: Response) => {
    try {
      const { sessionId, data, ttl } = req.body;
      
      // Validate session exists
      if (!sessionStore.has(sessionId)) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      const contextId = uuidv4();
      const now = new Date();
      const expiresAt = ttl ? new Date(now.getTime() + ttl * 1000) : undefined;
      
      const context: MemoryContext = {
        id: contextId,
        sessionId,
        data,
        createdAt: now,
        updatedAt: now,
        expiresAt
      };
      
      memoryStore.set(contextId, context);
      
      // Update session timestamp
      const session = sessionStore.get(sessionId);
      if (session) {
        session.updatedAt = now;
        sessionStore.set(sessionId, session);
      }
      
      res.status(201).json({
        id: contextId,
        sessionId
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to store context' });
    }
  }
);

/**
 * @openapi
 * /memory/context/{id}:
 *   get:
 *     summary: Retrieve context data
 *     description: Get stored context data by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Context identifier
 *     responses:
 *       200:
 *         description: Context data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MemoryContext'
 *       404:
 *         description: Context not found
 *       401:
 *         description: Authentication required
 */
memoryRouter.get(
  '/context/:id',
  authenticate,
  param('id').isString().notEmpty(),
  validate,
  (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const context = memoryStore.get(id);
      
      if (!context) {
        return res.status(404).json({ error: 'Context not found' });
      }
      
      // Check if context has expired
      if (context.expiresAt && new Date() > context.expiresAt) {
        memoryStore.delete(id);
        return res.status(404).json({ error: 'Context expired' });
      }
      
      res.json(context);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve context' });
    }
  }
);

/**
 * @openapi
 * /memory/context/{id}:
 *   put:
 *     summary: Update context data
 *     description: Update existing context data
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Context identifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *                 description: Updated context data
 *               ttl:
 *                 type: integer
 *                 description: New time to live in seconds
 *     responses:
 *       200:
 *         description: Context updated successfully
 *       404:
 *         description: Context not found
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 */
memoryRouter.put(
  '/context/:id',
  authenticate,
  param('id').isString().notEmpty(),
  body('data').isObject(),
  body('ttl').optional().isInt({ min: 1 }),
  validate,
  (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { data, ttl } = req.body;
      
      const context = memoryStore.get(id);
      if (!context) {
        return res.status(404).json({ error: 'Context not found' });
      }
      
      // Check if context has expired
      if (context.expiresAt && new Date() > context.expiresAt) {
        memoryStore.delete(id);
        return res.status(404).json({ error: 'Context expired' });
      }
      
      const now = new Date();
      context.data = { ...context.data, ...data };
      context.updatedAt = now;
      
      if (ttl) {
        context.expiresAt = new Date(now.getTime() + ttl * 1000);
      }
      
      memoryStore.set(id, context);
      
      res.json({ message: 'Context updated successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update context' });
    }
  }
);

/**
 * @openapi
 * /memory/context/{id}:
 *   delete:
 *     summary: Delete context data
 *     description: Remove context data by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Context identifier
 *     responses:
 *       204:
 *         description: Context deleted successfully
 *       404:
 *         description: Context not found
 *       401:
 *         description: Authentication required
 */
memoryRouter.delete(
  '/context/:id',
  authenticate,
  param('id').isString().notEmpty(),
  validate,
  (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      if (!memoryStore.has(id)) {
        return res.status(404).json({ error: 'Context not found' });
      }
      
      memoryStore.delete(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete context' });
    }
  }
);

/**
 * @openapi
 * /memory/session:
 *   post:
 *     summary: Create new session
 *     description: Initialize a new memory session
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 description: Associated user identifier
 *               ttl:
 *                 type: integer
 *                 description: Session time to live in seconds
 *     responses:
 *       201:
 *         description: Session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 userId:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 */
memoryRouter.post(
  '/session',
  authenticate,
  body('userId').optional().isString(),
  body('ttl').optional().isInt({ min: 1 }),
  validate,
  (req: Request, res: Response) => {
    try {
      const { userId, ttl } = req.body;
      
      const sessionId = uuidv4();
      const now = new Date();
      const expiresAt = ttl ? new Date(now.getTime() + ttl * 1000) : undefined;
      
      const session: Session = {
        id: sessionId,
        userId,
        createdAt: now,
        updatedAt: now,
        expiresAt,
        isActive: true
      };
      
      sessionStore.set(sessionId, session);
      
      res.status(201).json({
        id: sessionId,
        userId
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create session' });
    }
  }
);

/**
 * @openapi
 * /memory/session/{id}:
 *   get:
 *     summary: Get session information
 *     description: Retrieve session details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Session identifier
 *     responses:
 *       200:
 *         description: Session data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Session'
 *       404:
 *         description: Session not found
 *       401:
 *         description: Authentication required
 */
memoryRouter.get(
  '/session/:id',
  authenticate,
  param('id').isString().notEmpty(),
  validate,
  (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const session = sessionStore.get(id);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // Check if session has expired
      if (session.expiresAt && new Date() > session.expiresAt) {
        sessionStore.delete(id);
        return res.status(404).json({ error: 'Session expired' });
      }
      
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve session' });
    }
  }
);

/**
 * @openapi
 * /memory/session/{id}:
 *   delete:
 *     summary: End session
 *     description: Terminate a session and clean up associated contexts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Session identifier
 *     responses:
 *       204:
 *         description: Session ended successfully
 *       404:
 *         description: Session not found
 *       401:
 *         description: Authentication required
 */
memoryRouter.delete(
  '/session/:id',
  authenticate,
  param('id').isString().notEmpty(),
  validate,
  (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      if (!sessionStore.has(id)) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // Clean up associated contexts
      for (const [contextId, context] of memoryStore.entries()) {
        if (context.sessionId === id) {
          memoryStore.delete(contextId);
        }
      }
      
      sessionStore.delete(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to end session' });
    }
  }
);

/**
 * @openapi
 * /memory/session/{id}/contexts:
 *   get:
 *     summary: List session contexts
 *     description: Retrieve all contexts associated with a session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Session identifier
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Maximum number of contexts to return
 *     responses:
 *       200:
 *         description: List of contexts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MemoryContext'
 *       404:
 *         description: Session not found
 *       401:
 *         description: Authentication required
 */
memoryRouter.get(
  '/session/:id/contexts',
  authenticate,
  param('id').isString().notEmpty(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
  (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      
      const session = sessionStore.get(id);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // Check if session has expired
      if (session.expiresAt && new Date() > session.expiresAt) {
        sessionStore.delete(id);
        return res.status(404).json({ error: 'Session expired' });
      }
      
      const contexts: MemoryContext[] = [];
      let count = 0;
      
      for (const context of memoryStore.values()) {
        if (context.sessionId === id) {
          // Check if context has expired
          if (context.expiresAt && new Date() > context.expiresAt) {
            memoryStore.delete(context.id);
            continue;
          }
          
          contexts.push(context);
          count++;
          
          if (count >= limit) {
            break;
          }
        }
      }
      
      res.json(contexts);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve contexts' });
    }
  }
);

/**
 * @openapi
 * /memory/cleanup:
 *   post:
 *     summary: Cleanup expired data
 *     description: Remove expired contexts and sessions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cleanup completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deletedContexts:
 *                   type: integer
 *                 deletedSessions:
 *                   type: integer
 *       401:
 *         description: Authentication required
 */
memoryRouter.post(
  '/cleanup',
  authenticate,
  (req: Request, res: Response) => {
    try {
      const now = new Date();
      let deletedContexts = 0;
      let deletedSessions = 0;
      
      // Clean up expired contexts
      for (const [id, context] of memoryStore.entries()) {
        if (context.expiresAt && now > context.expiresAt) {
          memoryStore.delete(id);
          deletedContexts++;
        }
      }
      
      // Clean up expired sessions
      for (const [id, session] of sessionStore.entries()) {
        if (session.expiresAt && now > session.expiresAt) {
          sessionStore.delete(id);
          deletedSessions++;
        }
      }
      
      res.json({
        deletedContexts,
        deletedSessions
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to perform cleanup' });
    }
  }
);

// Export router and types
export { memoryRouter };
export type { MemoryContext, Session };