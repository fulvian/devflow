export * from '@devflow/shared';
export * from './database/connection.js';
export * from './database/migrations.js';
export * from './database/transaction.js';
export * from './database/queries.js';
export * from './memory/manager.js';
export * from './memory/blocks.js';
export * from './memory/sessions.js';
export * from './memory/contexts.js';
export * from './memory/search.js';
export * from './memory/compaction.js';

// Multi-platform coordination exports
export { MultiPlatformCoordinator, type TaskRequest, type TaskResult } from './coordinator/multi-platform-coordinator.js';
export { EnhancedTaskRouter, type RoutingDecision } from './routing/enhanced-task-router.js';
export { UnifiedSmartGateway, type UnifiedGatewayConfig, type ExecutionOptions, type ExecutionResult } from './gateway/unified-smart-gateway.js';
export { UnifiedCostTracker, type CostEvent, type CostSummary, type BudgetLimits } from './analytics/unified-cost-tracker.js';

// CCR Session Independence exports
export * from './coordination/index.js';

// ML Vector Embeddings exports
export * from './ml/index.js';
