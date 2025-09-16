/**
 * Cross-Platform API Routes
 * DevFlow v3.1 - Unified API for 4 AI Coding Platforms
 */

import { Router, Request, Response } from 'express';
import { CrossPlatformRouter } from '../services/cross-platform-router';
import { UnifiedRequest, RouteStrategy } from '../../../../src/types/cross-platform';

const router = Router();
const crossPlatformRouter = new CrossPlatformRouter();

// POST /api/cross-platform/route - Main routing endpoint
router.post('/route', async (req: Request, res: Response) => {
  try {
    const unifiedRequest: UnifiedRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      platform: req.body.platform,
      type: req.body.type,
      context: req.body.context,
      preferences: req.body.preferences || {
        preferredPlatforms: ['claude-code'],
        fallbackBehavior: 'cascade',
        qualityThreshold: 0.8,
        maxLatency: 5000,
        costSensitive: false
      }
    };

    const response = await crossPlatformRouter.route(unifiedRequest);

    res.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTING_ERROR',
        message: error instanceof Error ? error.message : 'Unknown routing error'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/cross-platform/platforms - List available platforms
router.get('/platforms', (req: Request, res: Response) => {
  try {
    const platforms = crossPlatformRouter.getPlatforms();

    res.json({
      success: true,
      data: {
        platforms,
        total: platforms.length,
        enabled: platforms.filter(p => p.enabled).length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'PLATFORMS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to retrieve platforms'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/cross-platform/metrics - Platform usage metrics
router.get('/metrics', (req: Request, res: Response) => {
  try {
    const metrics = crossPlatformRouter.getMetrics();

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'METRICS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to retrieve metrics'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// PUT /api/cross-platform/strategy - Update routing strategy
router.put('/strategy', (req: Request, res: Response) => {
  try {
    const strategy: RouteStrategy = req.body;

    // Validate strategy
    const validAlgorithms = ['round-robin', 'quality-based', 'cost-optimized', 'latency-first'];
    if (!validAlgorithms.includes(strategy.algorithm)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STRATEGY',
          message: `Algorithm must be one of: ${validAlgorithms.join(', ')}`
        },
        timestamp: new Date().toISOString()
      });
    }

    crossPlatformRouter.updateStrategy(strategy);

    res.json({
      success: true,
      data: {
        message: 'Routing strategy updated successfully',
        strategy
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'STRATEGY_UPDATE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update strategy'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/cross-platform/completion - Code completion endpoint
router.post('/completion', async (req: Request, res: Response) => {
  try {
    const unifiedRequest: UnifiedRequest = {
      id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      platform: req.body.platform,
      type: 'completion',
      context: {
        language: req.body.language || 'typescript',
        framework: req.body.framework,
        fileContent: req.body.fileContent,
        selection: req.body.selection,
        projectType: req.body.projectType,
        dependencies: req.body.dependencies
      },
      preferences: req.body.preferences || {
        preferredPlatforms: ['claude-code', 'cursor'],
        fallbackBehavior: 'cascade',
        qualityThreshold: 0.8,
        maxLatency: 3000,
        costSensitive: false
      }
    };

    const response = await crossPlatformRouter.route(unifiedRequest);

    res.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'COMPLETION_ERROR',
        message: error instanceof Error ? error.message : 'Code completion failed'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/cross-platform/chat - Chat endpoint
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const unifiedRequest: UnifiedRequest = {
      id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      platform: req.body.platform,
      type: 'chat',
      context: {
        language: req.body.language || 'typescript',
        framework: req.body.framework,
        fileContent: req.body.fileContent,
        projectType: req.body.projectType
      },
      preferences: req.body.preferences || {
        preferredPlatforms: ['claude-code'],
        fallbackBehavior: 'cascade',
        qualityThreshold: 0.8,
        maxLatency: 5000,
        costSensitive: false
      }
    };

    const response = await crossPlatformRouter.route(unifiedRequest);

    res.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CHAT_ERROR',
        message: error instanceof Error ? error.message : 'Chat request failed'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/cross-platform/auth - Check authentication status for all platforms
router.get('/auth', async (req: Request, res: Response) => {
  try {
    const authStatus = await crossPlatformRouter.getPlatformAuthStatus();
    const authenticatedPlatforms = await crossPlatformRouter.getAuthenticatedPlatforms();

    res.json({
      success: true,
      data: {
        platforms: authStatus,
        authenticated: authenticatedPlatforms,
        total: authStatus.length,
        authenticatedCount: authenticatedPlatforms.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_CHECK_ERROR',
        message: error instanceof Error ? error.message : 'Authentication check failed'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/cross-platform/health - Health check for cross-platform system
router.get('/health', async (req: Request, res: Response) => {
  try {
    const platforms = crossPlatformRouter.getPlatforms();
    const metrics = crossPlatformRouter.getMetrics();
    const authenticatedPlatforms = await crossPlatformRouter.getAuthenticatedPlatforms();

    const healthStatus = {
      status: 'OK',
      service: 'cross-platform-router',
      platforms: {
        total: platforms.length,
        enabled: platforms.filter(p => p.enabled).length,
        available: platforms.filter(p => p.enabled).map(p => p.name),
        authenticated: authenticatedPlatforms
      },
      metrics: {
        totalRequests: metrics.totalRequests,
        averageSuccessRate: Object.values(metrics.successRates).reduce((a, b) => a + b, 0) / Object.keys(metrics.successRates).length || 0
      },
      timestamp: new Date().toISOString()
    };

    res.json(healthStatus);
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      service: 'cross-platform-router',
      error: error instanceof Error ? error.message : 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

export { router as crossPlatformRoutes };