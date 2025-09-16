/**
 * Usage Monitor Routes
 * DevFlow v3.1 - Monitor and manage platform usage limits
 */

import { Router, Request, Response } from 'express';
import { SyntheticPriorityRouter } from '../services/synthetic-priority-router';

const router = Router();
const syntheticPriorityRouter = new SyntheticPriorityRouter();

// GET /api/usage/status - Get current usage status for all platforms
router.get('/status', (req: Request, res: Response) => {
  try {
    const usageStatus = syntheticPriorityRouter.getUsageStatus();

    res.json({
      success: true,
      data: {
        synthetic: {
          daily: {
            used: usageStatus.synthetic.daily.used,
            limit: usageStatus.synthetic.daily.limit,
            percentage: (usageStatus.synthetic.daily.used / usageStatus.synthetic.daily.limit * 100).toFixed(1)
          },
          hourly: {
            used: usageStatus.synthetic.hourly.used,
            limit: usageStatus.synthetic.hourly.limit,
            percentage: (usageStatus.synthetic.hourly.used / usageStatus.synthetic.hourly.limit * 100).toFixed(1)
          },
          costBudget: {
            used: usageStatus.synthetic.costBudget.used.toFixed(2),
            limit: usageStatus.synthetic.costBudget.limit.toFixed(2),
            percentage: (usageStatus.synthetic.costBudget.used / usageStatus.synthetic.costBudget.limit * 100).toFixed(1)
          }
        },
        platforms: Object.entries(usageStatus.platforms).map(([name, limits]) => ({
          name,
          daily: {
            used: limits.daily.used,
            limit: limits.daily.limit,
            percentage: (limits.daily.used / limits.daily.limit * 100).toFixed(1)
          },
          hourly: {
            used: limits.hourly.used,
            limit: limits.hourly.limit,
            percentage: (limits.hourly.used / limits.hourly.limit * 100).toFixed(1)
          },
          costSensitive: limits.costSensitive,
          status: limits.hourly.used >= limits.hourly.limit ? 'EXHAUSTED' :
                 limits.hourly.used / limits.hourly.limit > 0.8 ? 'WARNING' : 'OK'
        }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'USAGE_STATUS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get usage status'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/usage/recommendations - Get platform recommendations based on current usage
router.get('/recommendations', (req: Request, res: Response) => {
  try {
    const usageStatus = syntheticPriorityRouter.getUsageStatus();
    const recommendations: string[] = [];

    // Check Synthetic status
    const syntheticHourlyUsage = usageStatus.synthetic.hourly.used / usageStatus.synthetic.hourly.limit;
    const syntheticCostUsage = usageStatus.synthetic.costBudget.used / usageStatus.synthetic.costBudget.limit;

    if (syntheticCostUsage > 0.9) {
      recommendations.push('Synthetic cost budget nearly exhausted - consider using free CLI platforms (Gemini, Qwen)');
    } else if (syntheticHourlyUsage > 0.8) {
      recommendations.push('Synthetic hourly limit approaching - requests will fallback to CLI platforms');
    } else if (syntheticHourlyUsage < 0.3) {
      recommendations.push('Synthetic usage is low - good time for complex tasks requiring high quality');
    }

    // Check CLI platforms
    for (const [platform, limits] of Object.entries(usageStatus.platforms)) {
      const hourlyUsage = limits.hourly.used / limits.hourly.limit;

      if (hourlyUsage >= 1.0) {
        recommendations.push(`${platform} hourly limit exceeded - avoid using until next hour`);
      } else if (hourlyUsage > 0.8) {
        recommendations.push(`${platform} approaching hourly limit (${(hourlyUsage * 100).toFixed(0)}%) - use sparingly`);
      } else if (hourlyUsage < 0.2 && !limits.costSensitive) {
        recommendations.push(`${platform} has low usage - good option for current tasks`);
      }
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('All platforms have healthy usage levels - optimal routing available');
    }

    res.json({
      success: true,
      data: {
        recommendations,
        optimalStrategy: syntheticCostUsage < 0.8 ? 'synthetic-first' : 'cli-optimized',
        nextResetTime: {
          hourly: new Date(Date.now() + (60 - new Date().getMinutes()) * 60000).toISOString(),
          daily: new Date(Date.now() + (24 - new Date().getHours()) * 3600000).toISOString()
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'RECOMMENDATIONS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to generate recommendations'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/usage/reset-hourly - Reset hourly limits (admin function)
router.post('/reset-hourly', (req: Request, res: Response) => {
  try {
    syntheticPriorityRouter.resetHourlyLimits();

    res.json({
      success: true,
      data: {
        message: 'Hourly usage limits reset successfully',
        resetTime: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'RESET_ERROR',
        message: error instanceof Error ? error.message : 'Failed to reset hourly limits'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/usage/reset-daily - Reset daily limits (admin function)
router.post('/reset-daily', (req: Request, res: Response) => {
  try {
    syntheticPriorityRouter.resetDailyLimits();

    res.json({
      success: true,
      data: {
        message: 'Daily usage limits and cost budget reset successfully',
        resetTime: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'RESET_ERROR',
        message: error instanceof Error ? error.message : 'Failed to reset daily limits'
      },
      timestamp: new Date().toISOString()
    });
  }
});

export { router as usageMonitorRoutes };