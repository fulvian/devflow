---
task: h-migrate-database-unico-05
subtask: 05-cost-analytics-tracker
agent: synthetic_code
batch: A
status: pending
created: 2025-09-19
modules: [cost-analytics, synthetic-usage, smart-session-retry]
---

# Cost Analytics & Synthetic Usage Tracker

## Problem/Goal
Implementare tracking real-time di costi Synthetic.new e utilizzo resources utilizzando tabelle `cost_analytics` e `synthetic_usage` attualmente vuote.

## Success Criteria
- [ ] Synthetic.new usage tracking automatico
- [ ] Cost analytics daily aggregation
- [ ] Budget alerts e threshold monitoring
- [ ] Integration con Smart Session Retry per adaptive costing

## Agent Prompt
```
TASK_ID: DEVFLOW-DB-005
Implement cost tracking for Synthetic.new usage:
1. Create synthetic-usage-tracker service using synthetic_usage table
2. Implement cost_analytics daily aggregation system
3. Add budget monitoring and alerts
4. Integrate with Smart Session Retry for cost-aware timing
```