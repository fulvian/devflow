import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { generateSyntheticCode, generateSyntheticReasoning } from '../services/synthetic';
import { recordUsage } from '../services/usage';

/**
 * Express router for synthetic API endpoints
 */
const syntheticRouter = Router();

/**
 * Middleware to validate request payloads
 */
const validatePayload = (req: Request, res: Response, next: NextFunction) => {
  const { prompt } = req.body;
  
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({
      error: 'Invalid request payload',
      message: 'Prompt is required and must be a non-empty string'
    });
  }
  
  next();
};

/**
 * POST /code - Generate synthetic code
 */
syntheticRouter.post('/code', validatePayload, async (req: Request, res: Response) => {
  try {
    const { prompt, batch = false } = req.body;
    const requestId = uuidv4();
    
    // Record usage for this API call
    await recordUsage({
      requestId,
      endpoint: '/code',
      timestamp: new Date().toISOString(),
      payload: { prompt, batch }
    });
    
    if (batch) {
      // Handle batch processing
      const batchSize = Array.isArray(prompt) ? prompt.length : 1;
      const results = [];
      
      for (let i = 0; i < batchSize; i++) {
        const currentPrompt = Array.isArray(prompt) ? prompt[i] : prompt;
        const result = await generateSyntheticCode(currentPrompt);
        results.push(result);
      }
      
      return res.json({
        requestId,
        results
      });
    } else {
      // Single prompt processing
      const result = await generateSyntheticCode(prompt);
      
      return res.json({
        requestId,
        result
      });
    }
  } catch (error) {
    console.error('Error in /code endpoint:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate synthetic code'
    });
  }
});

/**
 * POST /reasoning - Generate synthetic reasoning
 */
syntheticRouter.post('/reasoning', validatePayload, async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    const requestId = uuidv4();
    
    // Record usage for this API call
    await recordUsage({
      requestId,
      endpoint: '/reasoning',
      timestamp: new Date().toISOString(),
      payload: { prompt }
    });
    
    const result = await generateSyntheticReasoning(prompt);
    
    return res.json({
      requestId,
      result
    });
  } catch (error) {
    console.error('Error in /reasoning endpoint:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate synthetic reasoning'
    });
  }
});

export default syntheticRouter;