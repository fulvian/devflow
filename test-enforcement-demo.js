/**
 * Demo Test for Enforcement System
 * 
 * This standalone test demonstrates the core concepts of an enforcement system:
 * 1. Rule evaluation and enforcement
 *2. Synthetic delegation redirect
 * 3. Console output for verification
 * 
 * No external dependencies required.
 */

// === Core Enforcement System Components ===

/**
 * Rule definition structure
 * @typedef {Object} Rule
 * @property {string} id - Unique rule identifier
 * @property {string} name - Human-readable rule name
 * @property {Function} condition - Function that evaluates to true/false
 * @property {Function} action - Action to take when rule is triggered
 */

/**
 * Enforcement Engine
 */
class EnforcementEngine {
  constructor() {
    this.rules = [];
    this.delegationMap = new Map();
  }

  /**
   * Register a new rule
   * @param {Rule} rule - Rule to register
   */
  addRule(rule) {
    if (!rule.id || !rule.condition || !rule.action) {
      throw new Error('Invalid rule: must have id, condition, and action');
    }
    this.rules.push(rule);
    console.log(`[ENFORCEMENT] Rule registered: ${rule.name} (${rule.id})`);
  }

  /**
   * Evaluate all rules against given context
   * @param {Object} context - Context to evaluate rules against
   */
  evaluate(context) {
    console.log('[ENFORCEMENT] Evaluating rules...');
    
    for (const rule of this.rules) {
      try {
        if (rule.condition(context)) {
          console.log(`[ENFORCEMENT] Rule triggered: ${rule.name}`);
          rule.action(context);
        }
      } catch (error) {
        console.error(`[ENFORCEMENT] Error evaluating rule ${rule.id}:`, error.message);
      }
    }
  }

  /**
   * Register a delegation mapping
   * @param {string} source - Source identifier
   * @param {string} target - Target identifier
   */
  addDelegation(source, target) {
    this.delegationMap.set(source, target);
    console.log(`[DELEGATION] Registered delegation: ${source} -> ${target}`);
  }

  /**
   * Resolve delegation for a given identifier
   * @param {string} identifier - Identifier to resolve
   * @returns {string} Resolved identifier
   */
  resolveDelegation(identifier) {
    const resolved = this.delegationMap.get(identifier) || identifier;
    if (resolved !== identifier) {
      console.log(`[DELEGATION] Redirecting ${identifier} -> ${resolved}`);
    }
    return resolved;
  }
}

// === Demo Implementation ===

/**
 * Demo context object
 * @typedef {Object} DemoContext
 * @property {string} userId - Current user identifier
 * @property {string} action - Action being performed
 * @property {string} resource - Resource being accessed
 * @property {number} timestamp - Timestamp of the action
 */

// Create enforcement engine instance
const engine = new EnforcementEngine();

// Define sample rules
const sensitiveDataRule = {
  id: 'protect-sensitive-data',
  name: 'Protect Sensitive Data',
  condition: (context) => context.resource === 'sensitive-data' && context.action === 'access',
  action: (context) => {
    console.log(`[ACTION] Blocking access to sensitive data by user ${context.userId}`);
    // In a real system, this would actually block the request
  }
};

const adminOnlyRule = {
  id: 'admin-only',
  name: 'Admin Only Access',
  condition: (context) => context.resource === 'admin-panel' && context.userId !== 'admin',
  action: (context) => {
    console.log(`[ACTION] Redirecting user ${context.userId} from admin panel to user dashboard`);
    // Synthetic delegation redirect
    const redirectedUser = engine.resolveDelegation(context.userId);
    console.log(`[ACTION] Delegated to user: ${redirectedUser}`);
  }
};

const rateLimitRule = {
  id: 'rate-limit',
  name: 'Rate Limiting',
  condition: (context) => context.action === 'request' && Date.now() - context.timestamp < 100,
  action: (context) => {
    console.log(`[ACTION] Rate limiting user ${context.userId} for excessive requests`);
  }
};

// Register rules
engine.addRule(sensitiveDataRule);
engine.addRule(adminOnlyRule);
engine.addRule(rateLimitRule);

// Set up delegation mappings
engine.addDelegation('guest', 'user-dashboard');
engine.addDelegation('user123', 'user-profile');
engine.addDelegation('moderator', 'mod-panel');

// === Test Scenarios ===

console.log('\n=== Enforcement System Demo Test ===\n');

// Test 1: Sensitive data access
console.log('Test 1: Sensitive Data Access');
const context1 = {
  userId: 'user123',
  action: 'access',
  resource: 'sensitive-data',
  timestamp: Date.now()
};
engine.evaluate(context1);

// Test 2: Admin panel access by non-admin
console.log('\nTest 2: Admin Panel Access by Non-Admin');
const context2 = {
  userId: 'guest',
  action: 'access',
  resource: 'admin-panel',
  timestamp: Date.now()
};
engine.evaluate(context2);

// Test 3: Normal access (should not trigger any rules)
console.log('\nTest 3: Normal User Access');
const context3 = {
  userId: 'user123',
  action: 'read',
  resource: 'public-data',
  timestamp: Date.now()
};
engine.evaluate(context3);

// Test 4: Rate limiting scenario
console.log('\nTest 4: Rate Limiting');
const context4 = {
  userId: 'user456',
  action: 'request',
  resource: 'api-endpoint',
  timestamp: Date.now()
};
engine.evaluate(context4);

console.log('\n=== Demo Test Complete ===');

// Export for potential use in other modules (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EnforcementEngine, engine };
}