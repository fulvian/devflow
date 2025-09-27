/**
 * DevFlow Memory System Type Definitions
 * Comprehensive types for the 4-layer memory architecture
 */
// ============================================================================
// ERROR AND VALIDATION TYPES
// ============================================================================
export class MemoryError extends Error {
    code;
    context;
    constructor(message, code, context) {
        super(message);
        this.code = code;
        this.context = context;
        this.name = 'MemoryError';
    }
}
//# sourceMappingURL=memory.js.map