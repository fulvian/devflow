import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Define the Session interface
interface Session {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  data: Record<string, any>;
}

// Create router instance
const router = express.Router();

// File path for session storage
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');

/**
 * Helper function to read sessions from file
 */
const readSessionsFromFile = (): Session[] => {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading sessions file:', error);
    return [];
  }
};

/**
 * Helper function to write sessions to file
 */
const writeSessionsToFile = (sessions: Session[]): void => {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  } catch (error) {
    console.error('Error writing sessions file:', error);
    throw new Error('Failed to write sessions to storage');
  }
};

/**
 * GET /sessions/:id
 * Retrieve a session by ID
 */
router.get('/:id', (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const sessions = readSessionsFromFile();
    const session = sessions.find(s => s.id === id);
    
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        message: 'Session not found' 
      });
    }
    
    return res.status(200).json({ 
      success: true, 
      data: session 
    });
  } catch (error) {
    console.error('Error retrieving session:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

/**
 * POST /sessions
 * Create a new session
 */
router.post('/', (req: express.Request, res: express.Response) => {
  try {
    const { userId, expiresAt, data } = req.body;
    
    // Validate required fields
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'userId is required' 
      });
    }
    
    const sessions = readSessionsFromFile();
    
    // Create new session
    const newSession: Session = {
      id: uuidv4(),
      userId,
      createdAt: new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000), // Default 24 hours
      data: data || {}
    };
    
    sessions.push(newSession);
    writeSessionsToFile(sessions);
    
    return res.status(201).json({ 
      success: true, 
      data: newSession 
    });
  } catch (error) {
    console.error('Error creating session:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

/**
 * PUT /sessions/:id
 * Update an existing session
 */
router.put('/:id', (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { expiresAt, data } = req.body;
    
    const sessions = readSessionsFromFile();
    const sessionIndex = sessions.findIndex(s => s.id === id);
    
    if (sessionIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'Session not found' 
      });
    }
    
    // Update session fields
    if (expiresAt) {
      sessions[sessionIndex].expiresAt = new Date(expiresAt);
    }
    
    if (data) {
      sessions[sessionIndex].data = { 
        ...sessions[sessionIndex].data, 
        ...data 
      };
    }
    
    writeSessionsToFile(sessions);
    
    return res.status(200).json({ 
      success: true, 
      data: sessions[sessionIndex] 
    });
  } catch (error) {
    console.error('Error updating session:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

/**
 * DELETE /sessions/:id
 * Delete a session by ID
 */
router.delete('/:id', (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    let sessions = readSessionsFromFile();
    const sessionIndex = sessions.findIndex(s => s.id === id);
    
    if (sessionIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'Session not found' 
      });
    }
    
    // Remove session
    sessions = sessions.filter(s => s.id !== id);
    writeSessionsToFile(sessions);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Session deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

/**
 * GET /sessions/user/:userId
 * Retrieve all sessions for a specific user
 */
router.get('/user/:userId', (req: express.Request, res: express.Response) => {
  try {
    const { userId } = req.params;
    const sessions = readSessionsFromFile();
    const userSessions = sessions.filter(s => s.userId === userId);
    
    return res.status(200).json({ 
      success: true, 
      data: userSessions 
    });
  } catch (error) {
    console.error('Error retrieving user sessions:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

export default router;