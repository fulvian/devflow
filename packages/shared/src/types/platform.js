/**
 * DevFlow Platform Coordination Type Definitions
 * Types for cross-platform AI coordination and task routing
 */
// ============================================================================
// ERROR HANDLING
// ============================================================================
export class PlatformError extends Error {
    platform;
    code;
    context;
    constructor(message, platform, code, context) {
        super(message);
        this.platform = platform;
        this.code = code;
        this.context = context;
        this.name = 'PlatformError';
    }
}
export class CoordinationError extends Error {
    phase;
    platforms;
    context;
    constructor(message, phase, platforms, context) {
        super(message);
        this.phase = phase;
        this.platforms = platforms;
        this.context = context;
        this.name = 'CoordinationError';
    }
}
//# sourceMappingURL=platform.js.map