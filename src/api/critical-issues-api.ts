import express, { Request, Response } from 'express';
import { SuggestionEngine, Suggestion } from '../services/critical-issues/suggestion-engine';
import { Issue } from '../types/critical-issues';

const router = express.Router();
const suggestionEngine = new SuggestionEngine();

// Get suggestions for an issue
router.get('/issues/:issueId/suggestions', async (req: Request, res: Response) => {
  try {
    const { issueId } = req.params;
    
    // In a real implementation, fetch the actual issue from database
    const issue: Issue = {
      id: issueId,
      title: 'Sample Issue',
      description: 'Sample Description',
      severity: 'high',
      status: 'open',
      projectId: 'sample-project',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const suggestions: Suggestion[] = await suggestionEngine.generateSuggestions(issue);
    
    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate suggestions'
    });
  }
});

// Update suggestions based on code changes
router.post('/issues/:issueId/suggestions/update', async (req: Request, res: Response) => {
  try {
    const { issueId } = req.params;
    const { codeChanges } = req.body;
    
    if (!codeChanges) {
      return res.status(400).json({
        success: false,
        error: 'Code changes are required'
      });
    }
    
    const updatedSuggestions: Suggestion[] = await suggestionEngine.updateSuggestions(issueId, codeChanges);
    
    res.json({
      success: true,
      suggestions: updatedSuggestions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update suggestions'
    });
  }
});

// Get a specific suggestion
router.get('/suggestions/:suggestionId', async (req: Request, res: Response) => {
  try {
    const { suggestionId } = req.params;
    
    // In a real implementation, fetch the suggestion from database
    // For now, returning a mock suggestion
    const suggestion: Suggestion = {
      id: suggestionId,
      title: 'Sample Suggestion',
      description: 'This is a sample suggestion',
      relevanceScore: 0.8,
      implementationSteps: [
        'Step 1',
        'Step 2',
        'Step 3'
      ],
      estimatedEffort: 'medium',
      relatedIssues: []
    };
    
    res.json({
      success: true,
      suggestion
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch suggestion'
    });
  }
});

export default router;
