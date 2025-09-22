/**
 * DevFlow Unified Orchestrator - Main Export Index
 *
 * Questo file centralizza tutti gli export dei componenti dell'orchestratore unificato
 * per facilitare l'importazione e l'integrazione tra moduli.
 */

// Core Orchestrator
export {
  UnifiedOrchestrator,
  PlatformRegistry,
  HealthAggregator,
  TaskCoordinator,
  MetricsAggregator,
  type PlatformConfig,
  type PlatformHealth,
  type Task,
  type TaskResult,
  type PerformanceMetrics,
  type OrchestratorEvent,
  type EventListener
} from './core/unified-orchestrator.js';

// Intelligent Routing System
export {
  IntelligentRoutingSystem,
  Platform,
  TaskComplexity,
  TaskType,
  type TaskCharacteristics,
  type PlatformCapabilities,
  type RoutingDecision,
  type PerformanceMetrics as RoutingPerformanceMetrics,
  type MLInsights,
  type RoutingConfig
} from './routing/intelligent-router.js';

// Cross-Platform Handoff System
export {
  CrossPlatformHandoffSystem,
  PlatformType,
  HandoffReason,
  type PlatformContext,
  type HandoffResult,
  type PerformanceMetrics as HandoffPerformanceMetrics,
  type HandoffDecision,
  type HandoffEvent,
  type PlatformAdapter
} from './handoff/cross-platform-handoff.js';

// Operational Modes Manager
export {
  OperationalModesManager,
  ModeCommandInterface,
  type Agent,
  type Task as ModeTask,
  type ModePerformanceMetrics,
  type OperationalMode,
  type ModeConfiguration
} from './modes/operational-modes-manager.js';

// Export types from timeout and verification if available
// Note: These modules may not be fully implemented yet

// Export default per compatibilità
export { UnifiedOrchestrator as default } from './core/unified-orchestrator.js';