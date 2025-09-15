import { Router } from 'express';
import { ApiResponse } from '../types';
import { SyntheticService, SyntheticCodeRequestSchema, SyntheticReasoningRequestSchema, SyntheticResponseSchema } from '../services/synthetic';
import { createSyntheticProviderFromEnv } from '../services/provider-registry';
import { recordUsage } from '../services/usage';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Provider wiring (pluggable via env + fallback)
let service: SyntheticService;
(async () => {
  const provider = await createSyntheticProviderFromEnv();
  service = new SyntheticService(provider);
})();

// POST /api/synthetic/code
router.post('/code', async (req, res, next) => {
  try {
    const parsed = SyntheticCodeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid codegen payload', details: parsed.error.flatten() }, timestamp: new Date().toISOString() });
    }
    if (!service) {
      return res.status(503).json({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Synthetic service not initialized' }, timestamp: new Date().toISOString() });
    }
    const result = await service.code(parsed.data);
    const validated = SyntheticResponseSchema.parse(result);
    try {
      recordUsage({
        id: uuidv4(),
        provider: validated.metadata.provider ?? 'unknown',
        agentType: 'code',
        model: validated.metadata.model,
        durationMs: validated.metadata.processingTime,
        tokensIn: validated.metadata.tokensIn,
        tokensOut: validated.metadata.tokensOut,
        costUsd: validated.metadata.costUsd,
        createdAt: new Date().toISOString(),
      });
    } catch {}
    const response: ApiResponse = { success: true, data: validated, timestamp: new Date().toISOString() };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/synthetic/reasoning
router.post('/reasoning', async (req, res, next) => {
  try {
    const parsed = SyntheticReasoningRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid reasoning payload', details: parsed.error.flatten() }, timestamp: new Date().toISOString() });
    }
    if (!service) {
      return res.status(503).json({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Synthetic service not initialized' }, timestamp: new Date().toISOString() });
    }
    const result = await service.reasoning(parsed.data);
    const validated = SyntheticResponseSchema.parse(result);
    try {
      recordUsage({
        id: uuidv4(),
        provider: validated.metadata.provider ?? 'unknown',
        agentType: 'reasoning',
        model: validated.metadata.model,
        durationMs: validated.metadata.processingTime,
        tokensIn: validated.metadata.tokensIn,
        tokensOut: validated.metadata.tokensOut,
        costUsd: validated.metadata.costUsd,
        createdAt: new Date().toISOString(),
      });
    } catch {}
    const response: ApiResponse = { success: true, data: validated, timestamp: new Date().toISOString() };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

export { router as syntheticRoutes };
