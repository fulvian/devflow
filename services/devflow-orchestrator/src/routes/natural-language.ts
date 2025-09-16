/**
 * Natural Language Interface Routes
 * DevFlow v3.1 - User-friendly commands in natural language
 */

import { Router, Request, Response } from 'express';
import { SyntheticPriorityRouter } from '../services/synthetic-priority-router';
import { UnifiedRequest } from '../../../../src/types/cross-platform';

const router = Router();
const syntheticPriorityRouter = new SyntheticPriorityRouter();

// Natural Language Command Patterns
const COMMAND_PATTERNS = {
  code_completion: [
    /complete?\s+(this|the)\s+code/i,
    /finish?\s+(this|the)\s+(function|method|class)/i,
    /auto-?complete/i,
    /(suggest|generate)\s+code/i
  ],
  refactoring: [
    /refactor\s+(this|the)/i,
    /improve\s+(this|the)\s+code/i,
    /clean\s+up\s+(this|the)/i,
    /optimize\s+(this|the)/i,
    /make\s+(this|the)\s+better/i
  ],
  explanation: [
    /explain\s+(this|the)/i,
    /what\s+does\s+(this|the)/i,
    /how\s+does\s+(this|the)/i,
    /understand\s+(this|the)/i,
    /analyze\s+(this|the)/i
  ],
  debugging: [
    /(debug|fix)\s+(this|the)/i,
    /what'?s\s+wrong\s+with/i,
    /find\s+(the\s+)?(bug|error|issue)/i,
    /why\s+(is|does|doesn'?t)/i
  ],
  generation: [
    /(create|generate|write)\s+/i,
    /build\s+/i,
    /make\s+(a|an)\s+/i,
    /implement\s+/i
  ]
};

// POST /api/natural - Main natural language interface
router.post('/', async (req: Request, res: Response) => {
  try {
    const { message, context, preferences } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_MESSAGE',
          message: 'Natural language message is required'
        },
        timestamp: new Date().toISOString()
      });
    }

    // Classify the request type from natural language
    const requestType = classifyRequest(message);

    // Build unified request
    const unifiedRequest: UnifiedRequest = {
      id: `nl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: requestType,
      context: {
        language: context?.language || 'typescript',
        framework: context?.framework,
        fileContent: context?.fileContent,
        selection: context?.selection,
        projectType: context?.projectType,
        dependencies: context?.dependencies
      },
      preferences: {
        preferredPlatforms: preferences?.preferredPlatforms || ['synthetic', 'claude-code'],
        fallbackBehavior: preferences?.fallbackBehavior || 'cascade',
        qualityThreshold: preferences?.qualityThreshold || 0.8,
        maxLatency: preferences?.maxLatency || 5000,
        costSensitive: preferences?.costSensitive || true
      }
    };

    // Add the original natural language message to context
    unifiedRequest.context.naturalLanguageQuery = message;

    const response = await syntheticPriorityRouter.route(unifiedRequest);

    res.json({
      success: true,
      data: {
        originalMessage: message,
        classifiedAs: requestType,
        response: response,
        suggestions: generateSuggestions(requestType, context)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'NATURAL_LANGUAGE_ERROR',
        message: error instanceof Error ? error.message : 'Natural language processing failed'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/natural/explain - Simplified explanation endpoint
router.post('/explain', async (req: Request, res: Response) => {
  try {
    const { code, language = 'typescript' } = req.body;

    const unifiedRequest: UnifiedRequest = {
      id: `explain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: 'explanation',
      context: {
        language,
        fileContent: code,
        naturalLanguageQuery: 'Explain this code'
      },
      preferences: {
        preferredPlatforms: ['synthetic', 'claude-code', 'gemini'],
        fallbackBehavior: 'cascade',
        qualityThreshold: 0.8,
        maxLatency: 5000,
        costSensitive: true
      }
    };

    const response = await syntheticPriorityRouter.route(unifiedRequest);

    res.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'EXPLANATION_ERROR',
        message: error instanceof Error ? error.message : 'Code explanation failed'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/natural/refactor - Simplified refactoring endpoint
