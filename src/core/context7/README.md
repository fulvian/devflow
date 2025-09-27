# Context7 Full Mode Progression System

Comprehensive system for managing Context7 mode transitions with production-ready safety mechanisms and automated monitoring.

## Overview

The Context7 Full Mode Progression System enables safe, gradual transition from Shadow Mode to Full Mode based on quality metrics and system readiness. It implements progressive rollout patterns inspired by deploy-rs with comprehensive validation and automatic rollback capabilities.

## Architecture

### Mode Progression Flow

```
Shadow Mode (0-25% quality)   →   Hybrid Mode (25-75% quality)   →   Full Mode (75%+ quality)
    ↓                                      ↓                                    ↓
Observing only                    Selective integration            Complete Context7 control
No operational impact            Gradual feature activation       Full autonomous operation
```

### Key Components

1. **Context7ModeTransitionController** (`mode-transition-controller.js`)
   - Core transition logic with safety checks
   - Database-backed state management
   - Automatic rollback on failure
   - Progressive validation stages

2. **ProductionReadinessValidator** (`production-readiness-validator.js`)
   - 6-stage comprehensive validation system
   - Critical issue detection and blocking
   - Detailed reporting and recommendations
   - Configurable thresholds and requirements

3. **Context7CLI** (`context7-cli.js`)
   - Production-ready command line interface
   - Status monitoring and reporting
   - Manual transition execution
   - Detailed validation reports

4. **Context7MonitoringIntegration** (`monitoring-integration.js`)
   - Real-time quality monitoring
   - Automatic transition triggers
   - Quality trend analysis
   - Rate limiting and safety controls

## Usage

### Command Line Interface

```bash
# Check current system status
node src/core/context7/context7-cli.js status

# Run production readiness validation
node src/core/context7/context7-cli.js validate

# Execute manual mode transition
node src/core/context7/context7-cli.js transition hybrid "quality_improvement"

# Generate detailed report
node src/core/context7/context7-cli.js report
```

### Programmatic Usage

```javascript
const { Context7ModeTransitionController } = require('./mode-transition-controller');
const { ProductionReadinessValidator } = require('./production-readiness-validator');

// Initialize controller
const controller = new Context7ModeTransitionController();

// Check current status
const status = controller.getCurrentStatus();
console.log(`Current mode: ${status.currentMode}`);

// Get current metrics
const metrics = await controller.getCurrentMetrics();

// Evaluate readiness for transition
const readiness = controller.evaluateTransitionReadiness(metrics, 'hybrid');

// Execute transition if ready
if (readiness.ready) {
    const result = await controller.executeTransition('hybrid', 'automated');
    console.log('Transition completed:', result);
}

// Run comprehensive validation
const validator = new ProductionReadinessValidator();
const validation = await validator.validateProductionReadiness();
console.log('Readiness score:', validation.readinessScore);
```

## Safety Mechanisms

### 1. Multi-Stage Validation

- **Context7 Quality Assessment**: Validates quality, coherence, and precision scores
- **System Performance Assessment**: Checks database and orchestrator performance
- **Data Integrity Assessment**: Verifies database consistency and completeness
- **Service Health Assessment**: Confirms all critical services are operational
- **Task Processing Assessment**: Validates task throughput and failure rates
- **Security & Compliance Assessment**: Ensures security controls are active

### 2. Automatic Rollback

- Triggered on validation failure
- Triggered on quality degradation > 10%
- Triggered on system health issues
- Complete configuration restoration
- Detailed rollback logging

### 3. Quality Trend Analysis

- Continuous quality monitoring
- Trend detection (improving/stable/degrading)
- Stability period validation (5 minutes minimum)
- Historical data analysis (24 hours)

### 4. Rate Limiting

- Maximum 2 auto-transitions per hour
- Minimum stability period between transitions
- Emergency brake on repeated failures
- Manual override capabilities

## Configuration

### Transition Thresholds

```javascript
{
  shadowToHybrid: 0.25,     // 25% quality threshold
  hybridToFull: 0.75,       // 75% quality threshold
  stabilityPeriod: 300000,  // 5 minutes stability required
  rollbackThreshold: 0.10   // 10% quality drop triggers rollback
}
```

### Validation Criteria

#### Hybrid Mode Requirements
- Context7 quality ≥ 25%
- Orchestrator success ≥ 80%
- Completed tasks ≥ 10
- Failure rate ≤ 10%

