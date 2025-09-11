/**
 * Coordination Module - CCR Session Independence
 *
 * Provides session independence and automatic fallback capabilities
 * when Claude Code reaches session limits.
 */
export { CCRFallbackManager } from './ccr-fallback-manager.js';
export { SessionLimitDetector } from './session-limit-detector.js';
export { ContextPreservation } from './context-preservation.js';
export type { CCRConfig, PreservedContext, PlatformHandoff } from './ccr-fallback-manager.js';
export type { SessionMetrics, LimitThresholds, DetectionConfig } from './session-limit-detector.js';
export type { ContextSnapshot, PreservationConfig } from './context-preservation.js';
//# sourceMappingURL=index.d.ts.map