router.post('/refactor', async (req: Request, res: Response) => {
  try {
    const { code, language = 'typescript', instructions } = req.body;

    const unifiedRequest: UnifiedRequest = {
      id: `refactor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: 'refactoring',
      context: {
        language,
        fileContent: code,
        naturalLanguageQuery: instructions || 'Refactor this code to improve quality and maintainability'
      },
      preferences: {
        preferredPlatforms: ['synthetic', 'claude-code', 'codex'],
        fallbackBehavior: 'cascade',
        qualityThreshold: 0.9,
        maxLatency: 10000,
        costSensitive: true
      }
    };

    const response = await syntheticPriorityRouter.route(unifiedRequest);

    res.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'REFACTORING_ERROR',
        message: error instanceof Error ? error.message : 'Code refactoring failed'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/natural/generate - Code generation endpoint
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { description, language = 'typescript', framework, requirements } = req.body;

    const unifiedRequest: UnifiedRequest = {
      id: `generate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: 'generation',
      context: {
        language,
        framework,
        naturalLanguageQuery: description,
        projectType: framework
      },
      preferences: {
        preferredPlatforms: ['synthetic', 'qwen', 'codex'],
        fallbackBehavior: 'cascade',
        qualityThreshold: 0.8,
        maxLatency: 15000,
        costSensitive: true
      }
    };

    if (requirements && Array.isArray(requirements)) {
      unifiedRequest.context.dependencies = requirements;
    }

    const response = await syntheticPriorityRouter.route(unifiedRequest);

    res.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'GENERATION_ERROR',
        message: error instanceof Error ? error.message : 'Code generation failed'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/natural/examples - Show usage examples
router.get('/examples', (req: Request, res: Response) => {
  const examples = {
    completion: [
      "Complete this function",
      "Finish the implementation",
      "Auto-complete this code",
      "Suggest code completion"
    ],
    refactoring: [
      "Refactor this code",
      "Improve this function",
      "Clean up this implementation",
      "Optimize this algorithm",
      "Make this code better"
    ],
    explanation: [
      "Explain this code",
      "What does this function do?",
      "How does this work?",
      "Analyze this implementation"
    ],
    debugging: [
      "Debug this code",
      "Fix this bug",
      "What's wrong with this?",
      "Find the error in this code"
    ],
    generation: [
      "Create a REST API endpoint",
      "Generate a TypeScript interface",
      "Build a React component",
      "Write a utility function"
    ]
  };

  res.json({
    success: true,
    data: {
      examples,
      usage: {
        endpoint: '/api/natural',
        method: 'POST',
        body: {
          message: 'Your natural language request',
          context: {
            language: 'typescript',
            fileContent: 'optional code context',
            framework: 'optional framework'
          },
          preferences: {
            preferredPlatforms: ['synthetic', 'claude-code'],
            costSensitive: true
          }
        }
      }
    },
    timestamp: new Date().toISOString()
  });
});

function classifyRequest(message: string): string {
  for (const [type, patterns] of Object.entries(COMMAND_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        return type.replace('_', '-');
      }
    }
  }

  // Default to chat if no specific pattern matches
  return 'chat';
}

function generateSuggestions(requestType: string, context: any): string[] {
  const suggestions = {
    'code-completion': [
      'Try: "Complete this function with error handling"',
      'Try: "Finish this implementation with TypeScript types"'
    ],
    'refactoring': [
      'Try: "Refactor this to use modern JavaScript features"',
      'Try: "Improve this code for better performance"'
    ],
    'explanation': [
      'Try: "Explain this code step by step"',
      'Try: "What are the potential issues with this implementation?"'
    ],
    'debugging': [
      'Try: "Find performance bottlenecks in this code"',
      'Try: "Check for security vulnerabilities"'
    ],
    'generation': [
      'Try: "Create a similar function for handling errors"',
      'Try: "Generate unit tests for this code"'
    ]
  };

  return suggestions[requestType] || [
    'Try being more specific about what you need',
    'Include code context for better results'
  ];
}

export { router as naturalLanguageRoutes };