#### Full Mode Requirements
- Context7 quality ≥ 75%
- Orchestrator success ≥ 95%
- Completed tasks ≥ 25
- Failure rate ≤ 5%
- Coherence score ≥ 70%

## Current System Status

**Mode**: Shadow
**Quality Score**: 53.3%
**Readiness for Full Mode**: Not Ready

### Blocking Issues
1. Context7 quality 53.3% below required 75%
2. Orchestrator success rate 0.0% below required 95%

### Warnings
1. Coherence score 18.5% below optimal 70%
2. Precision score 66.7% below optimal 80%

## Database Schema

### Mode Transitions Table
```sql
CREATE TABLE context7_mode_transitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_mode TEXT NOT NULL,
  to_mode TEXT NOT NULL,
  transition_type TEXT NOT NULL,
  trigger_reason TEXT NOT NULL,
  quality_score REAL,
  orchestrator_success_rate REAL,
  transition_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  completion_timestamp DATETIME,
  status TEXT NOT NULL DEFAULT 'initiated',
  validation_results TEXT,
  rollback_reason TEXT,
  attempt_number INTEGER DEFAULT 1
);
```

### Mode State Table
```sql
CREATE TABLE context7_mode_state (
  id INTEGER PRIMARY KEY,
  current_mode TEXT NOT NULL,
  transition_state TEXT NOT NULL,
  last_quality_check DATETIME,
  stability_start DATETIME,
  configuration_snapshot TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Integration with DevFlow

The Context7 system integrates seamlessly with the existing DevFlow infrastructure:

- **Monitoring System**: Real-time metrics via port 9091
- **Database**: Unified SQLite database at `./data/devflow_unified.sqlite`
- **Orchestrator**: Health and performance monitoring via port 3005
- **Enforcement**: Integration with 100-line limit enforcement

## Monitoring & Alerting

### Prometheus Metrics

- `context7_current_mode` - Current operational mode
- `context7_quality_score` - Real-time quality score
- `context7_transition_attempts` - Number of transition attempts
- `context7_auto_transitions_per_hour` - Auto-transition rate

### Health Endpoints

- `/health` - System health check
- `/metrics` - Prometheus metrics
- `/status` - Detailed status information

## Best Practices

### 1. Gradual Progression
- Always progress through modes sequentially
- Allow sufficient stabilization time between transitions
- Monitor quality trends before transitioning

### 2. Validation First
- Always run production readiness validation before transitions
- Address all critical issues before proceeding
- Review warnings and recommendations

### 3. Monitoring
- Enable continuous monitoring for automatic transitions
- Set up alerting for quality degradation
- Regular validation checks in production

### 4. Rollback Preparedness
- Understand rollback triggers and procedures
- Test rollback mechanisms in non-production environments
- Maintain audit trails for debugging

## Troubleshooting

### Common Issues

**Transition Blocked by Quality Score**
```bash
# Check current metrics
node src/core/context7/context7-cli.js status

# Run detailed validation
node src/core/context7/context7-cli.js validate

# Review specific quality metrics
curl http://localhost:9091/json | jq '.metrics.context7'
```

**Orchestrator Success Rate Too Low**
```bash
# Check orchestrator health
curl http://localhost:3005/health

# Review orchestrator metrics
curl http://localhost:3005/api/metrics
```

**Service Health Issues**
```bash
# Check all service health
./start-devflow.sh status

# Restart specific services if needed
./start-devflow.sh restart
```

## Development

### Running Tests
```bash
# Test CLI interface
node src/core/context7/context7-cli.js validate

# Test status reporting
node src/core/context7/context7-cli.js status

# Test transition (dry run)
node src/core/context7/context7-cli.js transition hybrid "test"
```

### Adding New Validation Stages
1. Extend `ProductionReadinessValidator`
2. Add validation logic in new method
3. Update `validateProductionReadiness()` to call new stage
4. Add appropriate weight in `calculateOverallReadiness()`

### Customizing Thresholds
- Modify configuration in controller constructor
- Update validation criteria as needed
- Document changes in configuration section

## Security Considerations

- All transitions are logged with cryptographic integrity
- Database changes are audited
- Rollback mechanisms preserve security state
- Access controls maintained throughout transitions

## Future Enhancements

1. **Machine Learning Integration**: Predictive quality modeling
2. **A/B Testing**: Gradual rollout to subset of operations
3. **Integration Testing**: Automated validation against test suites
4. **Performance Profiling**: Detailed performance impact analysis
5. **Multi-Environment**: Support for staging/production environments

---

For more information, see the individual component documentation and DevFlow architecture documentation.