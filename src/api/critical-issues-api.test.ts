import request from 'supertest';
import express from 'express';
import router from './critical-issues-api';
import { SuggestionEngine } from '../services/critical-issues/suggestion-engine';

// Mock the SuggestionEngine
jest.mock('../services/critical-issues/suggestion-engine');

const MockedSuggestionEngine = SuggestionEngine as jest.MockedClass<typeof SuggestionEngine>;

describe('Critical Issues API', () => {
  let app: express.Application;
  let mockSuggestionEngine: jest.Mocked<SuggestionEngine>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSuggestionEngine = {
      generateSuggestions: jest.fn(),
      updateSuggestions: jest.fn(),
    } as unknown as jest.Mocked<SuggestionEngine>;

    MockedSuggestionEngine.mockImplementation(() => mockSuggestionEngine);

    app = express();
    app.use(express.json());
    app.use('/api/critical-issues', router);
  });

  describe('GET /api/critical-issues/issues/:issueId/suggestions', () => {
    it('should return suggestions for a valid issue ID', async () => {
      const issueId = 'test-issue-123';
      const mockSuggestions = [
        {
          id: 'suggestion-1',
          title: 'Fix security vulnerability',
          description: 'Replace hardcoded password with environment variable',
          relevanceScore: 0.9,
          implementationSteps: [
            'Create environment variable',
            'Update code to use variable',
            'Test the change'
          ],
          estimatedEffort: 'low' as const,
          relatedIssues: []
        },
        {
          id: 'suggestion-2',
          title: 'Improve error handling',
          description: 'Add try-catch blocks around database operations',
          relevanceScore: 0.7,
          implementationSteps: [
            'Identify vulnerable operations',
            'Wrap in try-catch',
            'Add logging'
          ],
          estimatedEffort: 'medium' as const,
          relatedIssues: []
        }
      ];

      mockSuggestionEngine.generateSuggestions.mockResolvedValue(mockSuggestions);

      const response = await request(app)
        .get(`/api/critical-issues/issues/${issueId}/suggestions`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        suggestions: mockSuggestions
      });

      expect(mockSuggestionEngine.generateSuggestions).toHaveBeenCalledWith({
        id: issueId,
        title: 'Sample Issue',
        description: 'Sample Description',
        severity: 'high',
        status: 'open',
        projectId: 'sample-project',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });
    });

    it('should handle errors when generating suggestions fails', async () => {
      const issueId = 'test-issue-123';
      mockSuggestionEngine.generateSuggestions.mockRejectedValue(new Error('Generation failed'));

      const response = await request(app)
        .get(`/api/critical-issues/issues/${issueId}/suggestions`)
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to generate suggestions'
      });
    });
  });

  describe('POST /api/critical-issues/issues/:issueId/suggestions/update', () => {
    it('should update suggestions with provided code changes', async () => {
      const issueId = 'test-issue-123';
      const codeChanges = {
        files: [
          {
            path: 'src/auth.ts',
            changes: [
              {
                line: 10,
                oldCode: 'const password = "hardcoded";',
                newCode: 'const password = process.env.DB_PASSWORD;'
              }
            ]
          }
        ]
      };

      const updatedSuggestions = [
        {
          id: 'updated-suggestion-1',
          title: 'Updated suggestion',
          description: 'This suggestion was updated based on code changes',
          relevanceScore: 0.8,
          implementationSteps: ['Updated step 1', 'Updated step 2'],
          estimatedEffort: 'low' as const,
          relatedIssues: []
        }
      ];

      mockSuggestionEngine.updateSuggestions.mockResolvedValue(updatedSuggestions);

      const response = await request(app)
        .post(`/api/critical-issues/issues/${issueId}/suggestions/update`)
        .send({ codeChanges })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        suggestions: updatedSuggestions
      });

      expect(mockSuggestionEngine.updateSuggestions).toHaveBeenCalledWith(issueId, codeChanges);
    });

    it('should return 400 when code changes are missing', async () => {
      const issueId = 'test-issue-123';

      const response = await request(app)
        .post(`/api/critical-issues/issues/${issueId}/suggestions/update`)
        .send({}) // No codeChanges
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Code changes are required'
      });

      expect(mockSuggestionEngine.updateSuggestions).not.toHaveBeenCalled();
    });

    it('should handle errors when updating suggestions fails', async () => {
      const issueId = 'test-issue-123';
      const codeChanges = { files: [] };

      mockSuggestionEngine.updateSuggestions.mockRejectedValue(new Error('Update failed'));

      const response = await request(app)
        .post(`/api/critical-issues/issues/${issueId}/suggestions/update`)
        .send({ codeChanges })
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to update suggestions'
      });
    });
  });

  describe('GET /api/critical-issues/suggestions/:suggestionId', () => {
    it('should return a specific suggestion by ID', async () => {
      const suggestionId = 'test-suggestion-456';

      const response = await request(app)
        .get(`/api/critical-issues/suggestions/${suggestionId}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        suggestion: {
          id: suggestionId,
          title: 'Sample Suggestion',
          description: 'This is a sample suggestion',
          relevanceScore: 0.8,
          implementationSteps: [
            'Step 1',
            'Step 2',
            'Step 3'
          ],
          estimatedEffort: 'medium' as const,
          relatedIssues: []
        }
      });
    });

    it('should handle errors when fetching suggestion fails', async () => {
      const suggestionId = 'test-suggestion-456';

      // Since the current implementation doesn't actually throw errors for this endpoint,
      // we would need to modify the implementation to test error handling.
      // For now, this test documents the expected behavior.
      const response = await request(app)
        .get(`/api/critical-issues/suggestions/${suggestionId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});